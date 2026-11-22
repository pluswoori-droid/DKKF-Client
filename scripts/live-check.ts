import fs from 'node:fs/promises';
import path from 'node:path';
import { Store } from '../launcher/main/store';
import { Minecraft } from '../launcher/main/minecraft';
import { Mods } from '../launcher/main/mods';
const root = path.resolve('.data/live-check');
await fs.mkdir(root, { recursive: true });
const store = await new Store(root).init(path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'));
store.set('settings', {
  ...store.settings,
  javaPath: 'C:/Program Files/Java/jdk-21.0.10/bin/java.exe',
});
let stamp = 0;
const mc = new Minecraft(store, (p) => {
  if (Date.now() - stamp > 5000) {
    console.log(p.message, p.current, p.total);
    stamp = Date.now();
  }
});
const mods = new Mods(store, async () => process.env.CURSEFORGE_API_KEY || '');
const results: unknown[] = [];
async function check(name: string, fn: () => Promise<unknown>) {
  const start = Date.now();
  try {
    const d = await fn();
    results.push({ name, status: 'TESTED', ms: Date.now() - start, detail: d });
    console.log('PASS', name);
  } catch (e) {
    results.push({ name, status: 'FAILED', message: (e as Error).message });
    console.log('FAIL', name, (e as Error).message);
    process.exitCode = 1;
  }
}
await check('Mojang official version manifest', async () => {
  const d = await mc.manifest();
  if (!d.versions.some((v: any) => v.id === '1.21.1')) throw Error('Missing known version');
  return { latest: d.latest, count: d.versions.length };
});
for (const loader of ['fabric', 'quilt', 'forge', 'neoforge'] as const)
  await check(loader + ' official compatible loader metadata', async () => {
    const d = await mc.loaders(loader, '1.21.1');
    if (!d.length) throw Error('No compatible loader');
    return d.slice(0, 2);
  });
const i = {
  id: 'live-1.21.1',
  name: 'Live API check',
  version: '1.21.1',
  loader: 'fabric' as const,
  loaderVersion: '',
  ram: 4096,
  created: new Date().toISOString(),
};
store.saveInstance(i);
await check('Modrinth live search and details', async () => {
  const hits = await mods.search('modrinth', 'sodium', i);
  if (!hits.length) throw Error('Empty results');
  const d = await mods.detail('modrinth', hits[0].id, i);
  if (!d.versions.length) throw Error('No compatible versions');
  return { project: hits[0].title, version: d.versions[0] };
});
await check('Modrinth real download with dependency resolution and hashes', async () => {
  const hits = await mods.search('modrinth', 'sodium', i);
  const d = await mods.detail('modrinth', hits[0].id, i);
  const list = await mods.install(
    i.id,
    'modrinth',
    hits[0].id,
    d.versions[0].id,
    new AbortController().signal,
  );
  return list.map((m) => ({ name: m.name, version: m.version, sha256: m.sha256 }));
});
if (process.argv.includes('--install'))
  for (const loader of ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'] as const)
    await check(loader + ' full Minecraft 1.21.1 installation', async () => {
      const loaders = loader === 'vanilla' ? [] : await mc.loaders(loader, '1.21.1');
      const item = { ...i, loader, loaderVersion: loaders[0]?.version || '' };
      store.saveInstance(item);
      const timeout = AbortSignal.timeout(15 * 60000);
      await mc.install(item, timeout);
      const profile = JSON.parse(
        await fs.readFile(path.join(store.dir(item.id), 'launch-profile.json'), 'utf8'),
      );
      return {
        profile: profile.id,
        mainClass: profile.mainClass,
        installed: store.instance(item.id).installed,
      };
    });
await fs.writeFile(
  path.join(root, process.argv.includes('--install') ? 'results.json' : 'results-api.json'),
  JSON.stringify(results, null, 2),
);
store.close();
