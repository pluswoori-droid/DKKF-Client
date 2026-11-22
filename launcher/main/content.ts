import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import AdmZip from 'adm-zip';
import type { Store } from './store';
import type { ContentItem, Instance, Mod } from '../../shared/types';
import { contained, digest } from './security';
import { extract, safeEntries } from './archive';
import { download, json } from './network';
import type { Mods } from './mods';

type Kind = 'resourcepack' | 'shader' | 'world';
const directories = { resourcepack: 'resourcepacks', shader: 'shaderpacks', world: 'saves' };
const mr = 'https://api.modrinth.com/v2';
const label = { resourcepack: '리소스팩', shader: '쉐이더팩', world: '월드' };
export class Content {
  constructor(
    private store: Store,
    private readJson: typeof json = json,
    private downloadFile: typeof download = download,
    private mods?: Pick<Mods, 'list' | 'detail' | 'install'>,
  ) {}
  private directory(id: string, kind: Kind) {
    return path.join(this.store.dir(id), directories[kind]);
  }
  private async text(file: string) {
    try {
      return await fs.readFile(file, 'utf8');
    } catch (e: any) {
      if (e.code === 'ENOENT') return '';
      throw e;
    }
  }
  private async writeText(file: string, value: string) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = file + '.' + randomUUID() + '.tmp';
    try {
      await fs.writeFile(temp, value, { flag: 'wx' });
      await fs.rename(temp, file);
    } finally {
      await fs.rm(temp, { force: true });
    }
  }
  private replaceOption(text: string, key: string, value: string, separator: ':' | '=') {
    const lines = text.split(/\r?\n/).filter((line) => !line.startsWith(key + separator));
    while (lines.at(-1) === '') lines.pop();
    return [...lines, key + separator + value, ''].join('\n');
  }
  private resources(text: string): string[] {
    const value = text
      .split(/\r?\n/)
      .find((line) => line.startsWith('resourcePacks:'))
      ?.slice(14);
    if (!value) return ['vanilla'];
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== 'string'))
      throw Error('기존 resourcePacks 설정을 읽을 수 없습니다.');
    return parsed;
  }
  async list(id: string, kind: Kind): Promise<ContentItem[]> {
    const directory = this.directory(id, kind);
    await fs.mkdir(directory, { recursive: true });
    const sources = this.store.get<
      Record<string, { name: string; version: string; source: Mod['source'] }>
    >('contentSources:' + id, {});
    let selected: string[] = [],
      iris = '';
    const settingsWarnings: string[] = [];
    if (kind === 'resourcepack') {
      try {
        selected = this.resources(await this.text(path.join(this.store.dir(id), 'options.txt')));
      } catch {
        settingsWarnings.push('게임의 리소스팩 선택 설정을 읽지 못했습니다.');
      }
    }
    if (kind === 'shader')
      iris = await this.text(path.join(this.store.dir(id), 'config', 'iris.properties'));
    const activeShader = iris
      .split(/\r?\n/)
      .find((l) => l.startsWith('shaderPack='))
      ?.slice(11);
    const enabledShader = !iris.split(/\r?\n/).some((l) => l === 'enableShaders=false');
    const out: ContentItem[] = [];
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const file = contained(directory, entry.name);
      if (entry.isDirectory()) {
        const required =
          kind === 'world' ? 'level.dat' : kind === 'resourcepack' ? 'pack.mcmeta' : 'shaders';
        if (!(await fs.stat(path.join(file, required)).catch(() => undefined))) continue;
      } else if (!entry.isFile() || kind === 'world' || !entry.name.toLowerCase().endsWith('.zip'))
        continue;
      const meta = entry.isFile() ? sources[await digest(file)] : undefined;
      out.push({
        kind,
        file: entry.name,
        name: meta?.name || entry.name.replace(/\.zip$/i, ''),
        version: meta?.version,
        source: meta?.source,
        size: entry.isFile() ? (await fs.stat(file)).size : 0,
        enabled:
          kind === 'resourcepack'
            ? selected.includes('file/' + entry.name)
            : kind === 'shader'
              ? activeShader === entry.name && enabledShader
              : undefined,
        warnings: [...settingsWarnings],
      });
    }
    return out;
  }
  async activate(id: string, kind: Kind, file: string, enabled: boolean) {
    if (kind === 'world') throw Error('월드는 게임의 싱글플레이 화면에서 엽니다.');
    if (!(await this.list(id, kind)).some((item) => item.file === file))
      throw Error('설치된 콘텐츠를 찾을 수 없습니다.');
    if (kind === 'resourcepack') {
      const options = path.join(this.store.dir(id), 'options.txt'),
        text = await this.text(options),
        packs = this.resources(text);
      const key = 'file/' + file,
        updated = packs.filter((p) => p !== key);
      if (enabled) updated.push(key);
      await this.writeText(
        options,
        this.replaceOption(text, 'resourcePacks', JSON.stringify(updated), ':'),
      );
    } else {
      const options = path.join(this.store.dir(id), 'config', 'iris.properties');
      let text = await this.text(options);
      const current = text
        .split(/\r?\n/)
        .find((l) => l.startsWith('shaderPack='))
        ?.slice(11);
      if (enabled) text = this.replaceOption(text, 'shaderPack', file, '=');
      if (enabled || current === file)
        text = this.replaceOption(text, 'enableShaders', String(enabled), '=');
      await this.writeText(options, text);
    }
  }
  async remove(id: string, kind: Kind, file: string) {
    const item = (await this.list(id, kind)).find((c) => c.file === file);
    if (!item) throw Error('콘텐츠가 없습니다.');
    if (item.enabled) await this.activate(id, kind, file, false);
    const backup = path.join(this.store.dir(id), 'content-backups', kind);
    await fs.mkdir(backup, { recursive: true });
    await fs.rename(
      contained(this.directory(id, kind), file),
      contained(backup, randomUUID() + '-' + file),
    );
  }
  async activateInitial(id: string, kind: 'resourcepack' | 'shader', file: string) {
    if (kind === 'shader') {
      const text = await this.text(path.join(this.store.dir(id), 'config', 'iris.properties'));
      if (
        text.split(/\r?\n/).some((line) => line.startsWith('shaderPack=') && line.slice(11).trim())
      )
        return;
    }
    await this.activate(id, kind, file, true);
  }
  private validatePack(zip: AdmZip, kind: 'resourcepack' | 'shader') {
    safeEntries(zip);
    if (kind === 'resourcepack') {
      const meta = zip.getEntry('pack.mcmeta');
      if (!meta || meta.header.size > 1024 * 1024 || !JSON.parse(meta.getData().toString()).pack)
        throw Error('루트에 유효한 pack.mcmeta가 필요합니다.');
    } else if (
      !zip
        .getEntries()
        .some(
          (e) =>
            !e.isDirectory &&
            /^shaders\/.+\.(?:fsh|vsh|glsl|csh|properties|json)$/i.test(e.entryName),
        )
    )
      throw Error('shaders 폴더가 있는 쉐이더팩 ZIP이 필요합니다.');
  }
  async import(id: string, kind: Kind, file: string) {
    const stat = await fs.lstat(file);
    if (stat.isSymbolicLink()) throw Error('링크 파일은 가져올 수 없습니다.');
    if (kind === 'world') return this.importWorld(id, file);
    if (!stat.isFile() || stat.size > 512 * 1024 ** 2 || !file.toLowerCase().endsWith('.zip'))
      throw Error('512 MiB 이하 ZIP 파일을 선택하세요.');
    this.validatePack(new AdmZip(file), kind);
    const directory = this.directory(id, kind);
    await fs.mkdir(directory, { recursive: true });
    const name = path.basename(file);
    const dest = contained(directory, name);
    const hash = await digest(file);
    const existing = (await this.list(id, kind)).find((c) => c.file === name);
    if (existing && (await digest(dest)) === hash) return name;
    await fs.copyFile(file, dest, fs.constants.COPYFILE_EXCL);
    return name;
  }
  private async importWorld(id: string, file: string) {
    const root = this.store.dir(id),
      stage = path.join(root, 'world-stage-' + randomUUID());
    await fs.mkdir(stage, { recursive: true });
    try {
      const stat = await fs.lstat(file);
      if (stat.isDirectory()) {
        let total = 0,
          count = 0;
        const inspect = async (directory: string): Promise<void> => {
          for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
            if (++count > 20000 || entry.isSymbolicLink())
              throw Error('월드 파일 수 제한 또는 링크 파일 포함');
            const full = contained(directory, entry.name);
            if (entry.isDirectory()) await inspect(full);
            else {
              total += (await fs.stat(full)).size;
              if (total > 1024 ** 3) throw Error('월드 크기 1 GiB 제한');
              this.worldFile(entry.name);
            }
          }
        };
        await inspect(file);
        await fs.access(path.join(file, 'level.dat'));
        await fs.cp(file, stage, { recursive: true, errorOnExist: false });
      } else {
        if (!stat.isFile() || stat.size > 512 * 1024 ** 2 || !file.toLowerCase().endsWith('.zip'))
          throw Error('월드 폴더 또는 512 MiB 이하 ZIP을 선택하세요.');
        const zip = new AdmZip(file);
        safeEntries(zip);
        const levels = zip
          .getEntries()
          .filter((e) => !e.isDirectory && /(?:^|\/)level\.dat$/.test(e.entryName));
        if (levels.length !== 1 || levels[0].header.size < 1)
          throw Error('level.dat가 하나인 Java Edition 월드 ZIP이 필요합니다.');
        const prefix = levels[0].entryName.slice(0, -'level.dat'.length);
        await extract(zip, stage, prefix, (name) => {
          this.worldFile(name);
          return true;
        });
      }
      const level = await fs.stat(path.join(stage, 'level.dat'));
      if (!level.isFile() || !level.size) throw Error('유효한 level.dat가 없습니다.');
      if (level.size > 16 * 1024 ** 2) throw Error('level.dat 크기 제한을 초과합니다.');
      const levelBytes = await fs.readFile(path.join(stage, 'level.dat'));
      if (
        levelBytes[0] !== 0x1f ||
        levelBytes[1] !== 0x8b ||
        gunzipSync(levelBytes, { maxOutputLength: 16 * 1024 ** 2 })[0] !== 10
      )
        throw Error('Java Edition의 압축된 NBT level.dat가 필요합니다.');
      const directory = this.directory(id, 'world');
      await fs.mkdir(directory, { recursive: true });
      const raw =
        path
          .basename(file)
          .replace(/\.zip$/i, '')
          .replace(/[^\p{L}\p{N}_ -]/gu, '')
          .slice(0, 60) || 'World';
      let name = raw;
      if (await fs.stat(contained(directory, name)).catch(() => undefined))
        name += '-' + randomUUID().slice(0, 8);
      await fs.rename(stage, contained(directory, name));
      return name;
    } finally {
      await fs.rm(stage, { recursive: true, force: true });
    }
  }
  private worldFile(name: string) {
    if (/\.(?:exe|dll|jar|bat|cmd|ps1|vbs|lnk|scr|com|msi)$/i.test(name))
      throw Error('월드에 실행 파일이 포함되어 있습니다.');
  }
  async search(
    kind: 'resourcepack' | 'shader',
    query: string,
    instance: Instance,
    sort = 'relevance',
  ) {
    return (await this.searchPage(kind, query, instance, sort)).hits;
  }
  async searchPage(
    kind: 'resourcepack' | 'shader',
    query: string,
    instance: Instance,
    sort = 'relevance',
    offset = 0,
  ) {
    const facets = [[`project_type:${kind}`], [`versions:${instance.version}`]];
    if (kind === 'shader') facets.push(['categories:iris']);
    const data = await this.readJson(
      mr +
        '/search?' +
        new URLSearchParams({
          query,
          facets: JSON.stringify(facets),
          limit: '30',
          offset: String(offset),
          index: sort,
        }),
    );
    const hits = data.hits.map((p: any) => ({
      id: p.project_id,
      title: p.title,
      description: p.description,
      author: p.author,
      downloads: p.downloads,
      icon: p.icon_url,
      provider: 'modrinth',
    }));
    const total = Number(data.total_hits ?? offset + hits.length);
    return { hits, total, offset, limit: 30, hasMore: offset + hits.length < total };
  }
  async detail(kind: 'resourcepack' | 'shader', project: string, instance: Instance) {
    const p = await this.readJson(mr + '/project/' + encodeURIComponent(project));
    if (p.project_type !== kind) throw Error('콘텐츠 유형이 일치하지 않습니다.');
    const versions = await this.readJson(
      mr +
        '/project/' +
        encodeURIComponent(p.id) +
        '/version?' +
        new URLSearchParams({
          game_versions: JSON.stringify([instance.version]),
          ...(kind === 'shader' ? { loaders: JSON.stringify(['iris']) } : {}),
        }),
    );
    return {
      project: p,
      versions: versions.map((v: any) => ({ id: v.id, name: v.name, version: v.version_number })),
      license: p.license?.name,
      url: `https://modrinth.com/${kind}/${p.slug}`,
    };
  }
  async install(
    id: string,
    kind: 'resourcepack' | 'shader',
    project: string,
    version: string,
    signal: AbortSignal,
    preserveExisting = false,
    ancestry = new Set<string>(),
  ): Promise<string> {
    const instance = this.store.instance(id),
      info = await this.detail(kind, project, instance);
    const existing = (await this.list(id, kind)).find((c) => c.source?.project === info.project.id);
    if (preserveExisting && existing) return existing.file;
    if (ancestry.has(info.project.id)) throw Error('순환 콘텐츠 의존성');
    ancestry = new Set([...ancestry, info.project.id]);
    const v = await this.readJson(mr + '/version/' + encodeURIComponent(version));
    if (
      v.project_id !== info.project.id ||
      !v.game_versions.includes(instance.version) ||
      (kind === 'shader' && !v.loaders.includes('iris'))
    )
      throw Error('호환되지 않는 콘텐츠 버전');
    const required = (v.dependencies || []).filter((d: any) => d.dependency_type === 'required');
    for (const dependency of required) {
      const pinned = dependency.version_id
        ? await this.readJson(mr + '/version/' + encodeURIComponent(dependency.version_id))
        : undefined;
      const pid = dependency.project_id || pinned?.project_id;
      if (!pid || (pinned && dependency.project_id && pinned.project_id !== dependency.project_id))
        throw Error('수동 설치가 필요한 콘텐츠 의존성');
      const p = await this.readJson(mr + '/project/' + encodeURIComponent(pid));
      if (p.project_type === 'mod') {
        if (!this.mods) throw Error('모드 의존성을 먼저 설치하세요: ' + p.title);
        const installed = (await this.mods.list(id)).find((m) => m.source?.project === p.id);
        if (installed) {
          if (!installed.enabled || (pinned && installed.source?.version !== pinned.id))
            throw Error('기존 필수 모드와 충돌합니다: ' + installed.name);
        } else {
          const detail = await this.mods.detail('modrinth', p.id, instance);
          const selected = pinned?.id || detail.versions[0]?.id;
          if (!selected) throw Error('필수 모드의 호환 버전 없음: ' + p.title);
          await this.mods.install(id, 'modrinth', p.id, selected, signal, true);
        }
      } else if (p.project_type === 'resourcepack' || p.project_type === 'shader') {
        const detail = await this.detail(p.project_type, p.id, instance);
        const selected = pinned?.id || detail.versions[0]?.id;
        if (!selected) throw Error('필수 콘텐츠의 호환 버전 없음: ' + p.title);
        await this.install(id, p.project_type, p.id, selected, signal, true, ancestry);
      } else throw Error('지원하지 않는 필수 콘텐츠 유형: ' + p.project_type);
    }
    if (
      kind === 'shader' &&
      this.mods &&
      ['fabric', 'quilt'].includes(instance.loader) &&
      !(await this.mods.list(id)).some((m) => m.enabled && m.id === 'iris')
    ) {
      const iris = await this.mods.detail('modrinth', 'YL57xq9U', instance);
      if (!iris.versions.length) throw Error('쉐이더에 필요한 Iris의 호환 버전이 없습니다.');
      await this.mods.install(id, 'modrinth', iris.project.id, iris.versions[0].id, signal, true);
      if (!(await this.mods.list(id)).some((m) => m.enabled && m.id === 'iris'))
        throw Error('기존 Iris가 비활성화되어 있습니다.');
    }
    const f = v.files.find((f: any) => f.primary) || v.files[0];
    if (
      !f?.filename.toLowerCase().endsWith('.zip') ||
      !f.hashes?.sha512 ||
      f.size > 512 * 1024 ** 2
    )
      throw Error('지원하는 콘텐츠 ZIP 파일이 아닙니다.');
    const stage = path.join(this.store.dir(id), 'content-stage-' + randomUUID());
    await fs.mkdir(stage, { recursive: true });
    const file = contained(stage, f.filename);
    try {
      await this.downloadFile(f.url, file, { algorithm: 'sha512', value: f.hashes.sha512 }, signal);
      if ((await fs.stat(file)).size !== f.size) throw Error('콘텐츠 파일 크기 불일치');
      this.validatePack(new AdmZip(file), kind);
      const hash = await digest(file),
        name = path.basename(file),
        directory = this.directory(id, kind);
      await fs.mkdir(directory, { recursive: true });
      const sources = this.store.get<Record<string, unknown>>('contentSources:' + id, {});
      const previous = (await this.list(id, kind)).filter(
        (c) => c.source?.project === info.project.id,
      );
      const optionsFile = path.join(
        this.store.dir(id),
        kind === 'resourcepack' ? 'options.txt' : 'config/iris.properties',
      );
      const optionsExisted = !!(await fs.stat(optionsFile).catch(() => undefined)),
        oldOptions = await this.text(optionsFile);
      const backup = path.join(this.store.dir(id), 'content-backups', kind);
      await fs.mkdir(backup, { recursive: true });
      const moved: { original: string; backup: string }[] = [];
      let copied = false,
        optionsChanged = false;
      try {
        for (const old of previous) {
          const original = contained(directory, old.file),
            saved = contained(backup, randomUUID() + '-' + old.file);
          await fs.rename(original, saved);
          moved.push({ original, backup: saved });
        }
        await fs.copyFile(file, contained(directory, name), fs.constants.COPYFILE_EXCL);
        copied = true;
        if (kind === 'resourcepack') {
          const packs = this.resources(oldOptions).filter(
            (p) => !previous.some((c) => 'file/' + c.file === p),
          );
          if (previous.some((c) => c.enabled)) packs.push('file/' + name);
          if (previous.length) {
            await this.writeText(
              optionsFile,
              this.replaceOption(oldOptions, 'resourcePacks', JSON.stringify(packs), ':'),
            );
            optionsChanged = true;
          }
        } else if (previous.some((c) => c.enabled)) {
          await this.writeText(
            optionsFile,
            this.replaceOption(
              this.replaceOption(oldOptions, 'shaderPack', name, '='),
              'enableShaders',
              'true',
              '=',
            ),
          );
          optionsChanged = true;
        }
        this.store.set('contentSources:' + id, {
          ...sources,
          [hash]: {
            name: info.project.title,
            version: v.version_number,
            source: { provider: 'modrinth', project: v.project_id, version: v.id },
          },
        });
      } catch (error) {
        if (copied) await fs.rm(contained(directory, name), { force: true });
        for (const old of moved) await fs.rename(old.backup, old.original);
        if (optionsChanged) {
          if (optionsExisted) await this.writeText(optionsFile, oldOptions);
          else await fs.rm(optionsFile, { force: true });
        }
        throw error;
      }
      return name;
    } finally {
      await fs.rm(stage, { recursive: true, force: true });
    }
  }
  async folder(id: string, kind: Kind) {
    const directory = this.directory(id, kind);
    await fs.mkdir(directory, { recursive: true });
    return directory;
  }
}
