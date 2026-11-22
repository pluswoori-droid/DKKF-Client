import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import path from 'node:path';
import { contained } from './security';
export function safeEntries(zip: AdmZip) {
  let total = 0;
  const names = new Set<string>();
  for (const e of zip.getEntries()) {
    const n = e.entryName.replace(/\/$/, '');
    contained('D:/archive-validation', n);
    if (((e.attr >>> 16) & 0xf000) === 0xa000) throw Error('심볼릭 링크가 포함된 압축 파일');
    total += e.header.size;
    if (total > 1024 ** 3 || e.header.size > 256 * 1024 ** 2)
      throw Error('압축 해제 크기 제한 초과');
    const key = n.toLowerCase();
    if (names.has(key)) throw Error('중복 압축 경로');
    names.add(key);
  }
  return zip.getEntries();
}
export async function extract(
  zip: AdmZip,
  root: string,
  prefix = '',
  filter = (name: string) => true,
) {
  const entries = safeEntries(zip);
  for (const e of entries) {
    if (e.isDirectory || !e.entryName.startsWith(prefix)) continue;
    const name = e.entryName.slice(prefix.length);
    if (!filter(name)) continue;
    const target = contained(root, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, e.getData(), { flag: 'wx' });
  }
}
