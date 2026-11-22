import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Store } from '../launcher/main/store';
import { Updater } from '../launcher/main/updater';
const root=path.resolve('.data/live-update-0.3.2');
const store=await new Store(root).init(path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'));
try {
 const updater=new Updater(store,()=>{}, {version:'0.3.1',packaged:false,quit:()=>{throw Error('Live verification must not install or exit');}});
 const result=await updater.check();assert.equal(result.status,'available');assert.equal(result.version,'0.3.2');
 const downloaded=await updater.fetch(new AbortController().signal);assert.equal(downloaded.status,'ready');assert(updater.ready);
 await assert.rejects(()=>updater.install(),/패키징/);
 await fs.writeFile(path.join(root,'results.json'),JSON.stringify({signatureVerified:true,realInstallerDownloaded:true,sha256AndSizeVerified:true,installerExecuted:false,version:result.version},null,2));
 console.log('Live signed update manifest and actual installer download verified; installer not executed.');
}finally{store.close();}
