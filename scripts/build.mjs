import { build } from 'esbuild';
await build({
  entryPoints: ['launcher/main/main.ts'],
  outfile: 'dist/main/main.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron', 'sql.js'],
  sourcemap: false,
});
await build({
  entryPoints: ['launcher/main/preload.ts'],
  outfile: 'dist/main/preload.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
});
