import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
const zip = new AdmZip();
const directories = [
  'launcher',
  'client',
  'backend',
  'shared',
  'assets',
  'scripts',
  'tests',
  'docs',
  'distribution-site',
];
async function add(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (['build', '.gradle', 'run', 'releases', 'node_modules', '.git', 'dist', '.next', '.sites-runtime', '.wrangler', '.vinext'].includes(entry.name) || entry.name.startsWith('.env')) continue;
    const name = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw Error('Do not archive symlinks: ' + name);
    if (entry.isDirectory()) await add(name);
    else zip.addFile(name.replaceAll('\\', '/'), await fs.readFile(name));
  }
}
for (const directory of directories) await add(directory);
for (const file of [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'vite.config.ts',
  '.gitignore',
  '.prettierrc.json',
  '.prettierignore',
  'README.md',
  'README.ko.md',
  'PRIVACY.md',
  'SECURITY.md',
  'BUILD.md',
  'DEPLOYMENT.md',
  'TEST-REPORT.md',
  'THIRD-PARTY-NOTICES.md',
])
  zip.addFile(file, await fs.readFile(file));
const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
const output = `release/${version}`;
await fs.mkdir(output, { recursive: true });
const core = JSON.parse(await fs.readFile('shared/core-build.json', 'utf8'));
const source = `${output}/Dkkf-Launcher-${version}-Source.zip`;
zip.writeZip(source);
const files = [
  `${output}/Dkkf-Launcher-${version}-Setup.exe`,
  source,
  `assets/client-core/${core.file}`,
];
const lines = [];
for (const file of files)
  lines.push(
    createHash('sha256')
      .update(await fs.readFile(file))
      .digest('hex') +
      '  ' +
      path.basename(file),
  );
await fs.writeFile(`${output}/SHA256SUMS.txt`, lines.join('\n') + '\n');
console.log(
  'Created source archive and checksums (no game files, accounts, caches or dependencies).',
);
