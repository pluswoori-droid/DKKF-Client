# Dkkf Launcher 0.4.0 — 인스턴스 라이브러리와 기본 구성

다운로드: https://dkkf.온라인.한국

## 인스턴스 화면

Modrinth 앱의 인스턴스/콘텐츠 관리 구조를 참고했습니다. 인스턴스 편집은 별도 작업 화면으로 열리며 개요·콘텐츠·월드·모드팩·설정 메뉴와 플레이·폴더 열기를 제공합니다. 콘텐츠에서는 모드·리소스팩·쉐이더팩별로 설치한 파일을 관리하고, 콘텐츠 추가에서 공식 Modrinth 검색 및 호환 버전 설치를 진행합니다. 모드에는 기존 CurseForge 검색도 유지합니다.

## 기본 구성 자동 설치

새 인스턴스 생성 후 또는 기존 인스턴스의 첫 실행 전에 기본 구성을 한 번 준비합니다. 기본 선택은 켜짐이며 생성 화면과 인스턴스 설정에서 끌 수 있습니다. 끄거나 파일을 직접 제거해도 이를 자동 업데이트/강제 복원하지 않습니다. 가져온 모드팩은 기본적으로 원래 구성을 유지합니다.

공식 Modrinth 메타데이터에서 해당 게임 버전/로더를 지원하는 배포본만 선택합니다.

- Gamma Utils, AppleSkin, Entity Model Features, Entity Texture Features, Sound Physics Remastered, Iris, Distant Horizons
- Solas Shader 및 Fresh Moves 리소스팩
- Modrinth에서 필수로 선언한 Fabric API, Sodium, Cloth Config 등의 의존성
- 기존 Locator Bar 1.2.0 자동 추가는 26.3 Fabric에서 유지

조사 시 26.3 Fabric 배포본은 위 모드들과 Solas에서 확인했습니다. **Fresh Moves 원본 프로젝트 `slufHzC2`는 26.3 지원 배포본이 없어 설치하지 않으며 지원 대기로 표시합니다.** 다른 프로젝트나 구버전 파일로 임의 대체하지 않습니다. 사용자의 기존 모드와 의존성 버전이 충돌하면 자동 교체하지 않고 실패 사유를 남깁니다.

개요에 설치 완료/기존 유지/비활성/지원 대기/오류 결과를 표시하며 기본 구성 설치·재시도로 다시 확인할 수 있습니다. 기본 설치를 마친 뒤 새 버전이 생겨도 모드/팩을 자동 업데이트하지 않습니다. Solas 최초 선택 시 기존 Iris의 쉐이더 선택은 보존합니다.

## 리소스팩·쉐이더팩·월드

- 리소스팩·쉐이더팩: 공식 Modrinth 검색/버전 선택/원본 해시 확인/설치, 로컬 ZIP 가져오기, 활성화, 수동 업데이트 확인, 폴더 열기, 제거를 제공합니다.
- 리소스팩은 options.txt의 선택 목록에, 쉐이더팩은 Iris 설정에 적용합니다. 활성화에는 Iris가 필요합니다. 기존 게임 옵션은 보존합니다.
- 월드: Java Edition ZIP 또는 폴더를 가져옵니다. 압축된 NBT level.dat, 경로·파일 크기·중복·링크를 검사합니다. 같은 이름의 기존 월드는 덮어쓰지 않습니다. 플레이는 게임의 싱글플레이에서 합니다. 월드의 Minecraft 버전은 사용자가 확인해야 합니다.
- 제거한 콘텐츠는 인스턴스의 content-backups에 보관합니다. 월드 제거에는 확인 창을 표시합니다.
- 공식 프로젝트 파일은 각 사용자의 인스턴스에 직접 다운로드합니다. 제삼자 모드·Solas·Fresh Moves 파일은 런처 설치 파일이나 공개 소스 ZIP에 재배포하지 않습니다.

## 검증 상태

사용자 요청으로 **0.4.0의 추가 자동 테스트, 패키지 UI 테스트 및 실제 게임 테스트는 생략**했습니다. TypeScript 및 배포 빌드만 수행합니다. 0.3.x의 이전 테스트 결과를 이번 변경의 검증으로 주장하지 않습니다. 새 기본 구성의 게임 내 조합 호환성, 쉐이더 렌더링, 실제 월드 열기는 미검증입니다.

0.3.2 이상은 서명된 런처 자동 업데이트로 이 버전을 받을 수 있습니다. 이전의 실제 계정 인증/Windows 코드서명/설치 후 롤백에 관한 제한은 유지합니다.

공식 참고: [Modrinth 앱](https://modrinth.com/app), [Fresh Moves](https://modrinth.com/resourcepack/tras-fresh-player), [Solas Shader](https://modrinth.com/shader/solas-shader).

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
