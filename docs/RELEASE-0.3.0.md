# Dkkf Launcher 0.3.0

공개 배포: https://dkkf-launcher.gitbal-cream.chatgpt.site

문의: pluswoori@gmail.com

## 이번 변경

- 한국어 주요 화면, Dkkf Launcher 이름 및 제공된 그림 아이콘을 적용했습니다. Neon Edition 문구를 제거했습니다.
- 모드 검색·설치된 모드·모드팩을 인스턴스 편집에 통합했습니다. 새 인스턴스는 직접 만들기 또는 파일 업로드로 시작합니다.
- 생성 후 게임을 자동 설치합니다. 실패한 인스턴스는 오류를 보존하고 다시 설치할 수 있습니다.
- Minecraft 26.3 Fabric 인스턴스에는 제공된 Locator Bar 1.2.0과 최초 실행에 필요한 Fabric API를 설치합니다. 다른 버전/로더에는 추가하지 않습니다. 기존 모드는 자동 교체하지 않습니다.
- RAM과 해상도 제한은 선택 사항입니다. 해제 시 JVM/게임의 기본 동작을 사용합니다.
- 모드 추가 및 수동 업데이트 확인/설치를 제공합니다. 자동 모드 업데이트는 없습니다.
- 업로드 센터는 UUID `b5fbf18bf32d4342822ac2757cc240c6` 계정에만 표시합니다. 실제 업로드 직전 main process에서 Minecraft 프로필을 다시 확인합니다.
- 연결된 실제 계정은 홈 오른쪽 위에 닉네임과 공식 스킨의 얼굴을 표시합니다. 미연결 시 표시하지 않습니다.
- 공식 Fabric 지원 버전 목록을 먼저 확인합니다. 지원되지 않는 1.12.1 요청은 안내 후 중단합니다.

## 검증

자동 테스트 27개 통과. TypeScript 및 프로덕션 패키지 빌드 통과. 실제 패키지에서 한국어 메뉴, 업로드 권한 거부, 26.3 Fabric 자동 설치, Locator Bar와 Fabric API 설치, 인스턴스 편집의 실제 Modrinth 검색과 수동 업데이트 버튼을 확인했습니다. renderer 오류 0개.

테스트 근거: `docs/verification/packaged-ui-0.3.0.json`, `docs/verification/automated-tests-0.3.0.txt`. 스킨 얼굴/닉네임은 합성 프로필과 이미지 단위 테스트로 확인했으며 실제 로그인 증거는 아닙니다.

## Microsoft 로그인 설정 필요

등록 앱 ID: `[앱 내부 설정 — 문서에 표시하지 않음]`.
직접 진단에서 HTTP 401 / AADSTS70002가 반환되었습니다. Azure의 해당 앱 → 인증 → 고급 설정 → **공용 클라이언트 흐름 허용 = 예**로 저장해야 합니다. 필요하면 모바일 및 데스크톱 애플리케이션 플랫폼을 추가하세요. 데스크톱 런처에는 클라이언트 비밀을 넣지 않습니다.

승인 수신은 소유자 보고입니다. 실제 계정 로그인·토큰 갱신·인증된 게임 실행 및 게임 내 HUD 조작은 미검증입니다. Overwolf/CurseForge 승인은 대기 중입니다.

## 배포와 제한

사이트는 공개이며 설치 EXE, 소스 ZIP, SHA-256 파일을 제공합니다. 다운로드는 로그인 없이 가능합니다. Windows 코드서명은 없으며 실제 NSIS 설치·제거·이전 버전 업그레이드는 검증 전입니다. 서명된 자동 업데이트 운영 서비스/롤백 배포와 공개 다운로드 사이트는 별개입니다.

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
