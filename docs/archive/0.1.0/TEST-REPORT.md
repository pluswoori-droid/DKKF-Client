# DKKF Client 0.1.0 — Test report

검증일: **2026-11-16, Asia/Seoul**. Windows 11 x64, Node 24.22.1, Java 21.0.10, Gradle 8.8. 실제 계정/API 키가 필요한 기능을 합성 테스트 통과만으로 완료 처리하지 않았습니다.

## 최종 결과

| 검증                                       | 결과            | 근거 / 범위                                                                                  |
| ------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------- |
| TypeScript strict typecheck                | TESTED          | `tsc --noEmit` 통과                                                                          |
| Vite renderer + Electron main/preload 번들 | TESTED          | production build 통과                                                                        |
| Windows x64 NSIS 패키징                    | TESTED          | 설치 EXE·blockmap·win-unpacked 생성                                                          |
| 패키징된 EXE 시작                          | TESTED          | 실제 `release/win-unpacked/DKKF Client.exe`를 Playwright Electron으로 실행                   |
| 9개 페이지 이동                            | TESTED          | Home, Instances, Mod Hub, My Mods, Modpacks, Upload Center, Update Center, Settings, Account |
| 공식 API를 사용한 UI 인스턴스 생성         | TESTED          | 실제 Mojang 버전 조회 후 Minecraft 1.21.1 인스턴스 생성                                      |
| UI Mod Hub                                 | TESTED          | 실제 Modrinth 검색 결과 표시, renderer 오류 0                                                |
| Windows safeStorage                        | TESTED          | 실제 Windows 암호화 가용성·암호화/복호화 왕복, 암호문에 원문 없음                            |
| UI DKKF HUD 설치                           | TESTED          | 번들 JAR 고정 해시 검사, 실제 Fabric API 다운로드 후 모드 목록에 코어/API 표시               |
| 단위·로컬 통합 자동 테스트                 | TESTED          | 12개 통과 / 실패 0                                                                           |
| Production 의존성 audit                    | TESTED          | npm 권고 DB에 보고된 취약점 0; 보안 무결성 보증은 아님                                       |
| pnpm peer dependency 검사                  | TESTED          | 불일치 0                                                                                     |
| Fabric HUD JAR 컴파일                      | TESTED          | Loom 1.7.4 / Minecraft 1.21.1 / Java 21 / Gradle 8.8 `BUILD SUCCESSFUL`                      |
| 실제 NSIS 설치·제거·업그레이드             | PARTIAL         | 파일 생성과 unpacked EXE 실행 확인; 사용자 환경에 설치 프로그램을 설치/제거하지 않음         |
| Windows Authenticode 코드서명              | NOT IMPLEMENTED | 인증서 없음; 이 빌드는 서명되지 않음                                                         |

## 실제 인터넷 연동

합성 응답을 쓰지 않고 공식 서비스에 요청했습니다. [전체 설치 결과](docs/verification/live-install.json), [최종 API/다운로드 재검증](docs/verification/live-api.json).

| 항목                                    | 결과    | 실제 확인                                                                      |
| --------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| Minecraft 공식 manifest                 | TESTED  | 923개 버전; 당시 latest release 26.3, snapshot 26.4-snapshot-8                 |
| Fabric 호환 로더 목록                   | TESTED  | 1.21.1의 공식 Meta API                                                         |
| Quilt 호환 로더 목록                    | TESTED  | 1.21.1의 공식 Meta API                                                         |
| Forge 호환 로더 목록                    | TESTED  | 공식 Maven metadata                                                            |
| NeoForge 호환 로더 목록                 | TESTED  | 공식 Maven metadata                                                            |
| Vanilla 1.21.1 설치                     | TESTED  | 클라이언트 JAR·라이브러리·네이티브·3,913개 리소스 객체·해시 및 launch profile  |
| Fabric 1.21.1 설치                      | TESTED  | fabric-loader-0.20.1-1.21.1 / KnotClient                                       |
| Quilt 1.21.1 설치                       | TESTED  | quilt-loader-0.20.0-beta.9-1.21.1 / KnotClient                                 |
| Forge 1.21.1 설치                       | TESTED  | 공식 installer → 1.21.1-forge-52.1.21 / ForgeBootstrap                         |
| NeoForge 1.21.1 설치                    | TESTED  | 공식 installer → neoforge-21.1.266 / BootstrapLauncher                         |
| Modrinth 검색·상세                      | TESTED  | Sodium의 실제 호환 버전 조회                                                   |
| Modrinth 모드 설치                      | TESTED  | Sodium 0.8.13 Fabric 1.21.1 실제 다운로드·공식 SHA-512 및 로컬 SHA-256         |
| Fabric API 설치                         | TESTED  | 최종 패키징 UI에서 0.116.18+1.21.1 다운로드·해시·목록 확인                     |
| CurseForge 검색·설치                    | BLOCKED | 발급된 API 키 없음. 정상 응답·권한 제한·실제 파일 연동은 미검증                |
| Microsoft 로그인 / Xbox / 권한 / 프로필 | BLOCKED | 본인 등록 앱 ID 및 Minecraft 서비스 승인, 사용자 소유 계정 없음                |
| 토큰 갱신·다중 실제 계정·로그아웃       | BLOCKED | 실제 인증 토큰 없이 성공으로 표시하지 않음                                     |
| Minecraft 게임 창 실행                  | BLOCKED | 소유 계정 인증 필요. 설치 검증을 게임 실행 성공으로 간주하지 않음              |
| 실제 Modrinth 게시                      | BLOCKED | 소유 프로젝트와 버전 게시 권한 토큰 없음. 어떤 공개 프로젝트에도 게시하지 않음 |
| 실제 운영 업데이트 다운로드·설치        | BLOCKED | 운영 HTTPS 도메인·신뢰키·다음 버전 매니페스트 없음                             |

