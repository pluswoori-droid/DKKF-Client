import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { createHash, randomUUID } from 'node:crypto';
import { contained, digest } from './security';
import { json, download } from './network';
import { extract, safeEntries } from './archive';
import type { Store } from './store';
import type { Mod, Instance } from '../../shared/types';
const mr = 'https://api.modrinth.com/v2';
import serverProfile from '../../shared/server-profile.json';
export class Mods {
  constructor(
    private store: Store,
    private secret: (key: string) => Promise<string>,
    private progress?: (message: string, current: number, total: number) => void,
  ) {}
  async list(id: string): Promise<Mod[]> {
    const root = this.store.dir(id);
    const dir = path.join(root, 'mods');
    await fs.mkdir(dir, { recursive: true });
    const out: Mod[] = [];
    const sources = this.store.get<Record<string, Mod['source']>>('modSources:' + id, {});
    for (const file of await fs.readdir(dir)) {
      if (!/\.jar(?:\.disabled)?$/i.test(file)) continue;
      const full = contained(dir, file);
      const sha = await digest(full);
      let meta: any = {};
      const provides: string[] = [];
      const warnings: string[] = [];
      try {
        const zip = new AdmZip(full);
        safeEntries(zip);
        const entry = zip.getEntry('fabric.mod.json') || zip.getEntry('quilt.mod.json');
        if (entry) {
          const raw = JSON.parse(entry.getData().toString());
          meta = raw.quilt_loader ? { ...raw.quilt_loader, ...raw.quilt_loader.metadata } : raw;
          for (const p of meta.provides || []) {
            const value = typeof p === 'string' ? p : p?.id;
            if (typeof value === 'string') provides.push(value);
          }
          let nestedBytes = 0;
          for (const nested of (raw.jars || meta.jars || []).slice(0, 128)) {
            const name = typeof nested === 'string' ? nested : nested?.file;
            if (typeof name !== 'string') continue;
            const entry = zip.getEntry(name);
            if (
              !entry ||
              entry.header.size > 16 * 1024 ** 2 ||
              (nestedBytes += entry.header.size) > 32 * 1024 ** 2
            )
              break;
            const bundled = new AdmZip(entry.getData());
            const manifest = bundled.getEntry('fabric.mod.json');
            if (!manifest || manifest.header.size > 256 * 1024) continue;
            const data = JSON.parse(manifest.getData().toString());
            if (typeof data.id === 'string') provides.push(data.id);
            for (const p of data.provides || []) if (typeof p === 'string') provides.push(p);
          }
        } else {
          const toml =
            zip.getEntry('META-INF/neoforge.mods.toml') || zip.getEntry('META-INF/mods.toml');
          if (toml) {
            const text = toml.getData().toString();
            meta = {
              id: text.match(/modId\s*=\s*"([^"]+)"/)?.[1],
              name: text.match(/displayName\s*=\s*"([^"]+)"/)?.[1],
              version: text.match(/version\s*=\s*"([^"]+)"/)?.[1],
              authors: [text.match(/authors\s*=\s*"([^"]+)"/)?.[1] || 'Unknown'],
            };
            warnings.push('Forge TOML 의존성 분석 미지원');
          } else warnings.push('알려진 모드 메타데이터 없음');
        }
      } catch {
        warnings.push('JAR 메타데이터를 읽을 수 없음');
      }
      const authors = (Array.isArray(meta.authors) ? meta.authors : []).map((a: any) =>
        typeof a === 'string' ? a : a.name || 'Unknown',
      );
      const deps = Array.isArray(meta.depends)
        ? meta.depends.map((d: any) => d.id)
        : Object.keys(meta.depends || {});
      out.push({
        file,
        id: meta.id || file,
        name: meta.name || meta.id || file,
        version: meta.version || 'Unknown',
        authors,
        enabled: !file.endsWith('.disabled'),
        sha256: sha,
        depends: deps,
        provides,
        source: sources[sha],
        warnings,
      });
    }
    const enabled = out.filter((m) => m.enabled);
    const known = new Set([
      ...enabled.map((m) => m.id),
      ...enabled.flatMap((m) => m.provides || []),
      'minecraft',
      'java',
      this.store.instance(id).loader === 'quilt' ? 'quilt_loader' : 'fabricloader',
      this.store.instance(id).loader,
    ]);
    for (const m of out) {
      if (enabled.filter((n) => n.id === m.id).length > 1) m.warnings.push('동일 모드 ID 중복');
      if (out.filter((n) => n.sha256 === m.sha256).length > 1) m.warnings.push('동일 파일 중복');
      if (m.enabled)
        for (const dep of m.depends)
          if (!known.has(dep)) m.warnings.push('필수 의존성 누락: ' + dep);
    }
    return out;
  }
  async import(id: string, files: string[]) {
    const dir = path.join(this.store.dir(id), 'mods');
    await fs.mkdir(dir, { recursive: true });
    for (const f of files) {
      if (path.extname(f).toLowerCase() !== '.jar') throw Error('JAR 파일만 가져올 수 있습니다.');
      if ((await fs.stat(f)).size > 256 * 1024 ** 2) throw Error('JAR 크기 제한 초과');
      const z = new AdmZip(f);
      safeEntries(z);
      await fs.copyFile(f, contained(dir, path.basename(f)), fs.constants.COPYFILE_EXCL);
    }
    return this.list(id);
  }
  async toggle(id: string, file: string) {
    if (!/\.jar(?:\.disabled)?$/.test(file)) throw Error('JAR 파일명 오류');
    const dir = path.join(this.store.dir(id), 'mods');
    const next = file.endsWith('.disabled') ? file.slice(0, -9) : file + '.disabled';
    await fs.copyFile(contained(dir, file), contained(dir, next), fs.constants.COPYFILE_EXCL);
    await fs.rm(contained(dir, file));
  }
  async remove(id: string, file: string) {
    if (!/\.jar(?:\.disabled)?$/.test(file)) throw Error('JAR 파일명 오류');
    await fs.rm(contained(path.join(this.store.dir(id), 'mods'), file));
  }
  async backup(id: string) {
    const root = this.store.dir(id);
    const zip = new AdmZip();
    const dir = path.join(root, 'mods');
    await fs.mkdir(dir, { recursive: true });
    zip.addLocalFolder(dir);
    await fs.mkdir(path.join(root, 'backups'), { recursive: true });
    const name = new Date().toISOString().replaceAll(':', '-') + '.zip';
    zip.writeZip(path.join(root, 'backups', name));
    return name;
  }
  async restore(id: string, name: string) {
    const root = this.store.dir(id);
    const zip = new AdmZip(contained(path.join(root, 'backups'), name));
    safeEntries(zip);
    const stage = path.join(root, 'restore-' + randomUUID());
    await fs.mkdir(stage);
    try {
      await extract(zip, stage, '', (n) => /\.jar(?:\.disabled)?$/.test(n));
      await this.backup(id);
      const old = path.join(root, 'mods.old');
      await fs.rm(old, { recursive: true, force: true });
      await fs.rename(path.join(root, 'mods'), old);
      try {
        await fs.rename(stage, path.join(root, 'mods'));
      } catch (e) {
        await fs.rename(old, path.join(root, 'mods'));
        throw e;
      }
      await fs.rm(old, { recursive: true });
    } finally {
      await fs.rm(stage, { recursive: true, force: true });
    }
  }
  private async cf(endpoint: string) {
    const key = await this.secret('curseforge');
    if (!key) throw Error('Settings에서 CurseForge API 키를 저장하세요.');
    return json('https://api.curseforge.com/v1' + endpoint, { headers: { 'x-api-key': key } });
  }
  async search(
    provider: string,
    query: string,
    i: Instance | undefined,
    sort = 'relevance',
    category = '',
  ) {
    return (await this.searchPage(provider, query, i, sort, category)).hits;
  }
  async searchPage(
    provider: string,
    query: string,
    i: Instance | undefined,
    sort = 'relevance',
    category = '',
    offset = 0,
  ) {
    if (provider === 'modrinth') {
      const facets = [['project_type:mod']];
      if (i) {
        facets.push(['versions:' + i.version]);
        if (i.loader !== 'vanilla') facets.push(['categories:' + i.loader]);
      }
      if (category) facets.push(['categories:' + category]);
      const d = await json(
        mr +
          '/search?' +
          new URLSearchParams({
            query,
            limit: '30',
            offset: String(offset),
            index: sort,
            facets: JSON.stringify(facets),
          }),
      );
      const hits = d.hits.map((m: any) => ({
        id: m.project_id,
        title: m.title,
        description: m.description,
        author: m.author,
        downloads: m.downloads,
        icon: m.icon_url,
        provider,
      }));
      const total = Number(d.total_hits ?? offset + hits.length);
      return { hits, total, offset, limit: 30, hasMore: offset + hits.length < total };
    }
    const loaderId = { vanilla: 0, forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
    const d = await this.cf(
      '/mods/search?' +
        new URLSearchParams({
          gameId: '432',
          classId: '6',
          searchFilter: query,
          pageSize: '30',
          index: String(offset),
          sortField: sort === 'newest' ? '11' : sort === 'downloads' ? '6' : '2',
          sortOrder: 'desc',
          ...(i ? { gameVersion: i.version, modLoaderType: String(loaderId[i.loader]) } : {}),
        }),
    );
    const hits = d.data.map((m: any) => ({
      id: String(m.id),
      title: m.name,
      description: m.summary,
      author: m.authors.map((a: any) => a.name).join(', '),
      downloads: m.downloadCount,
      icon: m.logo?.thumbnailUrl,
      provider,
    }));
    const total = Number(d.pagination?.totalCount ?? offset + hits.length);
    return { hits, total, offset, limit: 30, hasMore: offset + hits.length < total };
  }
  async detail(provider: string, project: string, i: Instance) {
    if (provider === 'modrinth') {
      const [p, v] = await Promise.all([
        json(mr + '/project/' + encodeURIComponent(project)),
        json(
          mr +
            '/project/' +
            encodeURIComponent(project) +
            '/version?' +
            new URLSearchParams({
              game_versions: JSON.stringify([i.version]),
              loaders: JSON.stringify([i.loader]),
            }),
        ),
      ]);
      return {
        project: p,
        versions: v.map((v: any) => ({
          id: v.id,
          name: v.name,
          version: v.version_number,
          published: v.date_published,
        })),
        license: p.license?.name,
        body: p.body,
        url: 'https://modrinth.com/mod/' + p.slug,
      };
    }
    const [p, v] = await Promise.all([
      this.cf('/mods/' + project),
      this.cf(
        `/mods/${project}/files?gameVersion=${encodeURIComponent(i.version)}&modLoaderType=${{ vanilla: 0, forge: 1, fabric: 4, quilt: 5, neoforge: 6 }[i.loader]}`,
      ),
    ]);
    return {
      project: p.data,
      versions: v.data.map((f: any) => ({
        id: String(f.id),
        name: f.displayName,
        version: f.fileName,
      })),
      license: 'CurseForge 프로젝트의 라이선스를 확인하세요.',
      body: p.data.summary,
      url: p.data.links.websiteUrl,
    };
  }
  async install(
    id: string,
    provider: string,
    project: string,
    versionId: string,
    signal: AbortSignal,
    preserveExisting = false,
  ) {
    const i = this.store.instance(id);
    if (i.loader === 'vanilla') throw Error('모드를 설치하려면 로더 인스턴스를 선택하세요.');
    const stage = path.join(this.store.dir(id), 'mod-stage-' + randomUUID());
    await fs.mkdir(stage, { recursive: true });
    const plan: { file: string; sha: string; source: NonNullable<Mod['source']> }[] = [];
    const seen = new Set<string>();
    const active = new Set<string>();
    const activeProjects = new Set<string>();
    const resolvedProjects = new Map<string, string>();
    const before = await this.list(id);
    const resolveMR = async (pid: string, vid?: string, root = false): Promise<void> => {
      const pinned = !!vid;
      const prior = before.find(
        (m) => m.source?.provider === 'modrinth' && m.source.project === pid,
      );
      if (!vid && prior?.source) vid = prior.source.version;
      const key = vid || pid;
      if (active.has(key)) throw Error('순환 모드 의존성');
      if (seen.has(key)) return;
      active.add(key);
      let v = vid
        ? await json(mr + '/version/' + encodeURIComponent(vid))
        : (
            await json(
              mr +
                '/project/' +
                encodeURIComponent(pid) +
                '/version?' +
                new URLSearchParams({
                  game_versions: JSON.stringify([i.version]),
                  loaders: JSON.stringify([i.loader]),
                }),
            )
          )[0];
      if (!v) throw Error('호환 버전 없음: ' + pid);
      if (root) {
        const requested = await json(mr + '/project/' + encodeURIComponent(pid));
        if (requested.id !== v.project_id || requested.project_type !== 'mod')
          throw Error('모드 프로젝트와 버전이 일치하지 않습니다.');
      }
      if (!v.game_versions.includes(i.version) || !v.loaders.includes(i.loader))
        throw Error('호환되지 않는 모드 버전');
      const installed = before.find(
        (m) => m.source?.provider === 'modrinth' && m.source.project === v.project_id,
      );
      const keep = installed && (preserveExisting || (!root && !pinned));
      if (keep) {
        if (!root && (!installed.enabled || (pinned && installed.source!.version !== vid)))
          throw Error('기존 필수 의존성과 충돌합니다. 자동 교체하지 않습니다: ' + installed.name);
      }
      if (activeProjects.has(v.project_id)) throw Error('순환 모드 의존성: ' + v.project_id);
      if (resolvedProjects.has(v.project_id)) {
        if (resolvedProjects.get(v.project_id) !== v.id)
          throw Error('서로 다른 버전을 요구하는 필수 의존성: ' + v.project_id);
        active.delete(key);
        return;
      }
      activeProjects.add(v.project_id);
      for (const dep of v.dependencies || [])
        if (dep.dependency_type === 'required') {
          if (!dep.version_id && !dep.project_id)
            throw Error('수동 설치가 필요한 의존성: ' + dep.file_name);
          await resolveMR(dep.project_id, dep.version_id);
        }
      activeProjects.delete(v.project_id);
      resolvedProjects.set(v.project_id, v.id);
      if (keep) {
        seen.add(key);
        active.delete(key);
        return;
      }
      const f = v.files.find((f: any) => f.primary) || v.files[0];
      if (!f?.filename.endsWith('.jar')) throw Error('JAR 모드 파일이 아닙니다.');
      const dest = contained(stage, f.filename);
      await download(f.url, dest, { algorithm: 'sha512', value: f.hashes.sha512 }, signal);
      const sha = await digest(dest);
      const downloadedZip = new AdmZip(dest);
      safeEntries(downloadedZip);
      const metadata = downloadedZip.getEntry('fabric.mod.json');
      if (metadata) {
        const modId = JSON.parse(metadata.getData().toString()).id;
        const local = before.find(
          (m) =>
            m.id === modId &&
            m.sha256 !== sha &&
            (!m.source || m.source.provider !== 'modrinth' || m.source.project !== v.project_id),
        );
        if (local) throw Error('같은 ID의 기존 모드를 자동 교체하지 않습니다: ' + local.name);
      }
      plan.push({
        file: f.filename,
        sha,
        source: { provider: 'modrinth', project: v.project_id, version: v.id },
      });
      seen.add(key);
      active.delete(key);
    };
    const resolveCF = async (pid: string, vid?: string, root = false): Promise<void> => {
      const key = pid;
      if (active.has(key)) throw Error('순환 모드 의존성');
      if (seen.has(key)) return;
      active.add(key);
      const prior = before.find(
        (m) => m.source?.provider === 'curseforge' && m.source.project === pid,
      );
      if (!vid && prior?.source) vid = prior.source.version;
      const files = vid
        ? null
        : await this.cf(
            `/mods/${pid}/files?gameVersion=${encodeURIComponent(i.version)}&modLoaderType=${{ vanilla: 0, forge: 1, fabric: 4, quilt: 5, neoforge: 6 }[i.loader]}`,
          );
      const f = vid ? (await this.cf(`/mods/${pid}/files/${vid}`)).data : files.data[0];
      if (!f || !f.gameVersions.includes(i.version)) throw Error('호환 버전 없음');
      for (const dep of f.dependencies || [])
        if (dep.relationType === 3) await resolveCF(String(dep.modId));
      if (prior && (preserveExisting || !root)) {
        if (!root && !prior.enabled)
          throw Error('필수 의존성이 비활성화되어 있습니다: ' + prior.name);
        seen.add(key);
        active.delete(key);
        return;
      }
      if (!f.downloadUrl)
        throw Error(
          '제작자가 외부 런처 다운로드를 허용하지 않았습니다. CurseForge에서 직접 받으세요.',
        );
      const h = f.hashes.find((h: any) => h.algo === 1);
      if (!h) throw Error('공식 SHA-1 해시가 없습니다.');
      if (!f.fileName.endsWith('.jar')) throw Error('JAR 파일이 아닙니다.');
      const dest = contained(stage, f.fileName);
      await download(f.downloadUrl, dest, { algorithm: 'sha1', value: h.value }, signal);
      plan.push({
        file: f.fileName,
        sha: await digest(dest),
        source: { provider: 'curseforge', project: pid, version: String(f.id) },
      });
      seen.add(key);
      active.delete(key);
    };
    try {
      if (provider === 'modrinth') await resolveMR(project, versionId, true);
      else await resolveCF(project, versionId, true);
      if (!plan.length) return this.list(id);
      const dir = path.join(this.store.dir(id), 'mods');
      await fs.mkdir(dir, { recursive: true });
      const installed = await this.list(id);
      const oldSources = this.store.get<Record<string, Mod['source']>>('modSources:' + id, {});
      const sources = { ...oldSources };
      const replaced = installed.filter(
        (m) =>
          m.source &&
          plan.some(
            (p) =>
              p.source.project === m.source!.project && p.source.provider === m.source!.provider,
          ),
      );
      await this.backup(id);
      const added: string[] = [];
      const removed: Mod[] = [];
      try {
        for (const m of replaced) {
          await fs.rename(contained(dir, m.file), contained(stage, 'old-' + m.file));
          removed.push(m);
        }
        for (const p of plan) {
          const existing = installed.find((m) => m.sha256 === p.sha);
          if (existing && !replaced.includes(existing)) continue;
          const dest = contained(dir, p.file);
          await fs.copyFile(contained(stage, p.file), dest, fs.constants.COPYFILE_EXCL);
          added.push(dest);
          sources[p.sha] = p.source;
        }
        this.store.set('modSources:' + id, sources);
      } catch (e) {
        for (const f of added) await fs.rm(f, { force: true });
        for (const m of removed)
          await fs.rename(contained(stage, 'old-' + m.file), contained(dir, m.file));
        throw e;
      }
    } finally {
      await fs.rm(stage, { recursive: true, force: true });
    }
    return this.list(id);
  }
  async ensureDependencies(id: string, signal: AbortSignal, force = false) {
    this.progress?.('설치된 모드의 필수 의존성 확인', 0, 0);
    const instance = this.store.instance(id);
    const before = (await this.list(id)).filter((m) => m.enabled);
    const serverPinned = (m: Mod) =>
      instance.version === serverProfile.minecraft &&
      instance.loader === serverProfile.loader &&
      serverProfile.mods.some((spec) => spec.id === m.id && spec.sha256 === m.sha256);
    const fingerprint = (mods: Mod[]) =>
      createHash('sha256')
        .update(
          'dependencies-v3:' +
            instance.version +
            ':' +
            instance.loader +
            ':' +
            mods
              .filter((m) => m.enabled)
              .map((m) => m.sha256)
              .sort()
              .join(':'),
        )
        .digest('hex');
    const cached = this.store.get<any>('dependencyCheck:' + id, undefined);
    if (!force && cached?.fingerprint === fingerprint(before) && cached.complete) return cached;
    const warnings: string[] = [];
    if (instance.loader === 'vanilla')
      return {
        installed: [],
        unresolved: [],
        warnings: ['모드 의존성은 로더 인스턴스에서 설치합니다.'],
      };
    const sources = this.store.get<Record<string, Mod['source']>>('modSources:' + id, {});
    const unknown = this.store.get<Record<string, boolean>>('unmappedMods:' + id, {});
    const candidates = before.filter(
      (m) => !serverPinned(m) && !m.source && (force || !unknown[m.sha256]),
    );
    try {
      for (let n = 0; n < candidates.length; n += 100) {
        signal.throwIfAborted();
        const batch = candidates.slice(n, n + 100),
          hashes: string[] = [];
        for (const m of batch)
          hashes.push(
            await digest(contained(path.join(this.store.dir(id), 'mods'), m.file), 'sha512'),
          );
        const versions = await json(mr + '/version_files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hashes, algorithm: 'sha512' }),
          signal,
        });
        for (let j = 0; j < batch.length; j++) {
          const v = versions[hashes[j]];
          if (v && v.files?.some((file: any) => file.hashes?.sha512 === hashes[j]))
            sources[batch[j].sha256] = {
              provider: 'modrinth',
              project: v.project_id,
              version: v.id,
            };
          else unknown[batch[j].sha256] = true;
        }
      }
      this.store.set('modSources:' + id, sources);
      this.store.set('unmappedMods:' + id, unknown);
    } catch (error) {
      signal.throwIfAborted();
      warnings.push('로컬 모드의 공식 출처 확인 실패: ' + (error as Error).message);
    }
    // Exact server-profile files have locally verified Fabric manifests. Their required IDs
    // are checked below; they do not require a CurseForge API key to re-fetch metadata.
    const roots = (await this.list(id)).filter((m) => m.enabled && m.source && !serverPinned(m));
    for (const [index, m] of roots.entries()) {
      this.progress?.(m.name + ' 필수 의존성 준비', index, roots.length);
      signal.throwIfAborted();
      try {
        await this.install(
          id,
          m.source!.provider,
          m.source!.project,
          m.source!.version,
          signal,
          true,
        );
      } catch (error) {
        signal.throwIfAborted();
        warnings.push(m.name + ': ' + (error as Error).message);
      }
    }
    const common: Record<string, string> = {
      'fabric-api': 'P7dR8mSH',
      fabric: 'P7dR8mSH',
      'cloth-config': '9s6osm5g',
      cloth_config: '9s6osm5g',
      'fabric-language-kotlin': 'Ha28R6CL',
      architectury: 'lhGA9TYQ',
      modmenu: 'mOgUt4GM',
    };
    const attempted = new Set<string>();
    for (let pass = 0; pass < 3; pass++) {
      const list = await this.list(id),
        provided = new Set(
          list.filter((m) => m.enabled).flatMap((m) => [m.id, ...(m.provides || [])]),
        );
      const missing = list
        .filter((m) => m.enabled)
        .flatMap((m) => m.depends)
        .filter((dep) => common[dep] && !provided.has(dep) && !attempted.has(common[dep]));
      if (!missing.length) break;
      for (const dep of missing) {
        const project = common[dep];
        if (attempted.has(project)) continue;
        attempted.add(project);
        try {
          const detail = await this.detail('modrinth', project, instance);
          if (!detail.versions[0]) throw Error('호환 배포본이 없습니다.');
          await this.install(
            id,
            'modrinth',
            detail.project.id,
            detail.versions[0].id,
            signal,
            true,
          );
        } catch (error) {
          signal.throwIfAborted();
          warnings.push(dep + ': ' + (error as Error).message);
        }
      }
    }
    const after = await this.list(id);
    const unresolved = after
      .filter((m) => m.enabled)
      .flatMap((m) =>
        m.warnings.filter((w) => w.startsWith('필수 의존성 누락:')).map((w) => m.name + ' · ' + w),
      );
    const installed = after
      .filter((m) => !before.some((old) => old.sha256 === m.sha256))
      .map((m) => m.name);
    const report = {
      fingerprint: fingerprint(after),
      complete: !warnings.length && !unresolved.length,
      installed,
      unresolved,
      warnings,
    };
    this.store.set('dependencyCheck:' + id, report);
    this.progress?.('필수 의존성 확인 완료', roots.length, roots.length);
    return report;
  }
  async updates(id: string) {
    const i = this.store.instance(id);
    const mods = (await this.list(id)).filter((m) => m.source);
    const out = [];
    for (const m of mods) {
      const detail = await this.detail(m.source!.provider, m.source!.project, i);
      if (detail.versions[0] && String(detail.versions[0].id) !== m.source!.version)
        out.push({ file: m.file, name: m.name, source: m.source, latest: detail.versions[0] });
    }
    return out;
  }
}
