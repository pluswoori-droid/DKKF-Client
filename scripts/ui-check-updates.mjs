import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {_electron}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const root=path.resolve('.data/ui-check-updates-0.3.2');await fs.mkdir(root,{recursive:true});
const app=await _electron.launch({executablePath:path.resolve('release/0.3.2/win-unpacked/Dkkf Launcher.exe'),env:{...process.env,DKKF_DATA_DIR:path.join(root,'data'),DKKF_ELECTRON_PROFILE:path.join(root,'electron')},timeout:60000});
try{
 const page=await app.firstWindow();await page.getByRole('heading',{name:'반가워요.'}).waitFor();
 const state=await page.evaluate(()=>window.dkkf.call('state'));assert.equal(state.version,'0.3.2');assert.equal(state.settings.autoUpdate,true);assert(state.settings.updateKey.includes('BEGIN PUBLIC KEY'));assert.equal(new URL(state.settings.updateUrl).hostname,'dkkf.xn--oi2b61z32a.xn--3e0b707e');
 await page.locator('nav').getByRole('button',{name:'업데이트',exact:true}).click();
 await page.getByRole('button',{name:'업데이트 확인',exact:true}).click();await page.getByRole('heading',{name:'최신 버전입니다',exact:true}).waitFor();
 await page.getByText('새 버전을 자동으로 다운로드하고, 게임 종료 후 런처를 닫을 때 적용합니다.',{exact:true}).waitFor();
 await page.screenshot({path:path.join(root,'updates.png')});
 await fs.writeFile(path.join(root,'results.json'),JSON.stringify({packagedVersion:'0.3.2',defaultAutoUpdate:true,configuredTrust:true,liveCheckCurrent:true},null,2));console.log('Packaged automatic-update defaults and live current-version UI passed.');
}finally{await app.close();}
