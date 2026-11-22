> **0.3.0 current release:** [변경·검증·로그인 설정](docs/RELEASE-0.3.0.md) · [공개 다운로드](https://dkkf-launcher.gitbal-cream.chatgpt.site). Earlier feature/test descriptions below may describe prior builds; see the release notes for current navigation and verification.

# Build — DKKF 0.3.0 / Minecraft 26.3 Fabric

## 고정 대상

| 구성                 | 버전                           |
| -------------------- | ------------------------------ |
| Minecraft            | 26.3                           |
| Fabric Loader        | 0.20.1                         |
| Fabric API           | 0.166.2+26.3                   |
| 게임 / JAR 최소 Java | 25 / class version 69          |
| 검증한 빌드 JDK      | 26.0.3.0                       |
| Gradle / Loom        | 9.5.0 / 1.17.21                |
| Launcher             | 0.3.0 (HUD core 0.3.0) |

공식 26.3은 비난독화되어 별도 Yarn mappings를 사용하지 않습니다. Loom과 Gradle은 위 호환 조합으로 고정했습니다. 최신 Loom 1.19.4는 Gradle 9.8 이상을 요구해 이 환경의 Gradle 9.5와 호환되지 않습니다.

## 런처 빌드

```powershell
pnpm install --frozen-lockfile
node node_modules/electron/install.js
pnpm test
pnpm build
pnpm start
# 개발 모드
pnpm dev
# Windows NSIS
pnpm package
```

Node.js 24 및 pnpm 11 환경에서 검증했습니다. 의존성은 lockfile에 고정합니다. 사용자는 런처를 실행하기 위해 Node/Gradle을 설치할 필요가 없습니다. 게임에는 별도 Java 25 이상이 필요합니다.

## 26.3 HUD 코어

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-26.0.3.0'
$env:GRADLE_USER_HOME='D:\DKKF-Client\.data\gradle26'
Set-Location client
D:\gradle-9.5.0\gradle-9.5.0\bin\gradle.bat build --no-daemon --console=plain
Set-Location ..
node scripts/sync-core.mjs
pnpm exec tsx scripts/verify-core.ts
pnpm package
```

실제 경로에 맞게 Java/Gradle 경로를 수정하세요. root Gradle은 `common`, `fabric26_3`을 빌드합니다. 결과는 `client/fabric26_3/build/libs/dkkf-core-fabric-26.3-0.2.0.jar`입니다. `sync-core`가 번들 리소스와 고정 SHA-256을 갱신합니다. 과거 `client/fabric`은 1.21.1 소스 보존용이며 현재 root 빌드에 포함하지 않습니다.

`shared/target.json`의 launcherVersion은 런처 버전(0.3.0), clientVersion은 HUD 버전(0.2.0)입니다. 런처만 수정할 때 기존 코어 JAR를 재빌드할 필요는 없습니다. 코어를 변경할 때 Gradle 버전과 core metadata를 함께 갱신하세요.

## 인증 설정

Dkkf Launcher 등록 앱의 공개 Client ID `[앱 내부 설정 — 문서에 표시하지 않음]`가 기본 적용됩니다. 2026-11-17 소유자가 Microsoft 승인을 받았다고 알려주었습니다. 이 기록은 실제 계정 로그인 테스트와 구분합니다. 포크에서 별도 앱을 사용할 경우 자신의 앱에 개인 계정 및 Device Code 흐름과 필요한 서비스 접근을 설정하세요.

기본 등록 ID를 사용해 Account에서 사용자 코드로 로그인합니다. 기존 비어 있는 ID는 한 번 자동 보완하며, 사용자 지정 ID는 보존합니다. 요청 scope는 `XboxLive.signin offline_access`입니다. Xbox → XSTS → Minecraft 토큰 → 실제 이용 권한 → 프로필 확인 후 계정을 등록합니다. 실제 사용자의 비밀번호·인증 코드는 개발자가 대신 입력하거나 수집하지 않습니다. 토큰은 safeStorage로 암호화합니다.

Overwolf/CurseForge 승인은 현재 대기 중입니다. 키가 발급되면 자신의 Studios API 키를 Settings에 저장하세요. 제작자가 외부 다운로드를 제한하면 중단하며 우회하지 않습니다. Modrinth 검색/다운로드는 공개 API를 사용하며 기존 프로젝트 업로드에는 해당 권한의 개인 토큰이 필요합니다.

공식 참고: [Minecraft manifest](https://piston-meta.mojang.com/mc/game/version_manifest_v2.json), [Fabric 26.3 example](https://github.com/FabricMC/fabric-example-mod/tree/26.3), [Fabric HUD](https://docs.fabricmc.net/develop/rendering/hud), [Microsoft device authorization](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code).

## 테스트

```powershell
pnpm test
pnpm exec tsx scripts/check-26.3.ts --install
pnpm exec tsx scripts/verify-core.ts
```

26.3 연동 테스트는 `.data/live-26.3`에 격리합니다. 수백 MB 이상의 공식 파일을 내려받습니다. 스크립트의 테스트용 Java 26 경로는 자신의 환경에 맞추세요. `scripts/live-check.ts`는 과거 1.21.1 회귀 검사로 보존했습니다.

패키징 UI 테스트는 `scripts/ui-check.mjs`를 사용합니다. `PLAYWRIGHT_MODULE_PATH`에 Playwright entry point, `DKKF_TEST_EXE`에 패키징 EXE를 지정하세요. 결과는 `.data/ui-check-26.3`에 저장됩니다. 인증된 실제 게임 플레이를 대신하는 테스트가 아닙니다.

전체 소스 ZIP과 체크섬은 최종 빌드/문서 완료 후 `node scripts/source-archive.mjs`로 생성합니다.
