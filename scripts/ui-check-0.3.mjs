import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { _electron } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const root = path.resolve('.data/ui-check-0.3');
await fs.mkdir(root, { recursive: true });
const stamp = Date.now();
const application = await _electron.launch({
  executablePath:
    process.env.DKKF_TEST_EXE || path.resolve('release/0.3.0/win-unpacked/Dkkf Launcher.exe'),
  args: [],
  env: {
    ...process.env,
    DKKF_DATA_DIR: path.join(root, 'data-' + stamp),
    DKKF_ELECTRON_PROFILE: path.join(root, 'electron-' + stamp),
  },
  timeout: 60000,
});
const page = await application.firstWindow();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const results = [];
try {
  await page.getByRole('heading', { name: '반가워요.' }).waitFor({ timeout: 60000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.title(), 'Dkkf Launcher');
  assert.equal(
    await page.locator('nav').getByRole('button', { name: '업로드 센터', exact: true }).count(),
    0,
  );
  for (const name of ['홈', '인스턴스', '업데이트', '설정', '계정']) {
    await page.locator('nav').getByRole('button', { name, exact: true }).click();
    assert.equal(await page.locator('.crumb b').innerText(), name);
  }
  results.push(
    'Korean navigation, Dkkf Launcher branding and hidden Upload Center for signed-out users',
  );
  assert.equal(
    await page
      .locator('nav')
      .getByRole('button', { name: /Mod Hub|My Mods|Modpacks/ })
      .count(),
    0,
  );
  await assert.rejects(
    () => page.evaluate(() => window.dkkf.call('upload.version', {})),
    /로그인|계정/,
  );
  results.push(
    'Main-process upload rejects unauthenticated callers before selecting or transmitting files',
  );
  await page.locator('nav').getByRole('button', { name: '설정', exact: true }).click();
  assert.equal(await page.getByLabel('게임 해상도 직접 설정', { exact: true }).isChecked(), false);
  await page.locator('nav').getByRole('button', { name: '인스턴스', exact: true }).click();
  await page.getByRole('button', { name: '＋ 새 인스턴스' }).click();
  await page.getByRole('button', { name: /직접 만들기/ }).click();
  await page
    .getByLabel('Minecraft 버전', { exact: true })
    .locator('option', { hasText: /^26\.3$/ })
    .waitFor({ state: 'attached' });
  assert.equal(await page.getByLabel('Minecraft 버전', { exact: true }).inputValue(), '26.3');
  assert.equal(await page.getByLabel('모드 로더', { exact: true }).inputValue(), 'fabric');
  assert.equal(await page.getByLabel('RAM 상한 직접 설정', { exact: true }).isChecked(), false);
  await page.getByLabel('Minecraft 버전', { exact: true }).selectOption('1.12.1');
  await page
    .getByRole('alert')
    .getByText(/Fabric는 Minecraft 1\.12\.1을 지원하지/)
    .waitFor();
  await page.getByRole('button', { name: '26.3 Fabric 선택', exact: true }).click();
  await page.getByRole('alert').waitFor({ state: 'detached' });
  await page.getByRole('dialog').getByLabel('이름', { exact: true }).fill('26.3 자동 설치 검증');
  await page.getByRole('button', { name: '생성 및 자동 설치', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 900000 });
  const state = await page.evaluate(() => window.dkkf.call('state'));
  const instance = state.instances.find((i) => i.id === state.selected);
  assert(
    instance?.installed,
    instance?.installationError || 'Automatic installation did not complete',
  );
  const list = await page.evaluate((id) => window.dkkf.call('mods.list', id), instance.id);
  assert(list.some((m) => m.id === 'locatorbar' && m.version === '1.2.0'));
  assert(list.some((m) => m.id === 'fabric-api'));
  assert.equal(instance.limitRam, false);
  results.push(
    'Actual automatic 26.3 Fabric installation, supplied Locator Bar 1.2.0 and initial Fabric API installation',
  );
  await page.getByRole('button', { name: '편집', exact: true }).click();
  await page.getByRole('tab', { name: '모드 검색', exact: true }).click();
  await page.getByPlaceholder('당신의 다음 모드를 찾아보세요…').fill('sodium');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.locator('.modcard').first().waitFor({ timeout: 60000 });
  await page.getByRole('tab', { name: '설치된 모드', exact: true }).click();
  await page.getByRole('button', { name: '업데이트 확인', exact: true }).waitFor();
  await page.getByRole('cell', { name: 'Locator Bar', exact: false }).waitFor();
  await page.screenshot({ path: path.join(root, 'instance-mods.png'), fullPage: true });
  results.push(
    'Instance editor integrates actual Modrinth search, local mod management and manual update control',
  );
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.locator('nav').getByRole('button', { name: '홈', exact: true }).click();
  await page.screenshot({ path: path.join(root, 'home.png'), fullPage: true });
  assert.equal(await page.locator('.header-profile').count(), 0);
  assert(
    !(await page
      .locator('body')
      .innerText()
      .then((t) => /Neon Edition/i.test(t))),
  );
  assert.deepEqual(errors, []);
  results.push(
    'Signed-out home has no fabricated profile; no Neon Edition text or renderer errors',
  );
  await fs.writeFile(
    path.join(root, 'results.json'),
    JSON.stringify({ status: 'TESTED', results, errors, instance: instance.id }, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await application.close();
}
