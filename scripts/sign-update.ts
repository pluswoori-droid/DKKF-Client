import { createHash, createPrivateKey, sign } from 'node:crypto';
import fs from 'node:fs/promises';
const [file, url, version, keyFile, out] = process.argv.slice(2);
if (!out)
  throw Error('Usage: tsx scripts/sign-update.ts SETUP HTTPS_URL VERSION PRIVATE_KEY OUTPUT_JSON');
const bytes = await fs.readFile(file);
const key = createPrivateKey(await fs.readFile(keyFile));
if (key.asymmetricKeyType !== 'ed25519') throw Error('Ed25519 key required');
const payload = {
  version,
  channel: 'stable',
  target: 'launcher',
  url,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  size: bytes.length,
  published: new Date().toISOString(),
  notes: 'DKKF Client ' + version,
};
await fs.writeFile(
  out,
  JSON.stringify(
    {
      payload,
      signature: sign(null, Buffer.from(JSON.stringify(payload)), key).toString('base64'),
    },
    null,
    2,
  ),
);
