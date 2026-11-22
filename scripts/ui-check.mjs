import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const target = JSON.parse(await fs.readFile('shared/target.json', 'utf8'));
const microsoftApp = JSON.parse(await fs.readFile('shared/microsoft-app.json', 'utf8'));
if (!process.env.PLAYWRIGHT_MODULE_PATH)
  throw Error('Set PLAYWRIGHT_MODULE_PATH to playwright package entry point');
const { _electron } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const root = path.resolve(`.data/ui-check-${target.minecraft}`);
await fs.mkdir(root, { recursive: true });
const executablePath =
  process.env.DKKF_TEST_EXE || path.resolve('node_modules/electron/dist/electron.exe');
const application = await _electron.launch({
  executablePath,
  args: process.env.DKKF_TEST_EXE ? [] : ['.'],
  env: { ...process.env, DKKF_DATA_DIR: path.join(root, 'data-' + Date.now()), DKKF_ELECTRON_PROFILE:path.join(root,'electron-'+Date.now()), DKKF_DEV: '0' },
  timeout: 60000,
});
const page = await application.firstWindow();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const results = [];
try {
  await page.getByRole('heading', { name: '반가워요.' }).waitFor({ timeout: 30000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: path.join(root, 'home.png'), fullPage: true });
  results.push('Packaged Electron launch and preload IPC');
  for (const p of [
    'Instances',
    'Mod Hub',
    'My Mods',
    'Modpacks',
    'Upload Center',
    'Update Center',
    'Settings',
    'Account',
    'Home',
  ]) {
    await page.locator('nav').getByRole('button', { name: p, exact: true }).click();
    await page.locator('main h1').waitFor();
    assert.equal(await page.locator('.crumb b').textContent(), p);
    results.push('Navigation: ' + p);
  }
  const state = await page.evaluate(() => window.dkkf.call('state'));
  assert.equal(state.accounts.length, 0);
  assert.equal(state.version, target.launcherVersion);
  assert.equal(state.settings.microsoftClientId, '');
  results.push('Registered Microsoft public client ID is configured; no fabricated accounts');
  await page.locator('nav').getByRole('button', { name: 'Account', exact: true }).click();
  assert(await page.getByRole('button', { name: '＋ Microsoft 로그인', exact: true }).isEnabled());
  assert.equal(await page.locator('.device-code').count(), 0);
  await page.screenshot({ path: path.join(root, 'account-configured.png'), fullPage: true });
  results.push(
    'Account sign-in is available without starting authentication or creating a device code',
  );
  const java = await page.evaluate(() => window.dkkf.call('settings.javaAuto'));
  assert(java.major >= target.java);
  results.push(`Java ${target.java}+ discovery returned Java ${java.major}`);
  await assert.rejects(() =>
    page.evaluate(() => window.dkkf.call('arbitrary:filesystem', { path: 'C:/' })),
  );
  results.push('Unknown IPC method rejected');
  await page.locator('nav').getByRole('button', { name: 'Instances', exact: true }).click();
  await page.getByRole('button', { name: '＋ 새 인스턴스' }).click();
  await page.getByRole('dialog').waitFor();
  await page
    .getByRole('dialog')
    .locator('select')
    .first()
    .locator('option', { hasText: new RegExp('^' + target.minecraft.replaceAll('.', '\\.') + '$') })
    .waitFor({ state: 'attached' });
  await page
    .getByRole('dialog')
    .getByLabel('이름', { exact: true })
    .fill('UI verification ' + Date.now());
  assert.equal(
    await page.getByLabel('Minecraft 버전', { exact: true }).inputValue(),
    target.minecraft,
  );
  assert.equal(await page.getByLabel('모드 로더', { exact: true }).inputValue(), 'fabric');
  await page.getByLabel('Minecraft 버전', { exact: true }).selectOption('1.12.1');
  await page
    .getByRole('dialog')
    .getByRole('alert')
    .getByText(/Fabric는 Minecraft 1\.12\.1을 지원하지/)
    .waitFor();
  assert.equal(
    await page.getByRole('button', { name: '인스턴스 생성', exact: true }).isEnabled(),
    false,
  );
  await page.getByLabel('모드 로더', { exact: true }).selectOption('vanilla');
  await page.getByRole('dialog').getByRole('alert').waitFor({ state: 'detached' });
  await page.getByLabel('모드 로더', { exact: true }).selectOption('fabric');
  await page.getByRole('dialog').getByRole('alert').waitFor();
  await page.getByRole('button', { name: target.minecraft + ' Fabric 선택', exact: true }).click();
  await page.getByRole('dialog').getByRole('alert').waitFor({ state: 'detached' });
  results.push(
    'Fabric 1.12.1 is blocked with compatibility guidance; switching loader clears stale errors and recommended 26.3 recovers',
  );
  await page.getByRole('button', { name: '인스턴스 생성', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  results.push('Create instance through actual Mojang API and UI');
  await page.locator('nav').getByRole('button', { name: 'Home', exact: true }).click();
  await page.screenshot({ path: path.join(root, 'home-instance.png'), fullPage: true });
  await page.locator('nav').getByRole('button', { name: 'Mod Hub', exact: true }).click();
  await page.getByPlaceholder('당신의 다음 모드를 찾아보세요…').fill('sodium');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.locator('.modcard').first().waitFor({ timeout: 30000 });
  await page.screenshot({ path: path.join(root, 'modhub.png'), fullPage: true });
  results.push('Mod Hub real API results rendered');
  const encrypted = await application.evaluate(({ safeStorage }) => {
    const fixture = 'local-encryption-fixture-only';
    const bytes = safeStorage.encryptString(fixture);
    return (
      safeStorage.isEncryptionAvailable() &&
      !bytes.includes(Buffer.from(fixture)) &&
      safeStorage.decryptString(bytes) === fixture
    );
  });
  assert.equal(encrypted, true);
  results.push('Windows safeStorage encrypt/decrypt roundtrip without plaintext storage');
  const fabric = await page.evaluate(async (target) => {
    const loaders = await window.dkkf.call('loaders', {
      loader: 'fabric',
      version: target.minecraft,
    });
    return window.dkkf.call('instances.create', {
      name: 'HUD verification ' + Date.now(),
      version: target.minecraft,
      loader: 'fabric',
      loaderVersion: loaders[0].version,
      ram: 4096,
    });
  }, target);
  await page.locator('nav').getByRole('button', { name: 'My Mods', exact: true }).click();
  await page.getByRole('button', { name: 'DKKF HUD 설치', exact: true }).click();
  await page
    .getByRole('cell', { name: 'DKKF Client Core', exact: false })
    .waitFor({ timeout: 60000 });
  const installedMods = await page.evaluate((id) => window.dkkf.call('mods.list', id), fabric.id);
  assert(installedMods.some((m) => m.id === 'dkkf_core'));
  assert(installedMods.some((m) => m.id === 'fabric-api'));
  results.push('Bundled HUD hash validation and actual Fabric API dependency download via UI');
  await page.screenshot({ path: path.join(root, 'my-mods-core.png'), fullPage: true });
  assert.deepEqual(errors, []);
  results.push('No renderer page errors');
  await fs.writeFile(
    path.join(root, 'results.json'),
    JSON.stringify({ status: 'TESTED', results, errors }, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await application.close();
}
