import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
export function javaMajor(output: string) {
  const match = output.match(/(?:java|openjdk) version "(?:1\.)?(\d+)/i);
  return match ? Number(match[1]) : undefined;
}
export async function discoverJava(minimum: number) {
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
  const found = await Promise.all(
    [...candidates].map(async (executable) => {
      try {
        const result = await promisify(execFile)(executable, ['-version'], {
          windowsHide: true,
          timeout: 5000,
        });
        const major = javaMajor(result.stdout + '\n' + result.stderr);
        return major && major >= minimum ? { path: executable, major } : undefined;
      } catch {
        return undefined;
      }
    }),
  );
  return found
    .filter((v): v is { path: string; major: number } => !!v)
    .sort((a, b) => a.major - b.major)[0];
}
