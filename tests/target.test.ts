import { test } from 'node:test';
import assert from 'node:assert/strict';
import { javaMajor } from '../launcher/main/java';
import target from '../shared/target.json';
test('26.3 Fabric target has the official Java 25 minimum', () => {
  assert.equal(target.minecraft, '26.3');
  assert.equal(target.loader, 'fabric');
  assert.equal(target.java, 25);
  assert.equal(javaMajor('openjdk version "26.0.2.1" 2026-07-21'), 26);
  assert.equal(javaMajor('java version "1.8.0_511"'), 8);
  assert.equal(javaMajor('openjdk version "25.0.1"'), 25);
  assert.equal(javaMajor('not a Java runtime'), undefined);
});
