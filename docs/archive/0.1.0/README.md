# DKKF Client — Neon Edition

Windows용 Minecraft Java Edition 런처 **0.1.0 개발 빌드**입니다. UI 시안이 아니라 실제 공식 메타데이터·다운로드·SQLite·Electron IPC를 연결한 실행 가능한 소프트웨어입니다. 원래 요청 전체를 상용 완성 상태로 주장하지 않습니다. 실제 계정 로그인과 게임 실행은 외부 앱 등록 및 계정 없이는 검증할 수 없으며, 로더별 HUD 확장·완전 자동 업데이트/롤백 등 남은 작업은 아래와 `TEST-REPORT.md`에 명시합니다.

## 실행

- 설치 파일: `release/DKKF-Client-0.1.0-Setup.exe`
- 설치 없이 실행: `release/win-unpacked/DKKF Client.exe` (같은 폴더의 모든 파일 필요)
- Fabric HUD: `assets/client-core/dkkf-core-fabric-1.21.1-0.1.0.jar`

1. 런처를 실행하고 Settings에서 게임 버전에 맞는 Java 실행 파일을 지정합니다. Minecraft 1.21.1은 Java 21을 사용하세요.
2. Instances에서 공식 버전·로더·로더 버전·RAM을 선택해 인스턴스를 생성합니다.
3. 설치 버튼으로 게임 파일·라이브러리·네이티브·리소스를 다운로드합니다.
4. Microsoft 앱 등록/승인을 완료한 **자신의** Client ID를 Settings에 설정합니다. `BUILD.md`의 인증 절차를 참고하세요.
5. Account에서 로그인 코드를 받아 공식 Microsoft 페이지에서 인증합니다. Xbox 인증, Java Edition 권한, Minecraft 프로필을 모두 확인한 뒤에만 계정이 추가됩니다.
6. Mod Hub에서 선택한 인스턴스와 호환되는 모드를 검색·설치합니다. CurseForge는 본인의 API 키가 필요합니다.
7. Home 또는 Instances에서 실행합니다. 인증을 우회하는 오프라인 실행은 제공하지 않습니다.

Minecraft 파일·계정·API 키는 설치 프로그램에 포함하지 않습니다. 개발 테스트 다운로드는 `.data/live-check`에만 있으며 배포 파일에서 제외됩니다.

## 현재 기능

| 영역                                             | 상태            | 범위와 제한                                                                                          |
| ------------------------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------- |
| 9개 화면 / Neon UI                               | TESTED          | 패키징된 Windows 앱에서 이동·로딩·검색·인스턴스 생성 확인                                            |
| 인스턴스                                         | IMPLEMENTED     | 생성·선택·편집·복제·삭제·인스턴스별 RAM 및 디렉터리                                                  |
| 공식 다중 버전 메타데이터                        | TESTED          | 실제 Release/Snapshot/과거 버전 목록; 설치는 1.21.1로 검증                                           |
| Vanilla / Fabric / Quilt / Forge / NeoForge 설치 | TESTED          | 다섯 로더의 실제 1.21.1 파일 설치; 다른 게임 버전은 미검증                                           |
| Microsoft OAuth → Xbox → Minecraft               | BLOCKED         | 코드 구현; 본인 앱 등록/게임 API 승인·실제 계정으로 연동 검증 필요                                   |
| 게임 실행·로그·갱신                              | PARTIAL         | 인증된 계정만 허용; 실제 소유 계정이 없어 게임 창 실행 미검증                                        |
| Modrinth                                         | TESTED          | 실제 검색·상세·호환 버전·Sodium 다운로드/해시·설치                                                   |
| CurseForge                                       | BLOCKED         | 공식 API 코드 구현; API 키 필요; 제한된 다운로드를 우회하지 않음                                     |
| 로컬 모드                                        | TESTED          | JAR 메타데이터, 활성/비활성, 삭제, 해시·ID 중복, 누락 의존성, 백업·복원                              |
| 정밀 모드 호환성 분석                            | PARTIAL         | Fabric/Quilt 필수 ID 누락만 검사; 버전 범위·완전 충돌 분석 미구현                                    |
| 모드 업데이트                                    | IMPLEMENTED     | 출처가 저장된 플랫폼 모드의 호환 최신 버전 확인 및 교체·복원                                         |
| 모드팩                                           | PARTIAL         | MRPACK/CF 매니페스트 참조 입출력, 인스턴스 관리 재사용; 전체 생태계 실팩 호환성 미검증               |
| 게시                                             | PARTIAL         | Modrinth 기존 프로젝트 버전 업로드·권한 확인; 실제 게시 미검증; 신규 프로젝트는 공식 사이트          |
| CurseForge 게시                                  | NOT IMPLEMENTED | 현재 사용하는 Studios REST API에 게시 엔드포인트 없음                                                |
| 업데이트                                         | PARTIAL         | Ed25519·SHA-256·채널 검사, 다운로드/취소, 별도 설치 프로그램 실행, 서명된 WSS 공지                   |
| 무인 설치 / 업데이트 후 자동 롤백                | NOT IMPLEMENTED | 현재 버전을 건드리지 않고 다운로드; 설치는 사용자 버튼으로 시작                                      |
| Client Core / HUD / Optional Mods 자동 배포      | NOT IMPLEMENTED | 모드 업데이트는 별도 수동 작업                                                                       |
| Fabric HUD 코어                                  | PARTIAL         | 1.21.1 JAR 컴파일 성공; 게임 내 렌더·조작 검증 필요                                                  |
| Forge / NeoForge / Quilt 전용 HUD JAR            | NOT IMPLEMENTED | 별도 모듈 디렉터리·공통 인터페이스만 준비; JAR 없음                                                  |
| 설정                                             | PARTIAL         | Java, RAM, 해상도, 전체 화면, 인증, 업데이트, 비밀키; 언어·테마 전환/속도 제한/저장 경로 변경 미구현 |
| Windows 설치 프로그램                            | IMPLEMENTED     | NSIS 빌드 성공; 실제 설치/제거·OS 코드서명 미검증                                                    |

