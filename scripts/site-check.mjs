import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {_electron}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
await fs.mkdir('.data/site-check',{recursive:true});
const stamp=Date.now();
const app=await _electron.launch({executablePath:path.resolve('release/0.3.0/win-unpacked/Dkkf Launcher.exe'),env:{...process.env,DKKF_DATA_DIR:path.resolve('.data/site-check/data-'+stamp),DKKF_ELECTRON_PROFILE:path.resolve('.data/site-check/electron-'+stamp)},timeout:60000});
try{
 await app.firstWindow();
 const pending=app.waitForEvent('window');
 await app.evaluate(({BrowserWindow})=>{const w=new BrowserWindow({width:1440,height:1000,show:true,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});void w.loadURL('https://dkkf-launcher.gitbal-cream.chatgpt.site');});
 const page=await pending;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('heading',{name:'마인크래프트를 나만의 방식으로.'}).waitFor({timeout:60000});
 await page.getByRole('link',{name:'Windows용 다운로드'}).waitFor({timeout:60000});
 assert.equal(await page.title(),'Dkkf Launcher — 마인크래프트를 나만의 방식으로');
 assert.ok((await page.getByRole('link',{name:'Windows용 다운로드'}).getAttribute('href')).endsWith('Setup.exe'));
 await page.screenshot({path:'.data/site-check/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.data/site-check/mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);await fs.writeFile('.data/site-check/results.json',JSON.stringify({publicDownload:true,responsive:true,errors},null,2));
 console.log('Public site desktop/mobile/download checks passed.');
}finally{await app.close();}
