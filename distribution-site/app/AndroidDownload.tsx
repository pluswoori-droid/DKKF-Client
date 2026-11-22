'use client';
import {useEffect,useState} from 'react';
type AndroidRelease={ready:boolean;version:string;apk:string;source:string;checksums:string;size:number;sourceSize:number};
export default function AndroidDownload(){
 const [release,setRelease]=useState<AndroidRelease>();const [error,setError]=useState('');
 async function refresh(){try{const response=await fetch('/api/android-release',{cache:'no-store'});if(!response.ok)throw Error();setRelease(await response.json());setError('');}catch{setError('다운로드 정보를 불러오지 못했습니다.');}}
 useEffect(()=>{void refresh();},[]);
 return <section className="android-download" id="android"><div><span className="eyebrow-site">ANDROID · ARM64 · PREVIEW</span><h2>모바일에서도 DKKF.</h2><p>Java 25와 Fabric 26.3, 서버 필수 모드 다섯 개를 준비하고 dkkf.mc-hosting.xyz로 연결하는 Android 미리보기입니다.</p><p>APK 설치 후 Minecraft Java Edition을 보유한 Microsoft 계정으로 로그인하고 DKKF 프로필에서 플레이하세요. 첫 준비에는 인터넷 연결이 필요합니다.</p></div><div className="android-card">{release?.ready?<><h3>Android {release.version}</h3><a className="download-main" href={release.apk}>ARM64 APK 다운로드 · {(release.size/1024/1024).toFixed(0)} MB</a><div className="android-links"><a href={release.source}>Android 소스 ZIP · {(release.sourceSize/1024/1024).toFixed(0)} MB</a><a href={release.checksums}>SHA-256 체크섬</a></div></>:<><h3>Android 미리보기 준비 중</h3><p>{error||'배포 파일을 확인하고 있습니다.'}</p><button onClick={()=>void refresh()}>다시 확인</button></>}<p><strong>호환성 안내</strong><br/>실제 Galaxy 설치·로그인·게임 실행은 아직 검증하지 않았습니다. 일부 그래픽 라이브러리는 4 KB 정렬이며 Android 16 이상에서 페이지 크기 호환 모드를 사용합니다. 모든 최신 Galaxy에서 실행을 보장하지 않습니다.</p><p>DKKF 개발자 키로 서명한 APK입니다. LGPL에 따른 해당 Android 수정 소스를 함께 제공합니다. Windows 소스·계정 정보·서명 개인키는 공개 파일에 포함하지 않습니다.</p></div></section>;
}
