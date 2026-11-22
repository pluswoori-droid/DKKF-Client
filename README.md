> **0.6.2:** 필요한 Java가 없으면 자동 설치합니다. [변경 사항](docs/RELEASE-0.6.2.md).

# Dkkf Launcher — Windows & Android source

Windows **0.6.2** and Android **0.1.1-preview** source snapshot. Android includes the login activity manifest fix reported on Galaxy Z Fold 4.

- Windows: `launcher/`, `shared/`, `backend/`; native mod/HUD/server bridge source: `client/`.
- Android: `android/`, based on Amethyst/Pojav; see `android/DKKF-ANDROID.md`, `android/LICENSE` and `android/COPYING-GPL3.txt` for build instructions, upstream attribution and LGPLv3 terms.
- Distribution website: `distribution-site/`; deployment identity and runtime secrets are omitted.
- Microsoft app identifiers are blank in this source snapshot. Configure your own registration; see [authentication configuration](AUTHENTICATION.md).
- Large bundled binaries use **Git LFS**. Install Git LFS before cloning, or run `git lfs install` and `git lfs pull` after cloning. No Minecraft game files, user accounts, login tokens or private signing keys are included.
- Windows build: install dependencies using `pnpm install --frozen-lockfile`, then `pnpm build` and `pnpm package`. Android needs a locally configured SDK and your own signing key.
- Additional execution tests were skipped at the owner's request; this publication does not claim verified Galaxy game compatibility.

Windows code retains its existing `UNLICENSED` status; publishing source does not relicense it. Android and bundled third-party components retain their own license notices.

Contact: pluswoori@gmail.com

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.

---

## Windows release history

# Dkkf Launcher 0.6.1

DKKF 서버 전용 Minecraft 26.3 Fabric 런처. 모드팩 설치 시 TaCZ Reforged·Fabric API·첨부 mod 3를 확인 창 없이 자동 준비하고 DKKF HUD는 제외합니다.

[0.6.1 변경 사항](docs/RELEASE-0.6.1.md) · [서버 설치 안내](docs/RELEASE-0.6.0.md) · [공개 다운로드](https://dkkf.온라인.한국)

이전 버전의 설명은 아래에 남아 있으며 현재 동작은 0.6.0 릴리스 문서를 우선합니다.


Independent Windows launcher for Minecraft Java Edition, targeting Minecraft 26.3 Fabric and Java 25+.

[Public download](https://dkkf.온라인.한국) · [한국어](README.ko.md) · [Release details and limits](docs/RELEASE-0.4.0.md) · [Build](BUILD.md) · [Privacy](PRIVACY.md)

Instances contain Overview, Content, Worlds, Modpacks and Settings. Content supports mods, resource packs and shader packs through official Modrinth downloads and local files. Java Edition worlds can be imported from ZIPs or folders.

New instances prepare the compatible Gamma Utils, AppleSkin, EMF/ETF, Sound Physics Remastered, Iris, Distant Horizons and Solas releases plus required dependencies. Existing files are preserved; content updates remain manual. Fresh Moves has no 26.3 release at the time of research and is shown as unsupported. The preset is optional, and imported modpacks retain their configuration by default.

Starting with 0.3.2, signed launcher updates download automatically and apply when the idle launcher closes. Older unconfigured versions require one manual install.

At the user's request, additional tests for 0.4.0 were skipped. TypeScript and production packaging are the build checks; game-level compatibility, shader rendering and world opening remain unverified. The installer has no Windows code signature.

Contact: pluswoori@gmail.com

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.

0.4.1: 인스턴스 메뉴/본문 겹침 및 헤더 스타일 충돌 수정. docs/RELEASE-0.4.1.md 참고.

0.4.2: 업로드 센터 및 게시 기능 제거. docs/RELEASE-0.4.2.md 참고.

0.4.3: Discord Rich Presence (app ID 1572459000841109654). docs/RELEASE-0.4.3.md 참고.

0.4.4: 필수 의존성 복구, 업데이트 설치 창/실패 복구, 검색 페이지 이동 및 설치된 모드 검색. docs/RELEASE-0.4.4.md 참고.

0.5.0: Paper 26.3 전용 서버 연동, F10으로 최대 18개 서버 허용 기능. LiquidBounce 전체 모듈은 포함하지 않습니다. docs/SERVER-BRIDGE.md 참고.
