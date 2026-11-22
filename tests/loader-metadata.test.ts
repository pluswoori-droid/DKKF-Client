import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LoaderMetadata } from '../launcher/main/loader-metadata';
import { Minecraft } from '../launcher/main/minecraft';
import type { Store } from '../launcher/main/store';

test('Unsupported Fabric game versions never reach the invalid loader endpoint; supported 26.3 still resolves', async () => {
  const urls: string[] = [];
  const meta = new LoaderMetadata(async (url) => {
    urls.push(url);
    if (url.endsWith('/versions/game')) return [{ version: '26.3' }, { version: '1.21.1' }];
    assert.equal(url, 'https://meta.fabricmc.net/v2/versions/loader/26.3');
    return [{ loader: { version: '0.20.1', stable: true } }];
  });
  await assert.rejects(
    () => meta.list('fabric', '1.12.1'),
    /Fabric는 Minecraft 1\.12\.1을 지원하지 않습니다/,
  );
  assert.deepEqual(urls, ['https://meta.fabricmc.net/v2/versions/game']);
  assert.deepEqual(await meta.list('fabric', '26.3'), [{ version: '0.20.1', stable: true }]);
  assert.equal(urls.filter((u) => u.endsWith('/versions/game')).length, 1);
});

test('Installation rejects incompatible loader combinations before touching the instance directory', async () => {
  let touched = false;
  const store = {
    dir: () => {
      touched = true;
      throw Error('Should not touch disk');
    },
  } as unknown as Store;
  const mc = new Minecraft(
    store,
    () => {},
    async () => [{ version: '26.3' }],
  );
  await assert.rejects(
    () =>
      mc.install(
        {
          id: 'fixture',
          name: 'Bad Fabric',
          version: '1.12.1',
          loader: 'fabric',
          loaderVersion: '0.20.1',
          ram: 4096,
          created: 'fixture',
        },
        new AbortController().signal,
      ),
    /1\.12\.1을 지원하지/,
  );
  assert.equal(touched, false);
  await mc.validateLoader({ version: '1.12.1', loader: 'vanilla', loaderVersion: '' });
});

test('Loader compatibility refreshes from metadata after expiry and does not report beta as stable', async () => {
  let now = 0,
    gameReads = 0;
  const meta = new LoaderMetadata(
    async (url) => {
      if (url.endsWith('/versions/game')) {
        gameReads++;
        return [{ version: '26.3' }];
      }
      return [{ loader: { version: '0.30-beta.1' } }];
    },
    () => now,
  );
  assert.equal((await meta.list('quilt', '26.3'))[0].stable, false);
  now = 300001;
  await meta.list('quilt', '26.3');
  assert.equal(gameReads, 2);
});
