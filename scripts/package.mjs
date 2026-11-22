import { spawnSync } from 'node:child_process';
// Signing credentials stay in the operator's environment, never in source or package.json.
const signingArgs = [];
if (process.env.CSC_LINK || process.env.WIN_CSC_LINK) {
  signingArgs.push('--config.win.signExecutable=true', '--config.forceCodeSigning=true');
} else if (process.env.DKKF_SIGNING_CERT_SHA1) {
  signingArgs.push(
    '--config.win.signExecutable=true',
    '--config.forceCodeSigning=true',
    '--config.win.certificateSha1=' + process.env.DKKF_SIGNING_CERT_SHA1,
  );
} else {
  console.log('No Windows signing credentials configured; building an unsigned installer.');
}
for (const [script, args] of [
  ['node_modules/typescript/bin/tsc', ['--noEmit']],
  ['node_modules/vite/bin/vite.js', ['build']],
  ['scripts/build.mjs', []],
  ['node_modules/electron-builder/cli.js', ['--win', 'nsis', '--x64', ...signingArgs]],
]) {
  const r = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
