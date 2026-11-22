import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { verifyFile, httpsUrl } from './security';
import target from '../../shared/target.json';
const ua = `DKKF-Client/${target.launcherVersion} (Minecraft Java launcher)`;
export const gameHosts = [
  'mojang.com',
  'minecraft.net',
  'minecraftservices.com',
  'fabricmc.net',
  'quiltmc.org',
  'minecraftforge.net',
  'neoforged.net',
  'modrinth.com',
  'forgecdn.net',
  'curseforge.com',
];
export async function request(
  url: string,
  init: RequestInit = {},
  hosts?: string[],
): Promise<Response> {
  let current = httpsUrl(url, hosts).href;
  for (let n = 0; n < 6; n++) {
    const response = await fetch(current, {
      ...init,
      headers: { 'User-Agent': ua, ...init.headers },
      redirect: 'manual',
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(120000)])
        : AbortSignal.timeout(60000),
    });
    if (response.status >= 300 && response.status < 400) {
      const loc = response.headers.get('location');
      if (!loc) throw Error('리디렉션 주소 누락');
      const next = httpsUrl(new URL(loc, current).href, hosts);
      if (init.headers && new URL(current).origin !== next.origin)
        throw Error('인증 헤더의 외부 리디렉션 차단');
      current = next.href;
      continue;
    }
    if (!response.ok)
      throw Error(
        `HTTP ${response.status}: ${new URL(current).hostname}${new URL(current).pathname}`,
      );
    return response;
  }
  throw Error('리디렉션 횟수 초과');
}
export async function json(url: string, init?: RequestInit) {
  return (await request(url, init)).json() as Promise<any>;
}
export async function download(
  url: string,
  target: string,
  hash: { algorithm: string; value: string } | undefined,
  signal?: AbortSignal,
  progress?: (n: number, t: number) => void,
  hosts = gameHosts,
) {
  if (hash) {
    try {
      await verifyFile(target, hash.algorithm, hash.value);
      return;
    } catch {}
  }
  signal?.throwIfAborted();
  progress?.(0, 0);
  const res = await request(url, { signal }, hosts);
  const total = Number(res.headers.get('content-length') || 0);
  if (total > 1024 ** 3 * 2) throw Error('파일이 2 GiB 제한을 초과합니다.');
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temp = target + '.' + randomUUID() + '.part';
  let count = 0;
  const f = await fs.open(temp, 'wx');
  try {
    if (!res.body) throw Error('빈 다운로드');
    for await (const b of res.body) {
      count += b.length;
      if (count > 1024 ** 3 * 2) throw Error('다운로드 크기 제한');
      await f.write(b);
      progress?.(count, total);
    }
    await f.close();
    if (hash) await verifyFile(temp, hash.algorithm, hash.value);
    await fs.rename(temp, target);
  } catch (e) {
    await f.close().catch(() => {});
    await fs.rm(temp, { force: true });
    throw e;
  }
}
