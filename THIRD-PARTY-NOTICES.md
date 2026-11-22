> **0.3.0 current release:** [변경·검증·로그인 설정](docs/RELEASE-0.3.0.md) · [공개 다운로드](https://dkkf-launcher.gitbal-cream.chatgpt.site). Earlier feature/test descriptions below may describe prior builds; see the release notes for current navigation and verification.

# Third-party components

DKKF는 Mojang/Microsoft와 제휴하거나 보증받은 제품이 아닙니다. Minecraft Java Edition과 Microsoft 계정의 정상 이용 권한이 필요합니다. Minecraft 게임 파일은 공식 서버에서 각 사용자의 인스턴스로 내려받으며 배포 설치 프로그램에 포함하지 않습니다.

런처는 Electron, Chromium/Node.js, React, Vite, TypeScript, sql.js/SQLite, adm-zip, ws, Zod 및 빌드 도구를 사용합니다. 각 패키지 원본 LICENSE/NOTICE와 Electron 배포 LICENSE/Chromium license 자료를 유지해야 합니다. `pnpm-lock.yaml`은 사용한 전이 의존성을 기록합니다. 공개 배포 전 전체 라이선스 목록/SBOM과 취약점 검토를 완료하세요.

Fabric HUD는 Fabric Loader/API와 Minecraft API에 의존하며 Fabric API는 별도 공식 다운로드로 설치합니다. Fabric Loader/API·Forge·NeoForge·Quilt 및 Modrinth/CurseForge의 상표·서비스·배포 조건은 각 권리자에게 속합니다.

모드팩 내보내기는 플랫폼 파일 ID 또는 공식 다운로드 URL/해시를 기록하고 외부 JAR를 포함하지 않습니다. 라이선스가 불명인 로컬 모드는 공유 내보내기를 거부합니다. 개인 모드 백업 ZIP을 공개 재배포하지 마세요.

DKKF 자체 소스·로고는 프로젝트 소유자가 라이선스를 정하기 전까지 All Rights Reserved입니다. 이 문서는 개별 의존성 라이선스를 대체하지 않습니다.

## 0.6.0 server profile

Fabric API 0.166.2+26.3 and TaCZ Reforged 1.1.8+mc26.3 are downloaded from their official distribution CDNs on installation; they are not bundled in the public launcher installer. TaCZ file metadata declares GPL-3.0-only for code and CC BY-NC-ND 4.0 for assets; the CurseForge page labels LGPLv3. The launcher does not change these files or claim ownership. The supplied mod 3 Fabric JAR (trollvideo 1.0.0) is bundled at the owner’s request.
