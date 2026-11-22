import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
import { contained, httpsUrl, checkHash, verifySigned, redact } from '../launcher/main/security';
import { safeEntries } from '../launcher/main/archive';
import { allowed, mavenPath, mergeVersion } from '../launcher/main/minecraft';
test('paths reject traversal, absolute paths, NTFS streams and reserved devices', () => {
  for (const p of [
    '../escape',
    'a/../../b',
    'C:/escape',
    '/absolute',
    'a\\b',
    'file:stream',
    'CON.jar',
    'aux/file',
    'file.',
    'a//b',
  ])
    assert.throws(() => contained('D:/test', p), p);
  assert.equal(contained('D:/test', 'mods/good.jar'), 'D:\\test\\mods\\good.jar');
});
test('HTTPS and exact host boundary enforcement', () => {
  for (const u of [
    'http://cdn.modrinth.com/a',
    'https://cdn.modrinth.com.evil.test/a',
    'https://user:pass@cdn.modrinth.com/a',
    'https://cdn.modrinth.com:8080/a',
  ])
    assert.throws(() => httpsUrl(u, ['modrinth.com']));
  assert.equal(
    httpsUrl('https://cdn.modrinth.com/a', ['modrinth.com']).hostname,
    'cdn.modrinth.com',
  );
});
test('hash rejects corrupt bytes and unsupported algorithms', () => {
  const b = Buffer.from('verified');
  const hash = createHash('sha256').update(b).digest('hex');
  checkHash(b, 'sha256', hash);
  assert.throws(() => checkHash(Buffer.from('tampered'), 'sha256', hash));
  assert.throws(() => checkHash(b, 'md5', 'a'.repeat(32)));
});
test('Ed25519 signature rejects changed payload, forged signature and other key types', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const payload = { version: '1.2.3', url: 'https://updates.example.com/setup.exe' };
  const sig = sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64');
  verifySigned(payload, sig, pem);
  assert.throws(() => verifySigned({ ...payload, version: '9.9.9' }, sig, pem));
  assert.throws(() => verifySigned(payload, Buffer.alloc(64).toString('base64'), pem));
});
test('zip rejects case insensitive collisions and expansion limits', () => {
  const zip = new AdmZip();
  zip.addFile('mods/one.jar', Buffer.from('a'));
  zip.addFile('mods/ONE.jar', Buffer.from('b'));
  assert.throws(() => safeEntries(zip));
  const bomb = new AdmZip();
  bomb.addFile('a', Buffer.from('a'));
  bomb.getEntry('a')!.header.size = 1024 ** 3 + 1;
  assert.throws(() => safeEntries(bomb));
});
test('Mojang rules use ordered allow/disallow and feature predicates', () => {
  assert.equal(allowed(), true);
  assert.equal(allowed([{ action: 'allow', os: { name: 'linux' } }]), false);
  assert.equal(
    allowed([{ action: 'allow' }, { action: 'disallow', os: { name: 'windows' } }]),
    false,
  );
  assert.equal(allowed([{ action: 'allow', features: { is_demo_user: true } }]), false);
  assert.equal(
    allowed([{ action: 'allow', features: { has_custom_resolution: true } }], {
      has_custom_resolution: true,
    }),
    true,
  );
});
test('Maven paths and inherited profiles preserve child library precedence', () => {
  assert.equal(
    mavenPath('org.lwjgl:lwjgl:3.3.3:natives-windows'),
    'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar',
  );
  const merged = mergeVersion(
    {
      libraries: [{ name: 'a:b:1' }],
      arguments: { game: ['a'] },
      downloads: { client: 'official' },
      assetIndex: { id: '1' },
    },
    { libraries: [{ name: 'a:b:2' }], arguments: { game: ['b'] }, mainClass: 'loader.Main' },
  );
  assert.deepEqual(merged.libraries, [{ name: 'a:b:2' }]);
  assert.deepEqual(merged.arguments.game, ['a', 'b']);
  assert.equal(merged.downloads.client, 'official');
});
test('log redaction conceals bearer, access and refresh tokens', () => {
  const log = redact(
    'Bearer abc.xyz --accessToken secret access_token=private refresh_token:refresh',
  );
  assert(!log.includes('abc.xyz'));
  assert(!log.includes('secret'));
  assert(!log.includes('private'));
  assert(!log.includes(':refresh'));
});
