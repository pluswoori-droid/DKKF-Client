> **0.3.0 current release:** [변경·검증·로그인 설정](docs/RELEASE-0.3.0.md) · [공개 다운로드](https://dkkf-launcher.gitbal-cream.chatgpt.site). Earlier feature/test descriptions below may describe prior builds; see the release notes for current navigation and verification.

# Update service deployment

이 서비스는 **배포 설정이 필요한 개발 구현**입니다. 운영 도메인·TLS·비공개 서명키·Windows 코드서명·실제 업데이트 설치/롤백 검증은 제공되지 않았습니다.

## 서버

```powershell
$env:DKKF_UPDATE_DIR='D:\DKKF-Client\backend\update-server\releases'
$env:DKKF_ADMIN_TOKEN='<본인이 생성한 충분히 긴 무작위 토큰>'
$env:DKKF_SIGNING_KEY='<배포 서버에서만 접근 가능한 Ed25519 개인키 파일>'
pnpm server
```

서버는 기본 `127.0.0.1:8787`에 바인딩합니다. 운영 환경에서는 Caddy/nginx 등 역방향 프록시로 유효한 인증서의 **HTTPS/WSS**만 외부에 공개하세요. HTTP 서비스 포트를 인터넷에 직접 열지 마세요. 관리자 POST에는 별도 접근 제한·속도 제한을 적용하세요.

- `GET /health`: 서비스 상태
- `GET /stable.json`, `/beta.json`: 서명된 업데이트 envelope
- `GET /DKKF-Client-X.Y.Z-Setup.exe`: 설치 파일
- `WSS /announcements`: 서명된 공지
- `POST /api/announcement`: 관리자 Bearer 토큰 필요. JSON `{ "message": "공지" }`. 서버의 Ed25519 키로 서명한 뒤 연결된 클라이언트에 전송

공지 payload는 message와 published 필드로 구성됩니다. 런처는 저장된 공개키로 서명을 확인하고 5분 이상 오래되거나 미래인 공지를 거부합니다. 재접속·영속 공지 기록·수평 확장·운영 모니터링은 아직 없습니다.

## Ed25519 키와 매니페스트

키는 운영자가 오프라인 또는 비밀 관리 시스템에서 생성하세요. 개발자가 임의 운영 신뢰키를 생성하여 런처에 심지 않았습니다. 개인키는 소스 저장소·설치 프로그램·renderer·웹 루트에 포함하지 마세요. 공개키만 런처 Settings에 PEM으로 등록합니다.

설치 프로그램이 완성되면:

```powershell
pnpm exec tsx scripts/sign-update.ts `
  release/DKKF-Client-0.2.0-Setup.exe `
  https://updates.example.com/DKKF-Client-0.2.0-Setup.exe `
  0.2.0 `
  D:/secure/update-private.pem `
  backend/update-server/releases/stable.json
```

실제 새 버전은 package.json의 버전을 증가시키고 재빌드한 뒤 해당 버전으로 서명하세요. 현재 도구는 stable 채널을 생성합니다. beta는 payload.channel을 beta로 설정한 뒤 **다시 서명**해야 합니다.

서명 대상은 `Buffer.from(JSON.stringify(payload))`의 바이트입니다. envelope의 필드 순서나 payload 내용을 바꾸지 마세요. payload 필드는 version/channel/target(`launcher`)/url/sha256/size/published/notes입니다. 서명은 Base64 Ed25519입니다. CDN이 설치 파일을 다른 호스트로 리디렉션하면 현재 정책상 차단될 수 있으므로 최종 호스트에서 직접 제공하세요.

## 런처 동작과 한계

Settings의 업데이트 URL과 신뢰키를 모두 설정해야 동작합니다. 기본 Stable/자동 확인 활성화이며 시작 시·5분 간격으로 검사합니다. 서명을 먼저 검증하고 채널·버전·HTTPS를 확인합니다. 다운로드는 별도 updates 폴더에 저장하고 SHA-256·size를 검사합니다. 취소/실패 시 실행 중인 설치를 수정하지 않습니다. 게임 실행 중 다운로드/설치를 시작하지 않습니다.

현재 설치는 Update Center에서 버튼을 누르면 검증된 NSIS 설치 프로그램을 별도 프로세스로 시작하고 런처를 종료합니다. **무인 설치·설치 후 상태 확인·업데이트 후 자동 롤백·이전 바이너리 보관·Client Core/HUD 자동 배포는 미구현**입니다. 따라서 상용 자동 업데이트로 배포하기 전 별도 updater helper, 설치 결과 검증, 실패 복구 및 키 교체 정책을 구현·테스트해야 합니다. 수동 복구를 위해 운영자는 이전 정상 설치 파일을 따로 보관하세요.

NSIS 빌드는 현재 Windows Authenticode 코드서명이 없습니다. Ed25519 매니페스트 서명과 Windows 게시자 코드서명은 서로 다른 검증입니다.

## Public artifact policy (0.4.0)
User selected installer-only publication. Use scripts/installer-release.mjs and upload-release.mjs with the installer and SHA256SUMS.txt only. Complete source ZIPs remain local; source archive upload/download is disabled on the distribution worker.

