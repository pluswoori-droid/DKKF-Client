> **0.4.0: 사용자 요청으로 추가 테스트를 생략했습니다.** 이번 변경은 빌드만 수행합니다. 아래 0.3.x 결과는 이전 버전의 기록입니다. [0.4.0 변경 및 제한](docs/RELEASE-0.4.0.md).

# Dkkf Launcher 0.3.0 검증

2026-11-17. [변경 및 제한](docs/RELEASE-0.3.0.md).

- 자동 회귀 테스트: 27개 통과, 실패 0. 보안·저장소·OAuth 오류·Fabric 지원 버전·스킨 합성·계정 표시·선택 RAM/해상도·업로드 UUID·번들 모드를 포함합니다.
- TypeScript/Vite/Electron 프로덕션 패키지 및 HUD Gradle 빌드 성공.
- 실제 패키지: 한국어 메뉴, 미인증 업로드 거부, 26.3 Fabric 생성 후 자동 설치, Locator Bar 1.2.0과 Fabric API 설치 확인.
- 실제 Modrinth 검색, 인스턴스 편집의 로컬 모드 관리와 수동 업데이트 버튼 확인. renderer 오류 0.
- 실제 계정 OAuth/인증 게임/게임 내 HUD, NSIS 설치·제거·업그레이드는 미검증. 스킨 표시 테스트는 합성 fixture이며 실제 로그인 증거가 아닙니다.

[패키지 검증](docs/verification/packaged-ui-0.3.0.json), [27개 테스트 출력](docs/verification/automated-tests-0.3.0.txt). 이전 26.3 게임 파일/Java 검증 자료는 docs/verification에 보존합니다.

## 0.3.1 UI 수정 검증

27개 회귀 테스트 통과, 프로덕션 빌드 통과. 합성 renderer fixture로 계정 탭 얼굴 이미지 2개 로드, 설치된 모드 opacity 0.48, 비활성 배지, 설치 직후 갱신, 동일 버전 중복 설치 비활성화를 확인했습니다. 실제 계정 인증을 수행한 결과가 아닙니다. [검증 결과](docs/verification/packaged-ui-0.3.1.json), [변경 내역](docs/RELEASE-0.3.1.md).

## 0.3.2 자동 업데이트

29개 테스트 통과. 서명/해시/크기 검증, 캐시 재사용, 신뢰키 변경·변조 차단, 설정 이전과 끄기 보존, 종료 시 무인 설치 인수 전달을 확인했습니다. 실제 NSIS 업그레이드는 실행하지 않았습니다. [변경·운영·제한](docs/RELEASE-0.3.2.md).
