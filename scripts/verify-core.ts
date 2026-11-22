import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import { digest } from '../launcher/main/security';
import target from '../shared/target.json';
import core from '../shared/core-build.json';
const file = path.join('assets/client-core', core.file);
assert.equal(await digest(file), core.sha256);
const zip = new AdmZip(file);
const metadata = JSON.parse(zip.readAsText('fabric.mod.json'));
assert.equal(metadata.depends.minecraft, target.minecraft);
assert.equal(metadata.depends.java, '>=25');
assert.equal(metadata.version, target.clientVersion);
for (const name of ['DkkfClient', 'FabricGameAdapter', 'HudEditor']) {
  const bytes = zip.readFile(`kr/dkkf/fabric/${name}.class`);
  assert(bytes);
  assert.equal(bytes.readUInt16BE(6), 69);
}
assert(metadata.jars?.length, 'Common HUD model must be included');
for (const jar of metadata.jars) {
  assert(zip.getEntry(jar.file), 'Missing nested common JAR');
}
await fs.mkdir('docs/verification', { recursive: true });
await fs.writeFile(
  'docs/verification/core-26.3.json',
  JSON.stringify(
    {
      status: 'TESTED',
      file: core.file,
      sha256: core.sha256,
      minecraft: target.minecraft,
      loader: target.loader,
      javaMinimum: 25,
      classVersion: 69,
      scope: 'Compiled artifact and nested common metadata; in-game rendering not tested',
    },
    null,
    2,
  ),
);
console.log('PASS: 26.3 Fabric core hash, metadata, Java 25 bytecode and nested common JAR');
