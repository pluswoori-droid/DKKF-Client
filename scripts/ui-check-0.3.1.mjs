// Synthetic renderer fixture only. Never signs in or changes real account/game state.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
const { _electron } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const root = path.resolve('.data/ui-check-0.3.1');
await fs.mkdir(root, { recursive: true });
const face = new PNG({ width: 8, height: 8 });face.data.fill(255);
const skinFace = 'data:image/png;base64,' + PNG.sync.write(face).toString('base64');
const app = await _electron.launch({ executablePath: path.resolve('release/0.3.1/win-unpacked/Dkkf Launcher.exe'), env: { ...process.env, DKKF_DATA_DIR: path.join(root, 'data'), DKKF_ELECTRON_PROFILE: path.join(root, 'electron') }, timeout: 60000 });
try {
 const actual = await app.firstWindow();await actual.getByRole('heading', { name: '반가워요.' }).waitFor();
 assert.equal(await actual.locator('nav').getByRole('button', { name: '업로드 센터', exact: true }).count(), 0);
 const next = app.waitForEvent('window');
 await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ width: 1440, height: 1000, show: true, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } }); void w.loadURL("about:blank"); });
 const page = await next;const errors=[];page.on('pageerror', e=>errors.push(e.message));
 await page.addInitScript(({skinFace}) => {
  const instance = {id:'fixture-one',name:'UI 테스트 인스턴스',version:'26.3',loader:'fabric',loaderVersion:'0.20.1',ram:4096,limitRam:false,created:new Date().toISOString(),installed:true};
  const state={version:'0.3.1',instances:[instance,{...instance,id:'fixture-two',name:'두 번째 테스트 인스턴스'}],selected:instance.id,accounts:[{id:'synthetic-only',name:'FixturePlayer',skinFace,expires:0}],activeAccount:'synthetic-only',settings:{javaPath:'',ram:4096,limitRam:false,limitResolution:false,width:1280,height:720,fullscreen:false,autoUpdate:false,channel:'stable',microsoftClientId:'fixture',updateUrl:'',updateKey:'',language:'ko'},packs:[],busy:false};
  const listeners=[];const mods=[{id:'fabric-api',file:'fixture.jar',name:'Fabric API',version:'1',enabled:true,authors:[],depends:[],warnings:[],sha256:'fixture',source:{provider:'modrinth',project:'api',version:'v1'}},{id:'disabled',file:'disabled.jar',name:'Disabled Fixture',version:'1',enabled:false,source:{provider:'modrinth',project:'disabled',version:'v1'}}];
  const hits=[['api','Fabric API'],['disabled','Disabled Fixture'],['new','New Fixture']].map(([id,title])=>({id,title,provider:'modrinth',description:'테스트 전용 모드',author:'Fixture',downloads:1}));
  window.fixture={state,listeners};
  window.dkkf={onEvent(fn){listeners.push(fn);return()=>{};},async call(method,args){
   if(method==='state')return structuredClone(state);
   if(method==='mods.list')return args===instance.id?structuredClone(mods):[];
   if(method==='mods.search')return structuredClone(hits);
   if(method==='mods.detail')return {versions:[{id:'v1',name:'Fixture v1'}],license:'Fixture',url:'https://modrinth.com'};
   if(method==='mods.install'){mods.push({id:'new',file:'new.jar',name:'New Fixture',version:'1',enabled:true,source:{provider:'modrinth',project:'new',version:'v1'}});return true;}
   if(method==='auth.avatar')return state.accounts[0];
   if(method==='instances.edit')return state.instances[0];
   throw Error('Unexpected fixture call: '+method);
  }};
 },{skinFace});
 await page.goto(pathToFileURL(path.resolve('dist/renderer/index.html')).href);
 await page.locator('nav').getByRole('button',{name:'계정',exact:true}).click();
 await page.getByRole('heading',{name:'FixturePlayer님으로 연결되었습니다.'}).waitFor();
 const faces=page.getByAltText('FixturePlayer 스킨 얼굴');assert.equal(await faces.count(),2);
 assert.equal(await faces.first().evaluate(img=>img.complete&&img.naturalWidth===8),true);
 await page.screenshot({path:path.join(root,'account.png')});
 await page.locator('nav').getByRole('button',{name:'인스턴스',exact:true}).click();
 await page.getByRole('button',{name:'편집',exact:true}).first().click();
 await page.getByRole('tab',{name:'모드 검색',exact:true}).click();
 await page.locator('.modcard-installed').first().waitFor();
 assert.equal(await page.locator('.modcard-installed').count(),2);
 assert.equal(await page.locator('.modcard-installed').first().evaluate(el=>getComputedStyle(el).opacity),'0.48');
 await page.getByText('✓ 설치됨 · 비활성',{exact:true}).waitFor();
 await page.getByRole('button',{name:/New Fixture/}).click();
 await page.getByRole('button',{name:'↓ 모드 설치',exact:true}).click();
 await page.locator('.modcard-installed').nth(2).waitFor();
 await page.screenshot({path:path.join(root,'installed-mods.png')});
 await page.getByRole('button',{name:/New Fixture/}).click();
 assert.equal(await page.getByRole('button',{name:'✓ 이미 설치된 버전',exact:true}).isDisabled(),true);
 assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(root,'results.json'),JSON.stringify({syntheticRendererFixture:true,actualPackageStartup:true,accountFaces:true,installedOpacity:0.48,disabledModsRecognized:true,installRefresh:true,duplicateVersionDisabled:true,errors},null,2));
 console.log('Account face and installed-mod presentation checks passed (synthetic renderer fixture).');
} finally { await app.close(); }
