import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { download, request } from './network';
import { extract, safeEntries } from './archive';
export function javaMajor(output: string) {
  const match = output.match(/(?:java|openjdk) version "(?:1\.)?(\d+)/i);
  return match ? Number(match[1]) : undefined;
}
export async function inspectJava(executable: string, minimum: number) {
  try {
    const result = await promisify(execFile)(executable, ['-version'], {
      windowsHide: true, timeout: 5000,
    });
    const major = javaMajor(result.stdout + '\n' + result.stderr);
    return major && major >= minimum ? { path: executable, major } : undefined;
  } catch { return undefined; }
}
export async function discoverJava(minimum: number, managedRoot?: string) {
  const candidates = new Set<string>();
  if (process.env.JAVA_HOME) candidates.add(path.join(process.env.JAVA_HOME, 'bin/java.exe'));
  const programFiles = process.env.ProgramFiles || 'C:/Program Files';
  for (const folder of ['Java', 'Eclipse Adoptium', 'Microsoft', 'Zulu', 'BellSoft']) {
    const root = path.join(programFiles, folder);
    try {
      for (const item of await fs.readdir(root, { withFileTypes: true }))
        if (item.isDirectory()) candidates.add(path.join(root, item.name, 'bin/java.exe'));
    } catch {
      /* Optional vendor is not installed. */
    }
  }
  candidates.add('java');
  if (managedRoot) {
    try {
      for (const entry of await fs.readdir(managedRoot, { withFileTypes: true }))
        if (entry.isDirectory() && !entry.name.endsWith('.part'))
          candidates.add(path.join(managedRoot, entry.name, 'bin/java.exe'));
    } catch { /* No launcher-managed runtime yet. */ }
  }
  const found = await Promise.all(
    [...candidates].map((executable) => inspectJava(executable, minimum)),
  );
  return found
    .filter((v): v is { path: string; major: number } => !!v)
    .sort((a, b) => a.major - b.major)[0];
}

const installing = new Map<string, Promise<{ path: string; major: number }>>();
const runtimeHosts = ['api.adoptium.net', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'];
/** Installs a private ZIP runtime; never changes system Java, PATH or the registry. */
export async function ensureJava(
  minimum: number,
  preferred: string,
  dataRoot: string,
  signal?: AbortSignal,
  progress?: (message: string, current: number, total: number) => void,
) {
  if (!Number.isInteger(minimum) || minimum < 8 || minimum > 100) throw Error('Invalid Java version');
  signal?.throwIfAborted();
  const root = path.join(dataRoot, 'runtimes');
  const found = (preferred && await inspectJava(preferred, minimum)) || await discoverJava(minimum, root);
  if (found) return found;
  const key = root + ':' + minimum;
  const active = installing.get(key);
  if (active) return active;
  const job = (async () => {
    if (process.platform !== 'win32' || !['x64', 'arm64'].includes(process.arch))
      throw Error('Automatic Java installation requires Windows x64 or ARM64.');
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
    progress?.(`Java ${minimum} 다운로드 준비`, 0, 0);
    const response = await request(`https://api.adoptium.net/v3/assets/latest/${minimum}/hotspot?architecture=${arch}&image_type=jre&os=windows&vendor=eclipse`, { signal }, ['api.adoptium.net']);
    const assets = await response.json();
    const pkg = Array.isArray(assets) && assets.find((item: any) =>
      item.binary?.os === 'windows' && item.binary?.architecture === arch &&
      item.binary?.image_type === 'jre' && item.binary?.package?.name?.endsWith('.zip'))?.binary.package;
    if (!pkg || !/^[a-f0-9]{64}$/i.test(pkg.checksum) || typeof pkg.link !== 'string')
      throw Error(`Java ${minimum} 자동 설치 파일을 찾지 못했습니다.`);
    // Only the official Temurin release repository may supply the executable archive.
    const url = new URL(pkg.link);
    if (url.origin !== 'https://github.com' || !url.pathname.startsWith(`/adoptium/temurin${minimum}-binaries/releases/download/`))
      throw Error('Unexpected Java download source');
    await fs.mkdir(root, { recursive: true });
    const id = `java-${minimum}-${randomUUID()}`;
    const archive = path.join(root, id + '.zip');
    const stage = path.join(root, id + '.part');
    const destination = path.join(root, id);
    try {
      await download(pkg.link, archive, { algorithm: 'sha256', value: pkg.checksum }, signal,
        (current, total) => progress?.(`Java ${minimum} 다운로드`, current, total), runtimeHosts);
      signal?.throwIfAborted();
      progress?.(`Java ${minimum} 압축 해제`, 0, 0);
      const zip = new AdmZip(archive);
      const executables = safeEntries(zip).filter(entry => !entry.isDirectory && /^[^/]+\/bin\/java\.exe$/.test(entry.entryName));
      if (executables.length !== 1) throw Error('Invalid Java runtime archive');
      const prefix = executables[0].entryName.split('/')[0] + '/';
      await extract(zip, stage, prefix);
      signal?.throwIfAborted();
      const verified = await inspectJava(path.join(stage, 'bin/java.exe'), minimum);
      if (!verified) throw Error(`Java ${minimum} 설치 검증에 실패했습니다.`);
      await fs.rename(stage, destination);
      progress?.(`Java ${minimum} 설치 완료`, 1, 1);
      return { path: path.join(destination, 'bin/java.exe'), major: verified.major };
    } finally {
      await fs.rm(archive, { force: true }).catch(() => {});
      await fs.rm(stage, { recursive: true, force: true }).catch(() => {});
    }
  })();
  installing.set(key, job);
  try { return await job; } finally { installing.delete(key); }
}
