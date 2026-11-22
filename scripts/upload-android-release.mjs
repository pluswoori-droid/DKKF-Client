import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import AdmZip from 'adm-zip';
const input=await new Promise(resolve=>{
 let value='';const terminal=process.stdin.isTTY;
 if(terminal)process.stdin.setRawMode(true);
 process.stderr.write('Ready for Android release JSON on stdin (input is hidden).\n');
 process.stdin.setEncoding('utf8');process.stdin.on('data',function onData(chunk){value+=chunk;if(/[\r\n]/.test(value)){process.stdin.removeListener('data',onData);if(terminal)process.stdin.setRawMode(false);process.stdin.pause();resolve(value);}});
});
const config=JSON.parse(input);
if(config.origin!=='https://dkkf-launcher.gitbal-cream.chatgpt.site'||!/^\d+\.\d+\.\d+-preview$/.test(config.version))throw Error('Unexpected Android release target');
const prefix=`Dkkf-Launcher-Android-${config.version}-`;
const names=[prefix+'arm64.apk',prefix+'Source.zip',prefix+'SHA256SUMS.txt'];
if(!Array.isArray(config.files)||config.files.length!==3||names.some(name=>config.files.filter(file=>path.basename(file)===name).length!==1))throw Error('Only exact Android APK, corresponding source and checksums may be published');
const root=path.resolve('release/android',config.version);
if(config.files.some(file=>path.dirname(path.resolve(file))!==root))throw Error('Files must be in the Android delivery directory');
const source=new AdmZip(path.join(root,names[1]));
const entries=source.getEntries();
for(const entry of entries){
 const name=entry.entryName.replaceAll('\\','/');
 if(name.startsWith('/')||name.split('/').includes('..')||/^(?:launcher|shared|backend|distribution-site|client|release|\.data)\//i.test(name)||/(?:^|\/)(?:\.git|\.gradle|\.cxx|build|\.idea)(?:\/|$)/i.test(name)||/(?:\.jks|\.keystore|\.dpapi|\.pfx|\.p12|\.pem|\.key|\.sqlite|\.db)$/i.test(name)||/(?:^|\/)(?:local\.properties|\.env(?:\..*)?|accounts?\.json|.*vault.*\.(?:json|enc|bin))$/i.test(name))throw Error('Source archive contains a forbidden path');
}
if(!['LICENSE','COPYING-GPL3.txt','DKKF-ANDROID.md','gradlew.bat','app_pojavlauncher/build.gradle'].every(name=>entries.some(entry=>entry.entryName===name)))throw Error('Android source or required license is missing');
console.log('Android source scope and private-file exclusions verified: '+entries.length+' entries.');
async function post(route,body,binary=false){
 const response=await fetch(config.origin+'/api/admin/'+route,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+config.token,'Content-Type':binary?'application/octet-stream':'application/json'},body:binary?body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
 if(!response.ok)throw Error('Android release request failed: '+response.status+' '+route.split('?')[0]);return response.json();
}
const uploaded=[];
for(const name of names){
 const data=await fs.readFile(path.join(root,name));const sha256=createHash('sha256').update(data).digest('hex');
 const {session}=await post('start',{file:name,size:data.length,sha256});const parts=[];
 try{
  for(let offset=0;offset<data.length;offset+=8*1024*1024){const part=parts.length+1;parts.push(await post('part?session='+session+'&part='+part,data.subarray(offset,offset+8*1024*1024),true));console.log(name+' part '+part);}
  await post('complete?session='+session,{parts});uploaded.push({name,sha256,size:data.length});
 }catch(error){await post('abort?session='+session,{}).catch(()=>{});throw error;}
}
const [apk,archive,checksums]=uploaded;
console.log(JSON.stringify(await post('publish-android',{version:config.version,apk:apk.name,source:archive.name,checksums:checksums.name,sha256:apk.sha256,sourceSha256:archive.sha256,size:apk.size,sourceSize:archive.size})));
