import path from 'node:path';
import fs from 'node:fs/promises';
import type { Store } from './store';
import type { Mods } from './mods';
import { digest, contained } from './security';
import bundled from '../../shared/bundled-mods.json';

export async function installBundledMods(
  store: Store,
  mods: Mods,
  instanceId: string,
  resources: string,
  signal: AbortSignal,
  only?: string,
) {
  const i = store.instance(instanceId);
  const notices: string[] = [];
  for (const item of bundled) {
    if (only && item.id !== only) continue;
    if (item.id === 'dkkf_bridge' && !store.settings.serverBridge) continue;
    if (item.minecraft !== i.version || item.loader !== i.loader) continue;
    const file = contained(path.join(resources, 'bundled-mods'), item.file);
    if ((await digest(file)) !== item.sha256)
      throw Error('번들 모드 무결성 검사 실패: ' + item.name);
    const list = await mods.list(instanceId);
    const existing = list.find((m) => m.id === item.id);
    if (existing) {
      continue;
    } // Imported packs keep their own pinned version; no automatic replacement.
    if (item.requiresFabricApi) {
      const api = list.find((m) => m.id === 'fabric-api');
      if (item.id === 'dkkf_bridge' && api) {
        const version = api.version
          .match(/^(\d+)\.(\d+)\.(\d+)/)
          ?.slice(1)
          .map(Number);
        const minimum = [0, 166, 2];
        let compatible = false;
        if (version) {
          compatible = true;
          for (let n = 0; n < 3; n++) {
            if (version[n] > minimum[n]) break;
            if (version[n] < minimum[n]) {
              compatible = false;
              break;
            }
          }
        }
        if (!api.enabled || !compatible) {
          notices.push(
            'DKKF 서버 연동 모드는 활성화된 Fabric API 0.166.2 이상이 필요합니다. 기존 버전은 유지했습니다.',
          );
          continue;
        }
      }
      if (api && !api.enabled)
        throw Error('Fabric API가 비활성화되어 있습니다. 편집 → 설치된 모드에서 활성화하세요.');
      if (!api) {
        const detail = await mods.detail('modrinth', 'fabric-api', i);
        if (!detail.versions[0]) throw Error('호환 Fabric API가 없습니다.');
        await mods.install(instanceId, 'modrinth', 'fabric-api', detail.versions[0].id, signal);
      }
    }
    signal.throwIfAborted();
    await mods.import(instanceId, [file]);
  }
  return notices;
}
