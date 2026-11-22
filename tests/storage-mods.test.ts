import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { randomUUID } from 'node:crypto';
import { Store } from '../launcher/main/store';
import { Mods } from '../launcher/main/mods';
import { Packs } from '../launcher/main/packs';
test('SQLite survives restart; mod import, disable, duplicate/dependency checks, backup/restore and deletion', async () => {
  const root = path.resolve('.data/tests/' + randomUUID());
  const store = await new Store(root).init(path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'));
  try {
    const i = {
      id: randomUUID(),
      name: 'Test',
      version: '1.21.1',
      loader: 'fabric' as const,
      loaderVersion: '0.16.14',
      ram: 4096,
      created: new Date().toISOString(),
    };
    store.saveInstance(i);
    store.set('settings', { ram: 8192 });
    const zip = new AdmZip();
    zip.addFile(
      'fabric.mod.json',
      Buffer.from(
        JSON.stringify({
          id: 'test',
          name: 'Real fixture',
          version: '1.0.0',
          authors: [{ name: 'Fixture author' }],
          depends: { fabricloader: '*', missing_dep: '*' },
        }),
      ),
    );
    const source = path.join(root, 'source.jar');
    zip.writeZip(source);
    const mods = new Mods(store, async () => '');
    await mods.import(i.id, [source]);
    let list = await mods.list(i.id);
    assert.equal(list[0].name, 'Real fixture');
    assert.equal(list[0].authors[0], 'Fixture author');
    assert(list[0].warnings.some((w) => w.includes('missing_dep')));
    await mods.toggle(i.id, 'source.jar');
    assert.equal((await mods.list(i.id))[0].enabled, false);
    await mods.toggle(i.id, 'source.jar.disabled');
    const backup = await mods.backup(i.id);
    await mods.remove(i.id, 'source.jar');
    assert.equal((await mods.list(i.id)).length, 0);
    await mods.restore(i.id, backup);
    assert.equal((await mods.list(i.id)).length, 1);
    await fs.copyFile(
      path.join(store.dir(i.id), 'mods', 'source.jar'),
      path.join(store.dir(i.id), 'mods', 'duplicate.jar'),
    );
    list = await mods.list(i.id);
    assert(list.every((m) => m.warnings.some((w) => w.includes('중복'))));
    await assert.rejects(() => mods.toggle(i.id, '../../outside.jar'));
    store.close();
    const reopened = await new Store(root).init(
      path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'),
    );
    assert.equal(reopened.instances[0].name, 'Test');
    assert.equal(reopened.settings.ram, 8192);
    reopened.close();
  } finally {
    try {
      store.db.close();
    } catch {}
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('MRPACK import validates manifest; export refuses unlicensed local JAR distribution', async () => {
  const root = path.resolve('.data/tests/' + randomUUID());
  const store = await new Store(root).init(path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'));
  try {
    const mods = new Mods(store, async () => '');
    const packs = new Packs(store, mods);
    const zip = new AdmZip();
    zip.addFile(
      'modrinth.index.json',
      Buffer.from(
        JSON.stringify({
          formatVersion: 1,
          game: 'minecraft',
          name: 'Fixture pack',
          dependencies: { minecraft: '1.21.1', 'fabric-loader': '0.16.14' },
          files: [],
        }),
      ),
    );
    zip.addFile('overrides/config/test.json', Buffer.from('{"fixture":true}'));
    const file = path.join(root, 'fixture.mrpack');
    zip.writeZip(file);
    const i = await packs.import(file, new AbortController().signal);
    assert.equal(i.loader, 'fabric');
    assert.equal(
      JSON.parse(await fs.readFile(path.join(store.dir(i.id), 'config/test.json'), 'utf8')).fixture,
      true,
    );
    const exported = path.join(root, 'export.mrpack');
    await packs.export(i.id, exported, 'mrpack');
    assert(new AdmZip(exported).getEntry('modrinth.index.json'));
    const jar = new AdmZip();
    jar.addFile('fabric.mod.json', Buffer.from('{"id":"unlicensed","version":"1.0"}'));
    const jarfile = path.join(root, 'local.jar');
    jar.writeZip(jarfile);
    await mods.import(i.id, [jarfile]);
    await assert.rejects(() => packs.export(i.id, exported, 'mrpack'), /출처 정보/);
    const bad = new AdmZip();
    bad.addFile(
      'modrinth.index.json',
      Buffer.from(
        JSON.stringify({
          formatVersion: 1,
          game: 'minecraft',
          name: 'Bad pack',
          dependencies: { minecraft: '1.21.1' },
          files: [],
        }),
      ),
    );
    bad.addFile('overrides/malware.exe', Buffer.from('not executable'));
    const badfile = path.join(root, 'bad.mrpack');
    bad.writeZip(badfile);
    await assert.rejects(
      () => packs.import(badfile, new AbortController().signal),
      /허용되지 않은/,
    );
    assert.equal(store.instances.length, 1);
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
