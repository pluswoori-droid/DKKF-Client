import { PNG } from 'pngjs';
import { request } from './network';

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const maxSkinBytes = 256 * 1024;

export function officialSkinUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return;
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.hostname !== 'textures.minecraft.net' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/texture\/[a-f0-9]{32,128}$/i.test(url.pathname)
  )
    return;
  url.protocol = 'https:';
  return url.href;
}

/** Crop head + hat as an 8x8 PNG. No external avatar/UUID service is contacted. */
export function skinFacePng(bytes: Buffer): Buffer {
  if (
    bytes.length < 33 ||
    bytes.length > maxSkinBytes ||
    !bytes.subarray(0, 8).equals(signature) ||
    bytes.toString('ascii', 12, 16) !== 'IHDR' ||
    bytes.readUInt32BE(16) !== 64 ||
    ![32, 64].includes(bytes.readUInt32BE(20))
  )
    throw Error('유효한 Minecraft 스킨 PNG가 아닙니다.');
  const image = PNG.sync.read(bytes, { checkCRC: true });
  const face = new PNG({ width: 8, height: 8 });
  let overlay = true;
  // Legacy 64x32 skins with an entirely opaque hat region use Minecraft's legacy transparency rule.
  if (image.height === 32) {
    overlay = false;
    for (let y = 0; y < 32 && !overlay; y++)
      for (let x = 32; x < 64; x++)
        if (image.data[(y * 64 + x) * 4 + 3] < 128) {
          overlay = true;
          break;
        }
  }
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const base = ((y + 8) * 64 + x + 8) * 4,
        hat = ((y + 8) * 64 + x + 40) * 4,
        out = (y * 8 + x) * 4;
      const alpha = overlay ? image.data[hat + 3] / 255 : 0;
      for (let c = 0; c < 3; c++)
        face.data[out + c] = Math.round(
          image.data[hat + c] * alpha + image.data[base + c] * (1 - alpha),
        );
      face.data[out + 3] = 255;
    }
  return PNG.sync.write(face);
}

export async function downloadSkinFace(profile: unknown): Promise<string | undefined> {
  const skins = (profile as { skins?: unknown })?.skins;
  if (!Array.isArray(skins)) return;
  const active =
    skins.find((s) => s && s.state === 'ACTIVE') ??
    (skins.length === 1 && !skins[0]?.state ? skins[0] : undefined);
  const url = officialSkinUrl(active?.url);
  if (!url) return;
  try {
    const response = await request(url, { signal: AbortSignal.timeout(5000) }, [
      'textures.minecraft.net',
    ]);
    if (Number(response.headers.get('content-length') || 0) > maxSkinBytes || !response.body)
      return;
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxSkinBytes) {
        await response.body.cancel().catch(() => {});
        return;
      }
      chunks.push(chunk);
    }
    const png = skinFacePng(Buffer.concat(chunks));
    return 'data:image/png;base64,' + png.toString('base64');
  } catch {
    return;
  }
}
