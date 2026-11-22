import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { Store } from '../launcher/main/store';
import { Mods } from '../launcher/main/mods';
import { installBundledMods } from '../launcher/main/bundled-mods';
test('New 26.3 Fabric instances receive the supplied Locator JAR without upgrading a pinned Fabric API', async () => {
  const root = path.resolve('.data/tests/' + randomUUID());
  const store = await new Store(root).init(path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'));
  try {
    const i = {
      id: 'fixture',
      name: 'fixture',
      version: '26.3',
      loader: 'fabric' as const,
      loaderVersion: '0.20.1',
      ram: 4096,
      limitRam: false,
      created: 'fixture',
    };
    store.saveInstance(i);
    const mods = new Mods(store, async () => '');
    const fixture = new AdmZip();
    fixture.addFile(
      'fabric.mod.json',
      Buffer.from(JSON.stringify({ id: 'fabric-api', name: 'Fixture API', version: '0.160.0' })),
    );
    const apiFile = path.join(root, 'fixture-api.jar');
    fixture.writeZip(apiFile);
    await mods.import(i.id, [apiFile]);
    mods.detail = async () => {
      throw Error('Existing mods must not be updated automatically');
    };
    await installBundledMods(
      store,
      mods,
      i.id,
      path.resolve('assets'),
      new AbortController().signal,
    );
    const list = await mods.list(i.id);
    assert(list.some((m) => m.id === 'locatorbar' && m.version === '1.2.0'));
    assert(list.some((m) => m.id === 'fabric-api' && m.version === '0.160.0'));
    await installBundledMods(
      store,
      mods,
      i.id,
      path.resolve('assets'),
      new AbortController().signal,
    );
    assert.equal((await mods.list(i.id)).filter((m) => m.id === 'locatorbar').length, 1);
    store.saveInstance({ ...i, id: 'vanilla', loader: 'vanilla' });
    await installBundledMods(
      store,
      mods,
      'vanilla',
      path.resolve('assets'),
      new AbortController().signal,
    );
    assert.equal((await mods.list('vanilla')).length, 0);
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
