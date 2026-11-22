import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Store } from '../launcher/main/store';
import { Updater } from '../launcher/main/updater';
test('signed update protocol accepts newer versions, rejects tampering/channel mismatch/downgrades; failed checks preserve installation', async () => {
  const root = path.resolve('.data/tests/' + randomUUID());
  const store = await new Store(root).init(path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  store.set('settings', {
    updateUrl: 'https://updates.example.com',
    updateKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    channel: 'stable',
  });
  const payload = {
    version: '1.2.3',
    channel: 'stable',
    target: 'launcher',
    url: 'https://updates.example.com/setup.exe',
    sha256: 'a'.repeat(64),
    size: 1000,
    published: new Date().toISOString(),
    notes: 'Fixture, not a real release',
  };
  const envelope = (p: any) => ({
    payload: p,
    signature: sign(null, Buffer.from(JSON.stringify(p)), privateKey).toString('base64'),
  });
  let response = envelope(payload);
  const updater = new Updater(
    store,
    () => {},
    { version: '0.1.0', packaged: false, quit: () => {} },
    async () => response,
  );
  try {
    assert.equal((await updater.check()).status, 'available');
    response = { ...envelope(payload), payload: { ...payload, sha256: 'b'.repeat(64) } };
    await assert.rejects(() => updater.check(), /서명/);
    response = envelope({ ...payload, channel: 'beta' });
    await assert.rejects(() => updater.check(), /채널/);
    response = envelope({ ...payload, version: '0.0.1' });
    assert.equal((await updater.check()).status, 'current');
    response = envelope({ ...payload, url: 'http://insecure.example.com/setup.exe' });
    await assert.rejects(() => updater.check(), /HTTPS/);
    await assert.rejects(() => updater.install(), /패키징/);
    assert.equal(store.instances.length, 0);
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('Verified update cache is reused, silent exit handoff is pinned to current trust, and tampering never executes', async () => {
  const root = path.resolve('.data/tests/' + randomUUID());
  const store = await new Store(root).init(path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const bytes = Buffer.from('Synthetic installer fixture; never execute');
  store.set('settings', {
    ...store.settings,
    updateUrl: 'https://updates.example.com',
    updateKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  });
  const payload = {
    version: '1.0.0',
    channel: 'stable',
    target: 'launcher',
    url: 'https://updates.example.com/setup.exe',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.length,
    published: new Date().toISOString(),
    notes: 'fixture',
  };
  let response = {
    payload,
    signature: sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64'),
  };
  let downloads = 0,
    quit = 0;
  const launched: { file: string; args: string[] }[] = [];
  const updater = new Updater(
    store,
    () => {},
    {
      version: '0.3.2',
      packaged: true,
      quit: () => {
        quit++;
      },
      launchInstaller: async (file, args) => {
        launched.push({ file, args });
      },
    },
    async () => response,
    async (_url, destination) => {
      downloads++;
      await fs.writeFile(destination, bytes);
    },
  );
  try {
    await updater.check();
    await updater.fetch(new AbortController().signal);
    await updater.fetch(new AbortController().signal);
    assert.equal(downloads, 1);
    const staged = updater.ready!;
    await fs.writeFile(staged, 'tampered');
    await assert.rejects(() => updater.install({ silent: true }), /해시/);
    assert.equal(launched.length, 0);
    await updater.fetch(new AbortController().signal);
    assert.equal(downloads, 2);
    await updater.install({ silent: true });
    assert.deepEqual(launched[0], { file: staged, args: ['/S', '--updated'] });
    assert.equal(quit, 1);
    const originalKey = store.settings.updateKey;
    store.set('settings', {
      ...store.settings,
      updateKey: generateKeyPairSync('ed25519')
        .publicKey.export({ type: 'spki', format: 'pem' })
        .toString(),
    });
    await assert.rejects(() => updater.install({ silent: true }), /서명/);
    assert.equal(launched.length, 1);
    store.set('settings', { ...store.settings, updateKey: originalKey });
    response = { ...response, payload: { ...payload, sha256: 'a'.repeat(64) } };
    await assert.rejects(() => updater.check(), /서명/);
    await assert.rejects(() => updater.install({ silent: true }), /검증/);
    assert.equal(launched.length, 1);
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
