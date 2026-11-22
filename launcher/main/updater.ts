import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { json, download } from './network';
import { verifySigned, digest, httpsUrl } from './security';
import type { Store } from './store';
import type { LauncherUpdateStatus } from '../../shared/types';
const payloadSchema = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    channel: z.enum(['stable', 'beta']),
    target: z.literal('launcher'),
    url: z.url(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    size: z
      .number()
      .int()
      .positive()
      .max(1024 ** 3),
    published: z.iso.datetime(),
    notes: z.string().max(10000),
  })
  .strict();
type Payload = z.infer<typeof payloadSchema>;
type Envelope = { payload: unknown; signature: string };
const newer = (a: string, b: string) => {
  const aa = a.split('.').map(Number),
    bb = b.split('.').map(Number);
  for (let n = 0; n < 3; n++) if (aa[n] !== bb[n]) return aa[n] > bb[n];
  return false;
};
export class Updater {
  available?: Payload;
  ready?: string;
  private envelope?: Envelope;
  private checking?: Promise<any>;
  private downloading?: Promise<any>;
  private installing = false;
  private current: LauncherUpdateStatus = { status: 'idle' };
  constructor(
    private store: Store,
    private emit: (type: string, data: any) => void,
    private runtime: {
      version: string;
      packaged: boolean;
      quit: () => void;
      executablePath?: string;
      launchInstaller?: (file: string, args: string[]) => Promise<void>;
      openInstaller?: (file: string) => Promise<string>;
    },
    private readJson: typeof json = json,
    private downloadFile: typeof download = download,
  ) {}
  status() {
    return { ...this.current, canInstall: !!this.ready && !!this.envelope };
  }
  private publish(status: LauncherUpdateStatus) {
    this.current = status;
    const value = this.status();
    this.emit('update', value);
    return value;
  }
  private verify(envelope: Envelope) {
    verifySigned(envelope.payload, envelope.signature, this.store.settings.updateKey);
    const p = payloadSchema.parse(envelope.payload);
    httpsUrl(p.url);
    if (p.channel !== this.store.settings.channel) throw Error('업데이트 채널 불일치');
    return p;
  }
  private target(p: Payload) {
    return path.join(this.store.root, 'updates', p.version, `Dkkf-Launcher-${p.version}-Setup.exe`);
  }
  private async valid(file: string, p: Payload) {
    const stat = await fs.stat(file).catch(() => undefined);
    return !!stat && stat.size === p.size && (await digest(file)) === p.sha256;
  }
  async restore() {
    const handoff = this.store.get<{ version: string; message?: string } | null>(
      'update.handoff',
      null,
    );
    if (handoff && !newer(handoff.version, this.runtime.version))
      this.store.set('update.handoff', null);
    if (!this.store.settings.updateKey) return;
    const root = path.join(this.store.root, 'updates');
    const versions = (await fs.readdir(root).catch(() => []))
      .filter((n) => /^\d+\.\d+\.\d+$/.test(n) && newer(n, this.runtime.version))
      .sort((a, b) => (newer(a, b) ? -1 : 1))
      .slice(0, 20);
    for (const version of versions) {
      try {
        const file = path.join(root, version, 'manifest.json');
        if ((await fs.stat(file)).size > 32000) continue;
        const envelope = JSON.parse(await fs.readFile(file, 'utf8')),
          p = this.verify(envelope);
        if (p.version !== version || !(await this.valid(this.target(p), p))) continue;
        this.available = p;
        this.envelope = envelope;
        this.ready = this.target(p);
        this.publish({
          status: 'ready',
          version: p.version,
          notes: p.notes,
          message: handoff
            ? '이전 업데이트 설치가 완료되지 않았습니다. 설치 프로그램을 다시 열 수 있습니다.'
            : '검증된 업데이트를 복구했습니다. 설치 프로그램을 실행하세요.',
        });
        return;
      } catch {
        /* Untrusted or old caches are never executed. */
      }
    }
  }
  async check(): Promise<any> {
    if (this.downloading) await this.downloading;
    if (this.checking) return this.checking;
    this.checking = this.checkNow();
    try {
      return await this.checking;
    } finally {
      this.checking = undefined;
    }
  }
  private async checkNow() {
    const s = this.store.settings;
    if (!s.updateUrl || !s.updateKey)
      return this.publish({
        status: 'unconfigured',
        message: '배포 서버 HTTPS 주소와 신뢰할 Ed25519 공개키를 설정하세요.',
      });
    this.publish({ status: 'checking', version: this.runtime.version });
    let responseReceived = false;
    try {
      const envelope = await this.readJson(
          s.updateUrl.replace(/\/$/, '') + '/' + s.channel + '.json',
          { headers: { 'Cache-Control': 'no-cache' } },
        ),
        p = ((responseReceived = true), this.verify(envelope));
      if (!newer(p.version, this.runtime.version)) {
        this.available = undefined;
        this.envelope = undefined;
        this.ready = undefined;
        return this.publish({ status: 'current', version: this.runtime.version });
      }
      if (
        this.available?.version !== p.version ||
        this.available?.sha256 !== p.sha256 ||
        this.available?.size !== p.size
      )
        this.ready = undefined;
      this.available = p;
      this.envelope = envelope;
      if (!this.ready && (await this.valid(this.target(p), p))) {
        this.ready = this.target(p);
        await this.saveManifest(p, envelope);
      }
      return this.publish({
        status: this.ready ? 'ready' : 'available',
        version: p.version,
        notes: p.notes,
      });
    } catch (error) {
      if (responseReceived) {
        this.available = undefined;
        this.envelope = undefined;
        this.ready = undefined;
      }
      this.publish({
        status: 'error',
        version: this.available?.version,
        message: (error as Error).message,
      });
      throw error;
    }
  }
  private async saveManifest(p: Payload, envelope: Envelope) {
    const directory = path.dirname(this.target(p));
    await fs.mkdir(directory, { recursive: true });
    const file = path.join(directory, 'manifest.json'),
      temporary = file + '.tmp';
    await fs.writeFile(temporary, JSON.stringify(envelope));
    await fs.rename(temporary, file);
  }
  async fetch(signal: AbortSignal): Promise<any> {
    if (this.downloading) return this.downloading;
    this.downloading = this.fetchNow(signal);
    try {
      return await this.downloading;
    } finally {
      this.downloading = undefined;
    }
  }
  private async fetchNow(signal: AbortSignal) {
    signal.throwIfAborted();
    if (!this.available || !this.envelope) throw Error('검증된 업데이트가 없습니다.');
    const p = this.available,
      envelope = this.envelope,
      target = this.target(p);
    this.ready = undefined;
    this.publish({ status: 'downloading', version: p.version, notes: p.notes });
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      const legacy = path.join(path.dirname(target), 'DKKF-Setup.exe');
      if (!(await this.valid(target, p)) && (await this.valid(legacy, p)))
        await fs.copyFile(legacy, target);
      if (!(await this.valid(target, p)))
        await this.downloadFile(
          p.url,
          target,
          { algorithm: 'sha256', value: p.sha256 },
          signal,
          (n, t) =>
            this.emit('progress', {
              task: 'update',
              message: '런처 업데이트 다운로드',
              current: n,
              total: t,
            }),
          [new URL(p.url).hostname],
        );
      signal.throwIfAborted();
      if (!(await this.valid(target, p))) throw Error('업데이트 파일 해시 또는 크기 불일치');
      this.verify(envelope);
      await this.saveManifest(p, envelope);
      this.ready = target;
      return this.publish({
        status: 'ready',
        version: p.version,
        notes: p.notes,
        message: '다운로드가 완료됐습니다. 설치 프로그램을 열어 업데이트하세요.',
      });
    } catch (error) {
      this.publish({
        status: 'error',
        version: p.version,
        message: signal.aborted ? '업데이트 다운로드를 취소했습니다.' : (error as Error).message,
      });
      throw error;
    }
  }
  async install({ silent = false } = {}) {
    if (this.installing) throw Error('업데이트 설치 프로그램을 실행하는 중입니다.');
    if (!this.ready || !this.available || !this.envelope || !this.runtime.packaged)
      throw Error('패키징된 런처에서만 검증한 설치 프로그램을 실행할 수 있습니다.');
    const p = this.verify(this.envelope),
      file = this.ready;
    if (!newer(p.version, this.runtime.version) || !(await this.valid(file, p)))
      throw Error('설치 직전 해시/버전 검증 실패');
    this.installing = true;
    this.publish({
      status: 'installing',
      version: p.version,
      message: '설치 프로그램을 열고 있습니다…',
    });
    const args = silent ? ['/S', '--updated'] : ['--updated'];
    if (this.runtime.executablePath) args.push('/D=' + path.dirname(this.runtime.executablePath));
    const handoff = {
      version: p.version,
      file,
      attempted: new Date().toISOString(),
      silent,
      installationDirectory: this.runtime.executablePath
        ? path.dirname(this.runtime.executablePath)
        : undefined,
    };
    this.store.set('update.handoff', handoff);
    try {
      if (this.runtime.launchInstaller) await this.runtime.launchInstaller(file, args);
      else {
        try {
          const child = spawn(file, args, {
            detached: true,
            stdio: 'ignore',
            windowsHide: false,
            cwd: path.dirname(file),
          });
          await new Promise<void>((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            child.once('spawn', () => {
              timer = setTimeout(resolve, 1500);
            });
            child.once('error', (error) => {
              clearTimeout(timer);
              reject(error);
            });
            child.once('exit', (code) => {
              clearTimeout(timer);
              if (code !== null && code !== 0)
                reject(Error('설치 프로그램이 종료되었습니다. 코드: ' + code));
              else resolve();
            });
          });
          child.unref();
        } catch (error) {
          if (
            !this.runtime.openInstaller ||
            !['EACCES', 'EPERM', 'ENOENT', 'UNKNOWN'].includes(
              (error as NodeJS.ErrnoException).code || '',
            )
          )
            throw error;
          const message = await this.runtime.openInstaller(file);
          if (message) throw Error(message);
        }
      }
      this.runtime.quit();
    } catch (error) {
      const message = (error as Error).message;
      this.store.set('update.handoff', { ...handoff, message });
      await fs
        .writeFile(
          path.join(path.dirname(file), 'install-error.txt'),
          new Date().toISOString() + '\n' + message + '\n',
        )
        .catch(() => {});
      this.publish({
        status: 'error',
        version: p.version,
        message: '설치 프로그램을 열지 못했습니다: ' + message,
      });
      throw error;
    } finally {
      this.installing = false;
    }
  }
  folder() {
    return this.ready ? path.dirname(this.ready) : path.join(this.store.root, 'updates');
  }
}
