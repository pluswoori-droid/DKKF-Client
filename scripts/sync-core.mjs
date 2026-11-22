import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const target = JSON.parse(await fs.readFile('shared/target.json', 'utf8'));
const name = `dkkf-core-fabric-${target.minecraft}-${target.clientVersion}.jar`;
const bytes = await fs.readFile(path.join('client/fabric26_3/build/libs', name));
await fs.mkdir('assets/client-core', { recursive: true });
await fs.writeFile(path.join('assets/client-core', name), bytes);
await fs.writeFile(
  'shared/core-build.json',
  JSON.stringify(
    {
      file: name,
      version: target.clientVersion,
      minecraft: target.minecraft,
      loader: 'fabric',
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    null,
    2,
  ),
);
