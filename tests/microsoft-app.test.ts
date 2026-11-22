import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Store } from '../launcher/main/store';
import microsoftApp from '../shared/microsoft-app.json';

test('Microsoft client ID migration fills legacy blanks, preserves custom IDs and does not create authenticated accounts', async () => {
  const root = path.resolve('.data/tests/' + randomUUID());
  const wasm = path.resolve('node_modules/sql.js/dist/sql-wasm.wasm');
  let store: Store | undefined;
  try {
    store = await new Store(root).init(wasm);
    assert.equal(store.settings.microsoftClientId, microsoftApp.clientId);
    assert.deepEqual(store.accounts, []);
    store.set('settings', { microsoftClientId: '', ram: 8192 });
    store.set('migration.microsoft-client-id.v1', false);
    store.close();
    store = await new Store(root).init(wasm);
    assert.equal(store.settings.microsoftClientId, microsoftApp.clientId);
    assert.equal(store.settings.ram, 8192);
    const custom = '11111111-2222-4333-8444-555555555555';
    store.set('settings', { microsoftClientId: custom });
    store.set('migration.microsoft-client-id.v1', false);
    store.close();
    store = await new Store(root).init(wasm);
    assert.equal(store.settings.microsoftClientId, custom);
    store.set('settings', { microsoftClientId: '' });
    store.close();
    store = await new Store(root).init(wasm);
    assert.equal(store.settings.microsoftClientId, '');
    assert.deepEqual(store.accounts, []);
  } finally {
    store?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
