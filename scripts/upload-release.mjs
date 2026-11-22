import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const input=await new Promise(resolve=>{
 let value='';const terminal=process.stdin.isTTY;
 if(terminal)process.stdin.setRawMode(true);
 process.stderr.write('Ready for release JSON on stdin (input is hidden).\n');
 process.stdin.setEncoding('utf8');process.stdin.on('data',function onData(chunk){value+=chunk;if(value.includes('\n')||value.includes('\r')){process.stdin.removeListener('data',onData);if(terminal)process.stdin.setRawMode(false);process.stdin.pause();resolve(value);}});
});
const config=JSON.parse(input);
if(config.origin!=='https://dkkf-launcher.gitbal-cream.chatgpt.site')throw Error('Unexpected release origin');
if(config.files.some(file=>!path.basename(file).endsWith('-Setup.exe')&&path.basename(file)!=='SHA256SUMS.txt'))throw Error('Only installers and checksums may be published. Source archives stay local.');
async function post(route,body,binary=false){
 const r=await fetch(config.origin+'/api/admin/'+route,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+config.token,'Content-Type':binary?'application/octet-stream':'application/json'},body:binary?body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
 if(!r.ok)throw Error('Release request failed: '+r.status+' '+route.split('?')[0]);return r.json();
}
const uploaded=[];
for(const file of config.files){
 const data=await fs.readFile(file);const sha256=createHash('sha256').update(data).digest('hex');const name=path.basename(file);
 const {session}=await post('start',{file:name,size:data.length,sha256});const parts=[];
 try{
  for(let offset=0;offset<data.length;offset+=8*1024*1024){const part=parts.length+1;parts.push(await post('part?session='+session+'&part='+part,data.subarray(offset,offset+8*1024*1024),true));console.log(name+' part '+part);}
  await post('complete?session='+session,{parts});uploaded.push({name,sha256,size:data.length});
 }catch(error){await post('abort?session='+session,{}).catch(()=>{});throw error;}
}
let installer=uploaded.find(x=>x.name.endsWith('.exe'));
if(!installer){const current=await (await fetch(config.origin+'/api/release')).json();if(current.version!==config.version)throw Error('Existing installer version mismatch');installer={name:path.basename(current.installer),sha256:current.sha256,size:current.size};}
console.log(JSON.stringify(await post('publish',{version:config.version,installer:installer.name,sha256:installer.sha256,size:installer.size})));