게임/로더 설치 테스트는 **동일한 격리 테스트 디렉터리에 로더를 순차 설치**하며 공통 파일을 재검증했습니다. 각 결과의 launch-profile mainClass와 로더 ID를 확인했습니다. 각 로더로 별도의 실제 게임 창을 띄워 검증하지는 않았습니다. 이 결과를 모든 Minecraft 버전의 호환성으로 확대 해석하지 마세요.

## 합성 파일 / 로컬 서비스 테스트 12개

1. ZIP·파일 경로: 상위 경로, 절대 경로, Windows 예약 장치명·NTFS 스트림·잘못된 경로 차단
2. HTTPS와 호스트 경계: HTTP, 유사 도메인, 인증정보 포함 URL, 임의 포트 거부
3. 파일 해시: 올바른 SHA-256 수용, 변조 바이트·미지원 알고리즘 거부
4. Ed25519: 정상 서명 수용, payload 변조·위조 서명 거부
5. ZIP: 대소문자 중복 경로·압축 해제 크기 제한
6. Mojang OS/feature 규칙: ordered allow/disallow, demo/custom resolution 조건
7. Maven classifier 경로와 로더 프로필 상속: 하위 라이브러리 우선, JVM/game 인수 병합
8. 로그의 Bearer/access/refresh token 마스킹
9. SQLite 재시작 보존, 합성 JAR import·disable·enable·delete, 누락 의존성·중복 검사, 백업/복원
10. 합성 MRPACK의 override import/export, 출처 불명 로컬 JAR 공유 차단, 부적절한 override 파일 거부·실패 정리
11. 서명된 합성 업데이트: 새 버전 수용, 변조·채널 불일치·downgrade·HTTP 거부; 설치 전 조건 검사
12. **실제 로컬** REST/WebSocket 프로세스: health/manifest 응답, 무인증 POST 거부, fixture Ed25519 키로 서명한 공지 수신·검증

12번 테스트는 loopback HTTP/WS 내부 연결입니다. 운영 외부 HTTPS/WSS 배포를 검증한 것은 아닙니다. 합성 키·모드·매니페스트·공지에는 fixture임을 명시했으며 실제 서비스 응답이나 사용자 로그인 성공으로 표시하지 않습니다.

샌드박스가 localhost TCP 연결을 EACCES로 차단하여, 동일 테스트를 localhost 연결이 가능한 실행 환경에서 다시 실행했습니다. 12개 모두 통과했습니다. npm 레지스트리·공식 게임 서버에 접근하는 빌드/연동 테스트 역시 네트워크가 허용되는 실행 환경에서 수행했습니다.

## 업데이트와 복구의 정확한 상태

- SHA-256 및 Ed25519 검증: TESTED (합성/암호학 테스트)
- 채널·버전 검사: TESTED (합성 매니페스트)
- 다운로드/취소/staging 코드: IMPLEMENTED; 실제 운영 업데이트에 대한 통합 테스트 미수행
- 서명된 서버 공지: TESTED (로컬 서비스); 외부 WSS/재연결은 미검증
- 모드 파일 교체 실패 복구: IMPLEMENTED; 백업/복원은 TESTED
- 업데이트 설치 후 자동 롤백 / 이전 런처 바이너리 백업 / 무인 업데이트 설치: **NOT IMPLEMENTED**

업데이트 체크 실패 시 현재 설치를 유지하는 동작을, 설치 후 자동 롤백이 구현된 것으로 표현하지 않습니다.

## 알려진 미완료 사항

Fabric HUD는 **컴파일과 런처 내 설치만 검증**했습니다. F8/F9, 렌더 위치·입력·프레임별 CPS, 프로필 저장과 게임 내 충돌은 실제 계정으로 실행하여 검증해야 합니다. Forge/NeoForge/Quilt 전용 HUD JAR는 아직 없습니다. CurseForge 실제 모드팩, 모드 버전 범위 충돌, 신규 프로젝트 API 생성, 전체 설정 옵션, 다른 게임 버전과 아키텍처, Windows 설치/제거 및 업데이트 복구도 남아 있습니다.

자세한 범위는 [README](README.md)와 [아키텍처/후속 작업](docs/ARCHITECTURE.md)에 기록했습니다.

## 증빙

- [패키징 UI 결과](docs/verification/packaged-ui.json)
- [자동 테스트 출력](docs/verification/automated-tests.txt)
- [Production 의존성 audit](docs/verification/dependency-audit.json)
- [Home 화면](docs/screenshots/home.png)
- [Mod Hub 화면](docs/screenshots/mod-hub.png)
- [HUD 설치 후 My Mods](docs/screenshots/my-mods.png)
