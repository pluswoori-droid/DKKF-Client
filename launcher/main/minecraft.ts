import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import AdmZip from 'adm-zip';
import { contained } from './security';
import { json, download, request } from './network';
import { safeEntries } from './archive';
import type { Instance, Loader, Progress } from '../../shared/types';
import type { Store } from './store';
import target from '../../shared/target.json';
import { LoaderMetadata } from './loader-metadata';
import { memoryArguments, removeForcedResolution, directServerArguments } from './launch-options';
import serverProfile from '../../shared/server-profile.json';
import { ensureJava } from './java';
type Rule = {
  action: string;
  os?: { name?: string; arch?: string; version?: string };
  features?: Record<string, boolean>;
};
export function allowed(rules?: Rule[], features: Record<string, boolean> = {}) {
  if (!rules) return true;
  let ok = false;
  for (const r of rules) {
    const match =
      (!r.os?.name || r.os.name === 'windows') &&
      (!r.os?.arch || r.os.arch === 'x86_64' || r.os.arch === 'amd64') &&
      (!r.os?.version || new RegExp(r.os.version).test('10.0')) &&
      (!r.features || Object.entries(r.features).every(([k, v]) => (features[k] ?? false) === v));
    if (match) ok = r.action === 'allow';
  }
  return ok;
}
export function mavenPath(name: string) {
  const [coordinate, ext = 'jar'] = name.split('@');
  const [group, artifact, version, classifier] = coordinate.split(':');
  if (!group || !artifact || !version) throw Error('Maven 좌표 오류');
  return (
    group.replaceAll('.', '/') +
    '/' +
    artifact +
    '/' +
    version +
    '/' +
    artifact +
    '-' +
    version +
    (classifier ? '-' + classifier : '') +
    '.' +
    ext
  );
}
export function mergeVersion(base: any, child: any) {
  const libs = new Map<string, any>();
  for (const l of [...(base.libraries || []), ...(child.libraries || [])]) {
    const p = l.name.split(':');
    libs.set(p[0] + ':' + p[1] + ':' + (p[3] || ''), l);
  }
  return {
    ...base,
    ...child,
    libraries: [...libs.values()],
    arguments: {
      jvm: [...(base.arguments?.jvm || []), ...(child.arguments?.jvm || [])],
      game: [...(base.arguments?.game || []), ...(child.arguments?.game || [])],
    },
    downloads: base.downloads,
    assetIndex: base.assetIndex,
    assets: base.assets,
    javaVersion: base.javaVersion,
  };
}
export class Minecraft {
  private familyMetadata: LoaderMetadata;
  constructor(
    private store: Store,
    private emit: (p: Progress) => void,
    readLoaderMetadata?: typeof json,
  ) {
    this.familyMetadata = new LoaderMetadata(readLoaderMetadata);
  }
  manifest() {
    return json('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  }
  async loaders(loader: Loader, version: string) {
    if (loader === 'vanilla') return [];
    if (loader === 'fabric' || loader === 'quilt') {
      return this.familyMetadata.list(loader, version);
    }
    const url =
      loader === 'forge'
        ? 'https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml'
        : 'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml';
    const text = await (await request(url)).text();
    const vs = [...text.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]);
    const prefix =
      loader === 'forge'
        ? version + '-'
        : version.startsWith('1.')
          ? version.slice(2) + '.'
          : version + '.';
    return vs
      .filter((v) => v.startsWith(prefix))
      .reverse()
      .map((v) => ({ version: v, stable: !v.includes('beta') }));
  }
  async validateLoader(i: Pick<Instance, 'loader' | 'version' | 'loaderVersion'>) {
    if (i.loader === 'vanilla') return;
    if (!i.loaderVersion) throw Error('로더 버전을 선택하세요.');
    const versions = await this.loaders(i.loader, i.version);
    if (!versions.some((l: any) => l.version === i.loaderVersion))
      throw Error(
        `Minecraft ${i.version}과 호환되지 않는 ${i.loader} 로더 버전입니다. 공식 목록에서 호환 버전을 다시 선택하세요.`,
      );
  }
  private async fetchFile(url: string, file: string, hash: any, signal: AbortSignal) {
    await download(url, file, hash, signal, (n, t) =>
      this.emit({ task: 'install', message: path.basename(file), current: n, total: t }),
    );
  }
  private async prepareJava(minimum: number, signal?: AbortSignal) {
    const java = await ensureJava(minimum, this.store.settings.javaPath, this.store.root, signal,
      (message, current, total) => this.emit({ task: 'install', message, current, total }));
    if (this.store.settings.javaPath !== java.path)
      this.store.set('settings', { ...this.store.settings, javaPath: java.path });
    return java.path;
  }
  async install(i: Instance, signal: AbortSignal) {
    await this.validateLoader(i);
    const root = this.store.dir(i.id);
    await fs.mkdir(root, { recursive: true });
    const all = await this.manifest();
    const meta = all.versions.find((v: any) => v.id === i.version);
    if (!meta) throw Error('공식 목록에 없는 게임 버전입니다.');
    const baseFile = contained(root, `versions/${i.version}/${i.version}.json`);
    await this.fetchFile(meta.url, baseFile, { algorithm: 'sha1', value: meta.sha1 }, signal);
    let version = JSON.parse(await fs.readFile(baseFile, 'utf8'));
    if (!version.downloads?.client) throw Error('클라이언트 파일을 제공하지 않는 버전입니다.');
    await this.prepareJava(version.javaVersion?.majorVersion || 8, signal);
    await this.fetchFile(
      version.downloads.client.url,
      contained(root, `versions/${i.version}/${i.version}.jar`),
      { algorithm: 'sha1', value: version.downloads.client.sha1 },
      signal,
    );
    let profile = i.version;
    if (i.loader !== 'vanilla') {
      if (i.loader === 'fabric' || i.loader === 'quilt') {
        const endpoint =
          i.loader === 'fabric'
            ? `https://meta.fabricmc.net/v2/versions/loader/${i.version}/${i.loaderVersion}/profile/json`
            : `https://meta.quiltmc.org/v3/versions/loader/${i.version}/${i.loaderVersion}/profile/json`;
        const child = await json(endpoint);
        profile = child.id;
        version = mergeVersion(version, child);
      } else {
        await fs.writeFile(
          path.join(root, 'launcher_profiles.json'),
          JSON.stringify({ profiles: {} }),
        );
        const isForge = i.loader === 'forge';
        const base = isForge
          ? 'https://maven.minecraftforge.net/net/minecraftforge/forge/'
          : 'https://maven.neoforged.net/releases/net/neoforged/neoforge/';
        const stem = (isForge ? 'forge' : 'neoforge') + '-' + i.loaderVersion + '-installer.jar';
        const url = base + i.loaderVersion + '/' + stem;
        const sha = (await (await request(url + '.sha1')).text()).trim().split(/\s/)[0];
        const installer = contained(root, 'installers/' + stem);
        await this.fetchFile(url, installer, { algorithm: 'sha1', value: sha }, signal);
        this.emit({
          task: 'install',
          message: '공식 로더 설치 프로그램 실행 중',
          current: 0,
          total: 0,
        });
        await promisify(execFile)(
          this.store.settings.javaPath,
          ['-jar', installer, '--installClient', root],
          { cwd: root, windowsHide: true, timeout: 600000, signal, maxBuffer: 16 * 1024 ** 2 },
        );
        const dirs = await fs.readdir(path.join(root, 'versions'));
        const candidates = dirs.filter((d) => d !== i.version);
        let child: any;
        for (const d of candidates) {
          try {
            const c = JSON.parse(
              await fs.readFile(contained(root, `versions/${d}/${d}.json`), 'utf8'),
            );
            const matches =
              i.loader === 'neoforge'
                ? c.id === 'neoforge-' + i.loaderVersion
                : c.libraries?.some(
                    (l: any) =>
                      l.name.startsWith('net.minecraftforge:forge:') &&
                      l.name.includes(i.loaderVersion),
                  );
            if (c.inheritsFrom === i.version && matches) {
              child = c;
              profile = d;
              break;
            }
          } catch {}
        }
        if (!child) throw Error('공식 설치 프로그램이 실행 프로필을 생성하지 못했습니다.');
        version = mergeVersion(version, child);
      }
    }
    const natives = path.join(root, 'natives');
    await fs.mkdir(natives, { recursive: true });
    for (const lib of version.libraries || []) {
      signal.throwIfAborted();
      if (!allowed(lib.rules)) continue;
      const art = lib.downloads?.artifact;
      const rel = art?.path || mavenPath(lib.name);
      const file = contained(root, 'libraries/' + rel);
      if (art) await this.fetchFile(art.url, file, { algorithm: 'sha1', value: art.sha1 }, signal);
      else {
        try {
          await fs.access(file);
        } catch {
          const url = (lib.url || 'https://libraries.minecraft.net/') + rel;
          await this.fetchFile(
            url,
            file,
            lib.sha1 ? { algorithm: 'sha1', value: lib.sha1 } : undefined,
            signal,
          );
        }
      }
      const nativeKey = lib.natives?.windows?.replace('${arch}', '64');
      const native = lib.downloads?.classifiers?.[nativeKey];
      if (native) {
        const archive = contained(root, 'libraries/' + native.path);
        await this.fetchFile(
          native.url,
          archive,
          { algorithm: 'sha1', value: native.sha1 },
          signal,
        );
        const z = new AdmZip(archive);
        for (const e of safeEntries(z)) {
          if (
            e.isDirectory ||
            e.entryName.startsWith('META-INF/') ||
            lib.extract?.exclude?.some((p: string) => e.entryName.startsWith(p))
          )
            continue;
          const target = contained(natives, e.entryName);
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, e.getData());
        }
      }
    }
    const index = version.assetIndex;
    if (index) {
      const idxFile = contained(root, `assets/indexes/${index.id}.json`);
      await this.fetchFile(index.url, idxFile, { algorithm: 'sha1', value: index.sha1 }, signal);
      const assets = JSON.parse(await fs.readFile(idxFile, 'utf8'));
      const entries = Object.entries(assets.objects) as [string, { hash: string }][];
      let completed = 0;
      // Bounded concurrency; every object is verified against Mojang's SHA-1.
      let cursor = 0;
      let workerError: unknown;
      const workers = Array.from({ length: 6 }, async () => {
        try {
          while (cursor < entries.length && !workerError) {
            const [name, a] = entries[cursor++];
            signal.throwIfAborted();
            const prefix = a.hash.slice(0, 2);
            const target = contained(root, `assets/objects/${prefix}/${a.hash}`);
            await download(
              `https://resources.download.minecraft.net/${prefix}/${a.hash}`,
              target,
              { algorithm: 'sha1', value: a.hash },
              signal,
            );
            if (assets.virtual || assets.map_to_resources) {
              const dir = assets.map_to_resources ? 'resources' : `assets/virtual/${index.id}`;
              const mapped = contained(root, dir + '/' + name);
              await fs.mkdir(path.dirname(mapped), { recursive: true });
              await fs.copyFile(target, mapped);
            }
            this.emit({
              task: 'install',
              message: '게임 리소스 검증',
              current: ++completed,
              total: entries.length,
            });
          }
        } catch (e) {
          workerError ??= e;
          throw e;
        }
      });
      await Promise.allSettled(workers);
      if (workerError) throw workerError;
    }
    await fs.writeFile(path.join(root, 'launch-profile.json'), JSON.stringify(version, null, 2));
    await fs.mkdir(path.join(root, 'mods'), { recursive: true });
    this.store.saveInstance({ ...i, profileId: profile, installed: true });
  }
  async launch(
    i: Instance,
    account: { id: string; name: string; token: string },
    onLog: (s: string) => void,
    onExit: (code: number | null) => void,
  ) {
    const root = this.store.dir(i.id);
    const v = JSON.parse(await fs.readFile(path.join(root, 'launch-profile.json'), 'utf8'));
    await this.prepareJava(v.javaVersion?.majorVersion || 8);
    const cp = (v.libraries || [])
      .filter((l: any) => allowed(l.rules))
      .map((l: any) =>
        contained(root, 'libraries/' + (l.downloads?.artifact?.path || mavenPath(l.name))),
      );
    cp.push(contained(root, `versions/${i.version}/${i.version}.jar`));
    const s = this.store.settings;
    const values: Record<string, string> = {
      auth_player_name: account.name,
      version_name: i.profileId || i.version,
      game_directory: root,
      assets_root: path.join(root, 'assets'),
      assets_index_name: v.assets || v.assetIndex?.id || '',
      auth_uuid: account.id,
      auth_access_token: account.token,
      auth_session: account.token,
      user_type: 'msa',
      version_type: v.type || 'release',
      user_properties: '{}',
      natives_directory: path.join(root, 'natives'),
      launcher_name: 'Dkkf Launcher',
      launcher_version: target.launcherVersion,
      classpath: cp.join(path.delimiter),
      classpath_separator: path.delimiter,
      library_directory: path.join(root, 'libraries'),
      resolution_width: String(s.width),
      resolution_height: String(s.height),
      clientid: s.microsoftClientId,
      auth_xuid: '',
      game_assets: path.join(root, 'assets', 'virtual', v.assets || 'legacy'),
    };
    const expand = (str: string) =>
      str.replace(/\$\{([^}]+)\}/g, (_, key) => {
        if (!(key in values)) throw Error('미지원 실행 변수: ' + key);
        return values[key];
      });
    const flatten = (items: any[]) =>
      items.flatMap((a) =>
        typeof a === 'string'
          ? [expand(a)]
          : allowed(a.rules, { has_custom_resolution: s.limitResolution })
            ? (Array.isArray(a.value) ? a.value : [a.value]).map(expand)
            : [],
      );
    const jvm = v.arguments?.jvm?.length
      ? flatten(v.arguments.jvm)
      : ['-Djava.library.path=' + values.natives_directory, '-cp', values.classpath];
    const rawGame = v.minecraftArguments
      ? v.minecraftArguments.split(' ').map(expand)
      : flatten(v.arguments?.game || []);
    const game = directServerArguments(
      removeForcedResolution(rawGame, s),
      serverProfile.address,
      path.join(root, 'quickplay.json'),
    );
    if (s.fullscreen) game.push('--fullscreen');
    const child = spawn(s.javaPath, [...memoryArguments(i), ...jvm, v.mainClass, ...game], {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (d) => onLog(d.toString()));
    child.stderr?.on('data', (d) => onLog(d.toString()));
    child.on('error', (e) => onLog(e.message));
    child.on('close', onExit);
    return child;
  }
}
