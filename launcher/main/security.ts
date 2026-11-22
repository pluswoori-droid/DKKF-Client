import path from 'node:path';
import { createHash, verify, createPublicKey } from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
export function contained(root: string, entry: string) {
  if (
    !entry ||
    entry.length > 2000 ||
    entry.includes('\\') ||
    /[\x00-\x1f:<>"|?*]/.test(entry) ||
    entry
      .split('/')
      .some((x) => x === '..' || x === '.' || !x || x.length > 255 || /[. ]$/.test(x)) ||
    entry.split('/').some((x) => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(x))
  )
    throw Error('안전하지 않은 파일 경로입니다.');
  const target = path.resolve(root, entry);
  const rel = path.relative(path.resolve(root), target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw Error('경로가 저장 폴더를 벗어났습니다.');
  return target;
}
export function httpsUrl(value: string, hosts?: string[]) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443'))
    throw Error('HTTPS 주소만 허용됩니다.');
  if (hosts && !hosts.some((h) => u.hostname === h || u.hostname.endsWith('.' + h)))
    throw Error('허용되지 않은 다운로드 출처: ' + u.hostname);
  return u;
}
export async function digest(file: string, algorithm = 'sha256') {
  const hash = createHash(algorithm);
  for await (const b of createReadStream(file)) hash.update(b);
  return hash.digest('hex');
}
export async function verifyFile(file: string, algorithm: string, expected: string) {
  if (
    !['sha1', 'sha256', 'sha512'].includes(algorithm) ||
    !new RegExp('^[a-fA-F0-9]{' + { sha1: 40, sha256: 64, sha512: 128 }[algorithm] + '}$').test(
      expected,
    )
  )
    throw Error('유효한 파일 해시가 없습니다.');
  if ((await digest(file, algorithm)) !== expected.toLowerCase())
    throw Error('파일 무결성 검사 실패');
}
export function checkHash(bytes: Buffer, algorithm: string, expected: string) {
  if (
    !['sha1', 'sha256', 'sha512'].includes(algorithm) ||
    !new RegExp('^[a-fA-F0-9]{' + { sha1: 40, sha256: 64, sha512: 128 }[algorithm] + '}$').test(
      expected,
    )
  )
    throw Error('유효한 파일 해시가 없습니다.');
  if (createHash(algorithm).update(bytes).digest('hex') !== expected.toLowerCase())
    throw Error('파일 무결성 검사 실패');
}
export function verifySigned(payload: unknown, signature: string, key: string) {
  const pub = createPublicKey(key);
  if (pub.asymmetricKeyType !== 'ed25519') throw Error('Ed25519 공개키가 필요합니다.');
  if (!verify(null, Buffer.from(JSON.stringify(payload)), pub, Buffer.from(signature, 'base64')))
    throw Error('업데이트 서명 검증 실패');
}
export function redact(text: string) {
  return text
    .replace(/(Bearer\s+)[\w.\-]+/gi, '$1[REDACTED]')
    .replace(
      /(access_token|refresh_token|authorization|--accessToken)(["'\s:=]+)[^\s,"'}]+/gi,
      '$1$2[REDACTED]',
    );
}
