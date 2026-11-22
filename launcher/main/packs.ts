import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { z } from 'zod';
import type { Store } from './store';
import type { Mods } from './mods';
import type { Instance, Mod } from '../../shared/types';
import { contained, digest } from './security';
import { safeEntries, extract } from './archive';
import { download, json } from './network';
import { id as safeId } from '../../shared/schemas';
import bundledMods from '../../shared/bundled-mods.json';
import core from '../../shared/core-build.json';
import serverProfile from '../../shared/server-profile.json';
export class Packs {
  constructor(
    private store: Store,
    private mods: Mods,
  ) {}
  async export(id: string, file: string, format: 'mrpack' | 'curseforge') {
    const i = this.store.instance(id);
    const allMods = (await this.mods.list(id)).filter((m) => m.enabled);
    const bundledHashes = new Set([...bundledMods.map((m) => m.sha256), core.sha256]);
    const included = allMods.filter((m) => bundledHashes.has(m.sha256));
    const mods = allMods.filter((m) => !bundledHashes.has(m.sha256));
    if (
      mods.some(
        (m) => !m.source || m.source.provider !== (format === 'mrpack' ? 'modrinth' : 'curseforge'),
      )
    )
      throw Error(
        '선택한 플랫폼의 출처 정보가 없는 모드가 있습니다. 재배포 권한을 추정하여 JAR를 포함할 수 없습니다.',
      );
    const zip = new AdmZip();
    for (const m of included)
      zip.addFile(
        'overrides/mods/' + m.file,
        await fs.readFile(contained(path.join(this.store.dir(id), 'mods'), m.file)),
      );
    if (format === 'mrpack') {
      const files = [];
      for (const m of mods) {
        const v = await json('https://api.modrinth.com/v2/version/' + m.source!.version);
        const f = v.files.find((f: any) => f.filename === m.file);
        if (!f) throw Error('플랫폼 원본 파일 확인 실패');
        files.push({
          path: 'mods/' + m.file,
          hashes: { sha1: f.hashes.sha1, sha512: f.hashes.sha512 },
          env: { client: 'required', server: 'optional' },
          downloads: [f.url],
          fileSize: f.size,
        });
      }
      zip.addFile(
        'modrinth.index.json',
        Buffer.from(
          JSON.stringify(
            {
              formatVersion: 1,
              game: 'minecraft',
              versionId: randomUUID(),
              name: i.name,
              files,
              dependencies: {
                minecraft: i.version,
                ...(i.loader === 'vanilla'
                  ? {}
                  : {
                      [i.loader === 'fabric'
                        ? 'fabric-loader'
                        : i.loader === 'quilt'
                          ? 'quilt-loader'
                          : i.loader]: i.loaderVersion,
                    }),
              },
            },
            null,
            2,
          ),
        ),
      );
    } else
      zip.addFile(
        'manifest.json',
        Buffer.from(
          JSON.stringify(
            {
              minecraft: {
                version: i.version,
                modLoaders:
                  i.loader === 'vanilla'
                    ? []
                    : [
                        {
                          id: i.loader + '-' + i.loaderVersion.replace(i.version + '-', ''),
                          primary: true,
                        },
                      ],
              },
              manifestType: 'minecraftModpack',
              manifestVersion: 1,
              name: i.name,
              version: '1.0.0',
              author: 'DKKF user',
              files: mods.map((m) => ({
                projectID: Number(m.source!.project),
                fileID: Number(m.source!.version),
                required: true,
              })),
              overrides: 'overrides',
            },
            null,
            2,
          ),
        ),
      );
    zip.writeZip(file);
    return file;
  }
  async import(file: string, signal: AbortSignal) {
    const zip = new AdmZip(file);
    safeEntries(zip);
    const mr = zip.getEntry('modrinth.index.json');
    const cf = zip.getEntry('manifest.json');
    if (!mr && !cf) throw Error('지원하는 모드팩 매니페스트가 없습니다.');
    const manifest = JSON.parse((mr || cf)!.getData().toString());
    const i: Instance = {
      id: randomUUID(),
      name: z.string().min(1).max(70).parse(manifest.name),
      version: safeId.parse(mr ? manifest.dependencies?.minecraft : manifest.minecraft?.version),
      loader: 'vanilla',
      loaderVersion: '',
      ram: this.store.settings.ram,
      limitRam: this.store.settings.limitRam,
      defaultContent: true,
      created: new Date().toISOString(),
    };
    if (mr) {
      if (manifest.formatVersion !== 1 || manifest.game !== 'minecraft')
        throw Error('미지원 MRPACK 형식');
      const map: any = {
        'fabric-loader': 'fabric',
        'quilt-loader': 'quilt',
        forge: 'forge',
        neoforge: 'neoforge',
      };
      for (const [key, loader] of Object.entries(map))
        if (manifest.dependencies[key]) {
          i.loader = loader as any;
          i.loaderVersion = safeId.parse(manifest.dependencies[key]);
        }
    } else {
      if (manifest.manifestType !== 'minecraftModpack' || manifest.manifestVersion !== 1)
        throw Error('미지원 CurseForge 모드팩 형식');
      const loader = manifest.minecraft.modLoaders.find((l: any) => l.primary);
      if (loader) {
        const match = /^(forge|neoforge|fabric|quilt)-(.+)$/.exec(loader.id);
        if (!match) throw Error('미지원 로더');
        i.loader = match[1] as any;
        i.loaderVersion = safeId.parse(match[2]);
        if (i.loader === 'forge' && !i.loaderVersion.startsWith(i.version + '-'))
          i.loaderVersion = i.version + '-' + i.loaderVersion;
      }
    }
    if (i.version !== serverProfile.minecraft || i.loader !== serverProfile.loader)
      throw Error(
        'DKKF 서버용 모드팩은 Minecraft 26.3 Fabric 형식이어야 합니다. 다른 버전이나 로더의 모드팩은 변환하지 않습니다.',
      );
    this.store.saveInstance(i);
    const root = this.store.dir(i.id);
    await fs.mkdir(root, { recursive: true });
    try {
      if (mr) {
        const files = z
          .array(
            z.object({
              path: z.string(),
              hashes: z.object({ sha1: z.string(), sha512: z.string() }),
              downloads: z.array(z.string()).min(1),
              env: z.object({ client: z.string() }).optional(),
            }),
          )
          .max(10000)
          .parse(manifest.files);
        const sources: Record<string, Mod['source']> = {};
        for (const f of files) {
          if (f.env?.client === 'unsupported') continue;
          const dest = contained(root, f.path);
          if (
            !f.path.startsWith('mods/') &&
            !f.path.startsWith('resourcepacks/') &&
            !f.path.startsWith('shaderpacks/') &&
            !f.path.startsWith('config/')
          )
            throw Error('허용되지 않은 모드팩 파일 경로');
          await download(
            f.downloads[0],
            dest,
            { algorithm: 'sha512', value: f.hashes.sha512 },
            signal,
          );
          if (f.path.endsWith('.jar')) {
            try {
              const v = await json(
                `https://api.modrinth.com/v2/version_file/${f.hashes.sha512}?algorithm=sha512`,
              );
              sources[await digest(dest)] = {
                provider: 'modrinth',
                project: v.project_id,
                version: v.id,
              };
            } catch {
              /* Unknown source is retained locally, never silently re-exported. */
            }
          }
        }
        this.store.set('modSources:' + i.id, sources);
      } else
        for (const f of manifest.files) {
          if (f.required === false) continue;
          await this.mods.install(
            i.id,
            'curseforge',
            String(z.number().int().positive().parse(f.projectID)),
            String(z.number().int().positive().parse(f.fileID)),
            signal,
          );
        }
      const prefixes = mr
        ? ['overrides/', 'client-overrides/']
        : [z.string().parse(manifest.overrides).replace(/\/$/, '') + '/'];
      for (const prefix of prefixes) {
        for (const e of zip.getEntries()) {
          if (e.isDirectory || !e.entryName.startsWith(prefix)) continue;
          const name = e.entryName.slice(prefix.length);
          if (
            !/^(mods|config|resourcepacks|shaderpacks)\//.test(name) &&
            !['options.txt', 'servers.dat'].includes(name)
          )
            throw Error('허용되지 않은 overrides 파일: ' + name);
          const dest = contained(root, name);
          await fs.mkdir(path.dirname(dest), { recursive: true });
          try {
            await fs.access(dest);
            throw Error('중복 모드팩 파일: ' + name);
          } catch (err: any) {
            if (err.code !== 'ENOENT') throw err;
          }
          await fs.writeFile(dest, e.getData(), { flag: 'wx' });
        }
      }
      this.store.set('packs', [...this.store.get<string[]>('packs', []), i.id]);
      return i;
    } catch (e) {
      this.store.set(
        'instances',
        this.store.instances.filter((n) => n.id !== i.id),
      );
      this.store.set('modSources:' + i.id, {});
      await fs.rm(root, { recursive: true, force: true });
      throw e;
    }
  }
}
