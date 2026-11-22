import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryArguments, removeForcedResolution } from '../launcher/main/launch-options';
import { instanceInput } from '../shared/schemas';
test('RAM and resolution overrides are optional and automatic mode omits forced arguments', () => {
  assert.deepEqual(memoryArguments({ ram: 4096, limitRam: false }), []);
  assert.deepEqual(memoryArguments({ ram: 4096, limitRam: true }), ['-Xmx4096M', '-Xms512M']);
  assert.deepEqual(memoryArguments({ ram: 4096 }), ['-Xmx4096M', '-Xms512M']);
  const args = ['--username', 'Fixture', '--width', '1280', '--height=720', '--fullscreen'];
  assert.deepEqual(removeForcedResolution(args, { limitResolution: false }), [
    '--username',
    'Fixture',
    '--fullscreen',
  ]);
  assert.deepEqual(removeForcedResolution(args, { limitResolution: true }), args);
  assert.equal(
    instanceInput.parse({ name: 'fixture', version: '26.3', loader: 'fabric', ram: 4096 }).limitRam,
    false,
  );
});
