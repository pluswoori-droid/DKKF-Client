import initSqlJs, { type Database } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import type { Instance, Settings, Account } from '../../shared/types';
import microsoftApp from '../../shared/microsoft-app.json';
import updateService from '../../shared/update-service.json';
export const defaults: Settings = {
  javaPath: 'java',
  ram: 4096,
  limitRam: false,
  limitResolution: false,
  width: 1280,
  height: 720,
  fullscreen: false,
  autoUpdate: true,
  discordRichPresence: true,
  serverBridge: false,
  channel: 'stable',
  microsoftClientId: microsoftApp.clientId,
  updateUrl: updateService.url,
  updateKey: updateService.publicKey,
  language: 'ko',
};
export class Store {
  db!: Database;
  file: string;
  constructor(public root: string) {
    fs.mkdirSync(root, { recursive: true });
    this.file = path.join(root, 'dkkf.sqlite');
  }
  async init(wasm: string) {
    const sql = await initSqlJs({ locateFile: () => wasm });
    this.db = new sql.Database(fs.existsSync(this.file) ? fs.readFileSync(this.file) : undefined);
    this.db.run('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    this.db.run(
      'CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY, instance TEXT, started TEXT, exit_code INTEGER)',
    );
    const migration = 'migration.microsoft-client-id.v1';
    if (!this.get(migration, false)) {
      const saved = this.get<Partial<Settings>>('settings', {});
      if (!saved.microsoftClientId?.trim())
        this.set('settings', { ...saved, microsoftClientId: microsoftApp.clientId });
      this.set(migration, true);
    }
    const updateMigration = 'migration.update-service.v1';
    if (!this.get(updateMigration, false)) {
      const saved = this.get<Partial<Settings>>('settings', {});
      if (!saved.updateUrl?.trim() && !saved.updateKey?.trim())
        this.set('settings', {
          ...saved,
          updateUrl: updateService.url,
          updateKey: updateService.publicKey,
          autoUpdate: true,
        });
      this.set(updateMigration, true);
    }
    return this;
  }
  get<T>(key: string, fallback: T): T {
    const stmt = this.db.prepare('SELECT value FROM kv WHERE key=?');
    try {
      stmt.bind([key]);
      return stmt.step() ? JSON.parse(stmt.getAsObject().value as string) : fallback;
    } finally {
      stmt.free();
    }
  }
  set(key: string, value: unknown) {
    this.db.run('INSERT OR REPLACE INTO kv VALUES (?,?)', [key, JSON.stringify(value)]);
    this.flush();
  }
  flush() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, this.db.export());
    fs.renameSync(tmp, this.file);
  }
  get settings() {
    return { ...defaults, ...this.get<Partial<Settings>>('settings', {}) };
  }
  get instances() {
    return this.get<Instance[]>('instances', []);
  }
  instance(id: string) {
    const item = this.instances.find((i) => i.id === id);
    if (!item) throw Error('인스턴스를 찾을 수 없습니다.');
    return item;
  }
  saveInstance(item: Instance) {
    const items = this.instances;
    const index = items.findIndex((i) => i.id === item.id);
    if (index < 0) items.push(item);
    else items[index] = item;
    this.set('instances', items);
  }
  get accounts() {
    return this.get<Account[]>('accounts', []);
  }
  dir(id: string) {
    this.instance(id);
    return path.join(this.root, 'instances', id);
  }
  close() {
    this.flush();
    this.db.close();
  }
}