`TESTED`는 표에 적힌 범위의 검증을 뜻하며 전체 버전/계정/서비스 조합의 보증이 아닙니다.

## HUD 사용

My Mods의 **DKKF HUD 설치**는 Minecraft 1.21.1 Fabric 인스턴스에서만 사용할 수 있습니다. 번들 JAR의 고정 SHA-256을 확인하고 공식 Modrinth에서 호환 Fabric API를 설치합니다.

- F8: HUD 편집. 모듈을 끌어 위치 변경, 휠로 크기 변경, Toggle/Color/Opacity 버튼 사용
- F9: default → pvp → minimal 프로필 전환
- FPS, 클릭 수, Ping, 좌표, 방향, 키 입력, 방어구 내구도, 효과, 시계, JVM 메모리 표시
- 설정 파일: 인스턴스의 `config/dkkf/profiles/*.properties`

현재 CPS는 프레임별 마우스 상태 전환으로 측정합니다. 매우 짧은 프레임 사이 입력은 놓칠 수 있습니다. 방어구·효과는 텍스트 표시입니다. 게임 API 어댑터는 1.21.1만 구현되어 있습니다.

## 데이터와 보안

기본 데이터 경로는 `%APPDATA%/dkkf-client/data`입니다. 실제 경로는 Settings의 데이터 폴더 열기로 확인하세요. SQLite 설정·인스턴스·실행 기록과 인스턴스별 mods, assets, libraries, logs를 저장합니다. 개발/테스트 격리에는 `DKKF_DATA_DIR` 환경 변수를 사용합니다.

Microsoft 토큰·플랫폼 키는 Electron safeStorage의 Windows 암호화 저장소로 암호화합니다. 토큰은 renderer에 전달하지 않습니다. 계정 로그아웃은 로컬 토큰을 삭제하며 Microsoft 전역 세션 철회를 뜻하지 않습니다. 전역 접근 철회는 Microsoft 계정 보안 페이지에서 수행하세요.

Renderer는 contextIsolation/sandbox 활성화, nodeIntegration 비활성화, CSP, 발신 프레임·메서드 allowlist·Zod 검증을 사용합니다. 다운로드는 HTTPS 및 출처 allowlist를 적용하고 제공되는 공식 해시를 검사합니다. Fabric/Quilt 메타데이터가 개별 라이브러리 해시를 제공하지 않는 경우 공식 HTTPS Maven 경로를 사용합니다. ZIP 경로·예약 파일명·압축 크기·링크·중복 경로를 검사합니다. JAR 정적 검사나 해시는 악성 코드 부재를 증명하지 않습니다.

게임 실행 중 설치·모드 변경·복원·업데이트 설치를 차단합니다. 외부 모드의 JAR을 재배포 권한 없이 모드팩으로 묶지 않으며, 출처가 확인되는 플랫폼 참조만 내보냅니다. 로컬 모드 백업 ZIP은 개인 복원용입니다.

자세한 빌드·인증 설정은 `BUILD.md`, 서버 배포는 `DEPLOYMENT.md`, 검증 결과는 `TEST-REPORT.md`, 아키텍처와 다음 단계는 `docs/ARCHITECTURE.md`를 참고하세요.
