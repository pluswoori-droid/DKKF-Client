const windowsFilenamePattern=/^(?:Dkkf-Launcher-\d+\.\d+\.\d+-Setup\.exe|SHA256SUMS\.txt)$/;
const androidFilenamePattern=/^Dkkf-Launcher-Android-\d+\.\d+\.\d+(?:-preview)?-(?:arm64\.apk|Source\.zip|SHA256SUMS\.txt)$/;
const filenamePattern={test:(name:string)=>windowsFilenamePattern.test(name)||androidFilenamePattern.test(name)};
const contentType=(name:string)=>name.endsWith('.txt')?'text/plain; charset=utf-8':name.endsWith('.apk')?'application/vnd.android.package-archive':name.endsWith('.zip')?'application/zip':'application/octet-stream';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function authorized(request:Request,secret?:string){
 if(!secret||secret.length<32)return false;
 const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',new TextEncoder().encode(request.headers.get('authorization')||'')),crypto.subtle.digest('SHA-256',new TextEncoder().encode('Bearer '+secret))]);
 const aa=new Uint8Array(a),bb=new Uint8Array(b);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0;
}
export async function releaseRequest(request:Request,env:Cloudflare.Env):Promise<Response|null>{
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/admin/')&&!url.pathname.startsWith('/downloads/')&&!['/api/release','/api/android-release','/stable.json','/beta.json'].includes(url.pathname))return null;
 const bucket=env.BUCKET;if(!bucket)return reply({error:'Release storage is not configured'},503);
 try{
  if(['/stable.json','/beta.json'].includes(url.pathname)&&['GET','HEAD'].includes(request.method)){
   const manifest=await bucket.get('updates'+url.pathname);
   if(!manifest)return reply({error:'No release in this channel'},404);
   return new Response(request.method==='HEAD'?null:manifest.body,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(url.pathname==='/api/release'&&request.method==='GET'){
   const latest=await bucket.get('latest.json');if(!latest)return reply({ready:false},503);
   return new Response(latest.body,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
  }
  if(url.pathname==='/api/android-release'&&request.method==='GET'){
   const latest=await bucket.get('android-latest.json');if(!latest)return reply({ready:false});
   return new Response(latest.body,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(url.pathname.startsWith('/downloads/')&&['GET','HEAD'].includes(request.method)){
   const key=decodeURIComponent(url.pathname.slice('/downloads/'.length));if(!filenamePattern.test(key))return reply({error:'Not found'},404);
   const object=request.method==='HEAD'?await bucket.head(key):await bucket.get(key);if(!object)return reply({error:'Not found'},404);
   const headers=new Headers({'Content-Type':contentType(key),'Content-Length':String(object.size),'Content-Disposition':`attachment; filename="${key}"`,'ETag':object.httpEtag,'X-Content-Type-Options':'nosniff','Cache-Control':key.endsWith('.txt')?'no-cache':'public, max-age=3600'});
   if(object.customMetadata?.sha256)headers.set('X-Checksum-SHA256',object.customMetadata.sha256);
   return new Response(request.method==='HEAD'?null:(object as R2ObjectBody).body,{headers});
  }
  if(!url.pathname.startsWith('/api/admin/'))return reply({error:'Method not allowed'},405);
  if(!await authorized(request,env.RELEASE_ADMIN_TOKEN))return reply({error:'Unauthorized'},401);
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  if(url.pathname==='/api/admin/start'){
   const body=await request.json() as {file:string;sha256:string;size:number};
   if(!filenamePattern.test(body.file)||!/^[a-f0-9]{64}$/i.test(body.sha256)||!Number.isInteger(body.size)||body.size<1||body.size>512*1024*1024)return reply({error:'Invalid release metadata'},400);
   const multipart=await bucket.createMultipartUpload(body.file,{httpMetadata:{contentType:contentType(body.file)},customMetadata:{sha256:body.sha256}});
   const session=crypto.randomUUID();await bucket.put('sessions/'+session,JSON.stringify({...body,uploadId:multipart.uploadId,created:Date.now()}));return reply({session});
  }
  if(['/api/admin/part','/api/admin/complete','/api/admin/abort'].includes(url.pathname)){
   const session=url.searchParams.get('session')||'';if(!/^[a-f0-9-]{36}$/.test(session))return reply({error:'Invalid session'},400);
   const saved=await bucket.get('sessions/'+session);if(!saved)return reply({error:'Session not found'},404);
   const record=await saved.json<{file:string;uploadId:string;size:number;created:number}>();if(Date.now()-record.created>3600000)return reply({error:'Session expired'},410);
   const multipart=bucket.resumeMultipartUpload(record.file,record.uploadId);
   if(url.pathname==='/api/admin/abort'){await multipart.abort();await bucket.delete('sessions/'+session);return reply({aborted:true});}
   if(url.pathname==='/api/admin/part'){
    const part=Number(url.searchParams.get('part')),size=Number(request.headers.get('content-length'));
    if(!Number.isInteger(part)||part<1||part>10000||!request.body||size<=0||size>10*1024*1024)return reply({error:'Invalid part'},400);
    return reply(await multipart.uploadPart(part,request.body));
   }
   const body=await request.json() as {parts:R2UploadedPart[]};
   if(!Array.isArray(body.parts)||!body.parts.length||body.parts.some(p=>!Number.isInteger(p.partNumber)||typeof p.etag!=='string'))return reply({error:'Invalid parts'},400);
   const object=await multipart.complete(body.parts);await bucket.delete('sessions/'+session);
   if(object.size!==record.size)return reply({error:'Size mismatch'},409);return reply({file:record.file,size:object.size});
  }
  if(url.pathname==='/api/admin/publish-android'){
   const body=await request.json() as {version:string;apk:string;source:string;checksums:string;sha256:string;sourceSha256:string;size:number;sourceSize:number};
   if(!/^\d+\.\d+\.\d+(?:-preview)?$/.test(body.version))return reply({error:'Invalid Android version'},400);
   const prefix=`Dkkf-Launcher-Android-${body.version}-`;
   if(body.apk!==prefix+'arm64.apk'||body.source!==prefix+'Source.zip'||body.checksums!==prefix+'SHA256SUMS.txt'||![body.sha256,body.sourceSha256].every(hash=>/^[a-f0-9]{64}$/.test(hash))||![body.size,body.sourceSize].every(size=>Number.isInteger(size)&&size>0&&size<=512*1024*1024))return reply({error:'Invalid Android release'},400);
   const [apk,source,checksums]=await Promise.all([bucket.head(body.apk),bucket.head(body.source),bucket.get(body.checksums)]);
   if(!apk||!source||!checksums||checksums.size>4096||apk.size!==body.size||source.size!==body.sourceSize||apk.customMetadata?.sha256!==body.sha256||source.customMetadata?.sha256!==body.sourceSha256)return reply({error:'Upload verified Android files first'},409);
   const expected=`${body.sha256}  ${body.apk}\n${body.sourceSha256}  ${body.source}\n`;
   if((await checksums.text()).replace(/\r\n/g,'\n')!==expected)return reply({error:'Android checksum file mismatch'},409);
   const latest={ready:true,platform:'android',version:body.version,apk:'/downloads/'+body.apk,source:'/downloads/'+body.source,checksums:'/downloads/'+body.checksums,sha256:body.sha256,sourceSha256:body.sourceSha256,size:apk.size,sourceSize:source.size,published:new Date().toISOString(),preview:body.version.endsWith('-preview'),abi:'arm64-v8a',apkSigned:true};
   await bucket.put('android-latest.json',JSON.stringify(latest),{httpMetadata:{contentType:'application/json'}});return reply(latest);
  }
  if(url.pathname==='/api/admin/publish'){
   const body=await request.json() as {version:string;installer:string;source?:string;sha256:string;sourceSha256?:string;size:number};
   if(body.source||body.sourceSha256)return reply({error:'Source publication is disabled. Publish installer and checksums only.'},400);
   if(!/^\d+\.\d+\.\d+$/.test(body.version)||body.installer!==`Dkkf-Launcher-${body.version}-Setup.exe`||!/^[a-f0-9]{64}$/i.test(body.sha256))return reply({error:'Invalid release'},400);
   const [installer,checksums]=await Promise.all([bucket.head(body.installer),bucket.head('SHA256SUMS.txt')]);
   if(!installer||!checksums||installer.size!==body.size||installer.customMetadata?.sha256!==body.sha256)return reply({error:'Upload verified release files first'},409);
   const latest={ready:true,version:body.version,installer:'/downloads/'+body.installer,source:null,checksums:'/downloads/SHA256SUMS.txt',sha256:body.sha256,size:installer.size,published:new Date().toISOString(),signed:false};
   if(!env.RELEASE_SIGNING_PKCS8)return reply({error:'Update signing is not configured'},503);
   const payload={version:body.version,channel:'stable',target:'launcher',url:'https://dkkf.xn--oi2b61z32a.xn--3e0b707e'+latest.installer,sha256:body.sha256,size:installer.size,published:latest.published,notes:'Dkkf Launcher '+body.version+' 업데이트'};
   const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(env.RELEASE_SIGNING_PKCS8),c=>c.charCodeAt(0)),{name:'Ed25519'},false,['sign']);
   const signature=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('Ed25519',key,new TextEncoder().encode(JSON.stringify(payload))))));
   await bucket.put('updates/stable.json',JSON.stringify({payload,signature}),{httpMetadata:{contentType:'application/json'}});
   await bucket.put('latest.json',JSON.stringify(latest),{httpMetadata:{contentType:'application/json'}});return reply(latest);
  }
  return reply({error:'Not found'},404);
 }catch{return reply({error:'Release operation failed'},500);}
}
