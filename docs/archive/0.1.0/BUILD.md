# Build and authentication setup

## 검증한 개발 환경

- Windows 11 x64
- Node.js 24.22.1 / pnpm 11.25.0
- Electron 45.3.3 / React 19.3.1 / Vite 8.3.8 / TypeScript 5.9.3
- Java 21.0.10 / Gradle 8.8 (Fabric 코어)
- 빌드 의존성 버전과 무결성은 `pnpm-lock.yaml`에 고정

## 런처

PowerShell에서 프로젝트 루트로 이동한 뒤:

```powershell
pnpm install --frozen-lockfile
# Electron 45 npm 패키지는 최초 런타임 설치를 별도로 실행합니다.
node node_modules/electron/install.js
pnpm test
pnpm build
pnpm start
# 개발 시
pnpm dev
# Windows 설치 프로그램
pnpm package
```

pnpm이 없는 시스템은 Node.js 설치 후 공식 pnpm 설치 문서에 따라 pnpm을 준비하세요. 본 환경의 런타임에는 npm 명령이 없어 번들 pnpm CLI를 사용했습니다. 앱 사용자는 Node/Gradle/pnpm을 설치할 필요가 없습니다. 게임 실행에는 해당 버전에 맞는 Java가 필요합니다.

`pnpm-workspace.yaml`에서 esbuild 빌드 스크립트만 허용하며 Electron 런타임은 위 명령으로 명시적으로 설치합니다. electron-winstaller는 NSIS 빌드에 필요하지 않아 빌드 스크립트를 비활성화했습니다.

`pnpm package`는 TypeScript → Vite → Electron main/preload 번들 → electron-builder NSIS 순서로 실행합니다. 최종 실행 앱은 `release/win-unpacked`, 설치 프로그램은 `release`에 생성됩니다. 기본 빌드는 Windows 코드서명이 **없습니다**. 공개 배포에는 자신의 서명 인증서·게시자 정보·자동 업데이트 검증을 별도로 구성하세요.

## Fabric Client Core (Minecraft 1.21.1)

```powershell
$env:JAVA_HOME='C:\path\to\jdk-21'
# 필요하면 Gradle 캐시를 지정합니다.
$env:GRADLE_USER_HOME='D:\DKKF-Client\.data\gradle'
Set-Location client
gradle build --no-daemon --console=plain
Set-Location ..
node scripts/sync-core.mjs
pnpm package
```

시스템 Gradle 8.8을 사용하세요. Gradle wrapper 바이너리는 아직 포함하지 않았습니다. 결과는 `client/fabric/build/libs/dkkf-core-fabric-1.21.1-0.1.0.jar`입니다. sync-core는 번들 리소스와 `shared/core-build.json`의 고정 해시를 갱신합니다. Java API 어댑터 변경 시 다른 Minecraft 버전에서 빌드 성공을 가정하지 마세요.

Forge/NeoForge/Quilt HUD 모듈은 미구현이며 이 빌드에 포함되지 않습니다. 각 로더의 **게임 설치** 기능과 **DKKF HUD 모듈**은 별개입니다.

## Microsoft 인증 — 외부 준비 필요

1. 자신이 관리하는 Microsoft Entra 앱을 등록합니다. 개인 Microsoft 계정을 지원하도록 구성하세요.
2. 앱 인증 설정에서 공개 클라이언트 흐름(Device Code)을 허용합니다. 클라이언트 시크릿을 런처에 넣지 마세요.
3. 해당 앱의 Xbox Live/Minecraft 서비스 이용에 필요한 Microsoft 승인·온보딩을 완료합니다. 일반 Entra 앱 ID 등록만으로 Minecraft API 사용이 보장되지 않습니다. 다른 런처의 ID를 빌려 쓰지 마세요.
4. 앱의 공개 Client ID를 런처 Settings에 입력합니다. 요청 scope는 `XboxLive.signin offline_access`입니다.
5. Account에서 로그인 버튼을 누르고, 표시된 코드를 Microsoft 공식 브라우저 페이지에 직접 입력합니다.
6. 실제 로그인은 Microsoft 토큰 → Xbox User Token → XSTS → Minecraft 토큰 → 게임 권한 → 프로필 순서로 수행합니다. 오류가 나면 성공 계정을 만들지 않습니다. 성인/자녀 계정·지역·Xbox 약관·서비스 승인 등 실제 계정 조합 테스트가 필요합니다.

앱 등록·승인과 사용자의 인증 동의는 개발자가 대신 만들거나 우회할 수 없습니다. 현재 빌드는 자신의 ID를 설정하기 전 인증을 차단합니다.

공식 참고: [Microsoft device authorization](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code), [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage), [Electron 보안](https://www.electronjs.org/docs/latest/tutorial/security).

## 플랫폼 API

Modrinth 공개 검색·다운로드는 키 없이 동작합니다. 기존 프로젝트 버전 업로드에는 자신이 소유하거나 업로드 권한을 받은 프로젝트와 Modrinth 개인 토큰이 필요합니다. 팀 권한을 조회한 뒤 업로드하며 실제 게시 테스트는 수행하지 않았습니다.

CurseForge는 자신에게 발급된 공식 Studios API 키를 Settings에서 저장하세요. 키는 safeStorage로 암호화하며 다운로드 요청에만 main 프로세스에서 사용합니다. 제작자가 배포를 제한하여 API가 downloadUrl을 제공하지 않으면 사용자에게 제한을 표시하고 중단합니다. 웹 스크래핑·대체 URL 추정·제한 우회를 구현하지 않았습니다.

공식 참고: [Modrinth API](https://docs.modrinth.com/api/), [CurseForge REST API](https://docs.curseforge.com/rest-api/), [Fabric Meta](https://meta.fabricmc.net/), [Quilt Meta](https://meta.quiltmc.org/).

## 검증 명령

```powershell
pnpm test
pnpm test:live
# 공식 게임 파일 전체 다운로드 및 다섯 로더 설치 (수백 MB 이상)
pnpm exec tsx scripts/live-check.ts --install
```

live-check는 `.data/live-check`에 격리된 인스턴스를 만들고 `results.json`을 남깁니다. 테스트용 Java 경로는 스크립트 내 현재 머신의 Java 21 경로이므로 다른 머신에서는 수정하세요. 실제 게임 계정 인증·게시·배포 설치는 자동으로 수행하지 않습니다.

UI 테스트는 `scripts/ui-check.mjs`를 사용합니다. `PLAYWRIGHT_MODULE_PATH`에 설치한 Playwright의 entry point 절대 경로, `DKKF_TEST_EXE`에 검증할 패키징된 EXE를 지정하세요. 결과와 PNG는 `.data/ui-check`에 저장됩니다.
