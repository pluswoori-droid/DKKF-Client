import fs from 'node:fs/promises';
import path from 'node:path';
import { Store } from '../launcher/main/store';
import { Minecraft } from '../launcher/main/minecraft';
import { Mods } from '../launcher/main/mods';
const root = path.resolve('.data/live-26.3');
const store = await new Store(root).init(path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'));
store.set('settings', {
  ...store.settings,
  javaPath: 'C:/Program Files/Java/jdk-26.0.2.1/bin/java.exe',
});
let stamp = 0;
const mc = new Minecraft(store, (p) => {
  if (Date.now() - stamp > 5000) {
    console.log(p.message, p.current, p.total);
    stamp = Date.now();
  }
});
const mods = new Mods(store, async () => process.env.CURSEFORGE_API_KEY || '');
const results: any[] = [];
async function check(name: string, fn: () => Promise<any>) {
  try {
    const detail = await fn();
    results.push({ name, status: 'TESTED', detail });
    console.log('PASS', name);
  } catch (e) {
    results.push({ name, status: 'FAILED', error: (e as Error).message });
    console.log('FAIL', name, (e as Error).message);
    process.exitCode = 1;
  }
}
const i = {
  id: 'fabric-26.3',
  name: 'Minecraft 26.3 Fabric verification',
  version: '26.3',
  loader: 'fabric' as const,
  loaderVersion: '0.20.1',
  ram: 4096,
  created: new Date().toISOString(),
};
store.saveInstance(i);
await check('26.3 official metadata and stable Fabric compatibility', async () => {
  const m = await mc.manifest();
  if (!m.versions.some((v: any) => v.id === '26.3')) throw Error('26.3 absent');
  const l = await mc.loaders('fabric', '26.3');
  if (!l.some((l: any) => l.version === '0.20.1' && l.stable)) throw Error('Loader missing');
  return { game: i.version, loader: i.loaderVersion };
});
await check('26.3 Fabric API real download and verification', async () => {
  const d = await mods.detail('modrinth', 'fabric-api', i);
  if (!d.versions[0]) throw Error('Fabric API unavailable');
  return (
    await mods.install(
      i.id,
      'modrinth',
      'fabric-api',
      d.versions[0].id,
      AbortSignal.timeout(300000),
    )
  ).map((m) => ({ id: m.id, version: m.version, sha256: m.sha256 }));
});
if (process.argv.includes('--install'))
  await check('26.3 full official game and Fabric installation', async () => {
    await mc.install(i, AbortSignal.timeout(900000));
    const p = JSON.parse(
      await fs.readFile(path.join(store.dir(i.id), 'launch-profile.json'), 'utf8'),
    );
    if (p.javaVersion?.majorVersion !== 25 || !p.mainClass.includes('KnotClient'))
      throw Error('Unexpected game launch profile');
    return { profile: p.id, mainClass: p.mainClass, java: p.javaVersion.majorVersion };
  });
await fs.writeFile(path.join(root, 'results.json'), JSON.stringify(results, null, 2));
store.close();
