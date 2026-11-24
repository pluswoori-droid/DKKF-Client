import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import type { Store } from './store';
import type { Mods } from './mods';
import type { Content } from './content';
import type { Mod, PresetReport } from '../../shared/types';
import profile from '../../shared/server-profile.json';
import { contained, digest } from './security';
import { download } from './network';
import { safeEntries } from './archive';

/** Required server profile, shared by pack installation and game launch. */
export class DefaultContent {
  constructor(
    private store: Store,
    private mods: Mods,
    _content: Content,
    private progress: (message: string, current: number, total: number) => void,
    private resources: string,
  ) {}
  report(id: string): PresetReport {
    this.store.instance(id);
    const saved = this.store.get<PresetReport>('defaultContent:' + id, {
      revision: 630,
      completed: false,
      items: [],
    });
    return saved.revision === 630 ? saved : { revision: 630, completed: false, items: [] };
  }
  async ensure(id: string, signal: AbortSignal, _retry = false) {
    const instance = this.store.instance(id);
    const report: PresetReport = { revision: 630, completed: false, items: [] };
    if (instance.version !== profile.minecraft || instance.loader !== profile.loader) {
      report.items.push({
        project: 'dkkf-server',
        name: 'DKKF 서버 구성',
        kind: 'mod',
        status: 'unsupported',
        message: 'Minecraft 26.3 Fabric 인스턴스가 필요합니다.',
      });
      this.store.set('defaultContent:' + id, report);
      return report;
    }
    const original = await this.mods.list(id);
    const prepared: { spec: (typeof profile.mods)[number]; file: string }[] = [];
    // Prepare every file before altering existing mods, so download failures preserve the pack.
    for (const [index, spec] of profile.mods.entries()) {
      signal.throwIfAborted();
      this.progress(spec.name + ' 서버 필수 버전 준비', index, profile.mods.length);
      const file = spec.url
        ? contained(path.join(this.store.root, 'cache', 'server-mods', spec.sha256), spec.file)
        : contained(path.join(this.resources, 'server-mods'), spec.file);
      if (spec.url)
        await download(spec.url, file, { algorithm: 'sha256', value: spec.sha256 }, signal);
      if ((await digest(file)) !== spec.sha256) throw Error(spec.name + ' 무결성 검사 실패');
      const zip = new AdmZip(file);
      safeEntries(zip);
      const metadata = zip.getEntry('fabric.mod.json');
      if (!metadata || JSON.parse(metadata.getData().toString()).id !== spec.id)
        throw Error(spec.name + ' 모드 ID 확인 실패');
      const collision = original.find(
        (m) => m.file.replace(/\.disabled$/, '') === spec.file && m.id !== spec.id,
      );
      if (collision)
        throw Error('서버 모드와 같은 파일명을 사용하는 다른 모드가 있습니다: ' + spec.file);
      prepared.push({ spec, file });
    }
    const needsChange =
      original.some((m) => m.id === 'dkkf_core' && m.enabled) ||
      profile.mods.some((spec) => {
        const matches = original.filter((m) => m.id === spec.id);
        return matches.length !== 1 || !matches[0].enabled || matches[0].sha256 !== spec.sha256;
      });
    if (needsChange && original.length) await this.mods.backup(id);
    const hudDir = path.join(this.store.dir(id), 'backups', 'excluded-hud');
    for (const hud of original.filter((m) => m.id === 'dkkf_core' && m.enabled)) {
      await fs.mkdir(hudDir, { recursive: true });
      await fs.copyFile(
        contained(path.join(this.store.dir(id), 'mods'), hud.file),
        contained(hudDir, hud.sha256 + '.jar'),
      );
      await this.mods.remove(id, hud.file);
    }
    for (const { spec, file } of prepared) {
      signal.throwIfAborted();
      const matches = (await this.mods.list(id)).filter((m) => m.id === spec.id);
      const exact = matches.find((m) => m.sha256 === spec.sha256);
      for (const other of matches) if (other !== exact) await this.mods.remove(id, other.file);
      if (exact && !exact.enabled) await this.mods.toggle(id, exact.file);
      if (!exact) {
        await this.mods.import(id, [file]);
        if (spec.source) {
          const sources = this.store.get<Record<string, Mod['source']>>('modSources:' + id, {});
          sources[spec.sha256] = spec.source as Mod['source'];
          this.store.set('modSources:' + id, sources);
        }
      }
      report.items.push({
        project: spec.source?.project ?? spec.id,
        name: spec.name,
        kind: 'mod',
        status: exact?.enabled ? 'preserved' : 'installed',
        message: spec.version + ' · 서버 고정 버전',
      });
    }
    report.completed = true;
    this.store.set('defaultContent:' + id, report);
    this.progress(
      'DKKF 서버 필수 모드 준비 완료 · HUD 제외',
      profile.mods.length,
      profile.mods.length,
    );
    return report;
  }
}
