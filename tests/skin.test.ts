import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { officialSkinUrl, skinFacePng } from '../launcher/main/skin';
test('Skin URLs are restricted to official texture hashes and upgraded to HTTPS', () => {
  const hash = 'a'.repeat(64);
  assert.equal(
    officialSkinUrl('http://textures.minecraft.net/texture/' + hash),
    'https://textures.minecraft.net/texture/' + hash,
  );
  for (const url of [
    'https://evil.test/texture/' + hash,
    'https://textures.minecraft.net.evil.test/texture/' + hash,
    'file:///skin.png',
    'https://textures.minecraft.net:8443/texture/' + hash,
    'https://user:secret@textures.minecraft.net/texture/' + hash,
  ])
    assert.equal(officialSkinUrl(url), undefined);
});
test('Face extraction crops the exact head pixels and composites the hat alpha', () => {
  const skin = new PNG({ width: 64, height: 64 });
  for (let y = 8; y < 16; y++)
    for (let x = 8; x < 16; x++) {
      const i = (y * 64 + x) * 4;
      skin.data.set([100, 50, 0, 255], i);
    }
  skin.data.set([0, 0, 200, 128], (8 * 64 + 40) * 4);
  const face = PNG.sync.read(skinFacePng(PNG.sync.write(skin)));
  assert.equal(face.width, 8);
  assert.equal(face.height, 8);
  assert.deepEqual([...face.data.subarray(0, 4)], [50, 25, 100, 255]);
  assert.deepEqual([...face.data.subarray(4, 8)], [100, 50, 0, 255]);
  const oversized = PNG.sync.write(new PNG({ width: 128, height: 128 }));
  assert.throws(() => skinFacePng(oversized));
  assert.throws(() => skinFacePng(Buffer.from('not an image')));
});
test('Legacy opaque hat backgrounds are not painted over the skin face', () => {
  const skin = new PNG({ width: 64, height: 32 });
  skin.data.fill(255);
  for (let y = 8; y < 16; y++)
    for (let x = 8; x < 16; x++) skin.data.set([10, 20, 30, 255], (y * 64 + x) * 4);
  const face = PNG.sync.read(skinFacePng(PNG.sync.write(skin)));
  assert.deepEqual([...face.data.subarray(0, 4)], [10, 20, 30, 255]);
});
