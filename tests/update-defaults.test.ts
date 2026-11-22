import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../launcher/main/store';
import service from '../shared/update-service.json';

test('Official update migration configures old blank settings once and preserves custom trust and later opt-out', async () => {
  const root = path.resolve('.data/tests/' + randomUUID()),
    wasm = path.resolve('node_modules/sql.js/dist/sql-wasm.wasm');
  let store = await new Store(root).init(wasm);
  try {
    assert.equal(store.settings.updateUrl, service.url);
    assert.equal(store.settings.updateKey, service.publicKey);
    assert.equal(store.settings.autoUpdate, true);
    store.set('settings', { updateUrl: '', updateKey: '', autoUpdate: false, ram: 8192 });
    store.set('migration.update-service.v1', false);
    store.close();
    store = await new Store(root).init(wasm);
    assert.equal(store.settings.updateUrl, service.url);
    assert.equal(store.settings.autoUpdate, true);
    assert.equal(store.settings.ram, 8192);
    store.set('settings', { ...store.settings, autoUpdate: false });
    store.close();
    store = await new Store(root).init(wasm);
    assert.equal(store.settings.autoUpdate, false);
    store.set('settings', {
      updateUrl: 'https://custom.example.com',
      updateKey: 'custom-key',
      autoUpdate: false,
    });
    store.set('migration.update-service.v1', false);
    store.close();
    store = await new Store(root).init(wasm);
    assert.equal(store.settings.updateUrl, 'https://custom.example.com');
    assert.equal(store.settings.updateKey, 'custom-key');
    assert.equal(store.settings.autoUpdate, false);
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
