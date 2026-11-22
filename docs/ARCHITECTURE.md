# Architecture and remaining work

새 프로젝트로 시작했습니다. 요청에 명시된 `D:/DKKF-Client` 디렉터리는 최초 점검 시 존재하지 않았으며 보존하거나 마이그레이션할 기존 소스는 없었습니다.

## 경계

- `launcher/renderer`: React UI. Node·토큰·파일시스템 접근 없음. 외부 서비스의 텍스트를 HTML로 삽입하지 않음
- `launcher/main`: 인증, 안전한 IPC, SQLite, 공식 메타데이터 설치, 모드, 모드팩, 업데이트
- `shared`: 인스턴스/계정/설정 타입, Zod 스키마, 번들 코어 해시
- `client/common`: 게임 의존성 없는 HUD 모델·프로필·어댑터 인터페이스
- `client/fabric26_3`: 26.3 렌더/키 입력/에디터/게임 데이터 어댑터; `client/fabric`은 과거 1.21.1 소스 보존
- `client/forge`, `client/neoforge`, `client/quilt`: 현재 미구현 범위를 명시한 확장 지점
- `backend`: loopback REST 업데이트 파일 서버 및 서명된 WebSocket 공지
- `scripts`: 빌드·패키징·공식 API 연동 테스트·UI 테스트·업데이트 서명
- `tests`: 합성 파일 기반 보안/저장소/모드팩/업데이트 프로토콜 테스트

SQLite는 main 프로세스에서 단일 소유하며 sql.js를 이용해 네이티브 Electron ABI 재빌드 문제를 피했습니다. 갱신 시 임시 파일에 export 후 rename합니다. 토큰은 DB와 분리된 safeStorage vault에 있습니다.

공식 게임 manifest → 버전 JSON → client JAR → 로더 프로필 → 상속 병합 → 라이브러리·네이티브 → 리소스 인덱스·개별 객체 → 완성 launch-profile.json 순서로 설치합니다. Forge/NeoForge는 공식 installer JAR의 SHA-1을 확인하고 Java로 공식 installClient 기능을 실행합니다. 프로필 종류가 다른 과거 설치물을 잘못 선택하지 않도록 실제 생성한 로더/버전으로 식별합니다.

모드 설치는 필수 의존성 계획을 임시 폴더에 다운로드·검증한 뒤 기존 모드를 백업하고 교체합니다. 커밋 중 실패하면 같은 작업에서 이동한 파일을 되돌립니다. 모드팩 import 실패는 새 인스턴스와 임시 파일을 정리합니다. 이 파일 작업 복구와 **런처 업데이트 설치 후 롤백**은 별개이며 후자는 구현되지 않았습니다.

## 다음 단계 우선순위

1. 운영 Microsoft 앱의 Xbox/Minecraft 승인과 실제 소유 계정으로 로그인·갱신·실행·로그아웃 테스트. 사용자 인증을 개발 테스트로 대체하지 않음
2. CurseForge 발급 키로 검색·다운로드 제한·필수 의존성·실제 모드팩 import/export 테스트
3. Fabric 26.3 게임 내 HUD 검증과 에디터 겹침·해상도 변경 테스트, 프로필 회귀 테스트
4. Forge/NeoForge/Quilt 별도 HUD 어댑터·빌드 및 라이선스/런타임 의존성 분리
5. 별도 업데이트 helper·트랜잭션 설치·직전 바이너리 백업·실패 롤백·재시작 복구·코어 배포
6. Fabric/Quilt semver 범위·provides/breaks/conflicts, Forge TOML 및 Jar-in-Jar 정밀 분석
7. 대형 MRPACK/CF 실팩과 선택 파일·플랫폼 혼합 출처·중복 파일 정책 검증
8. UI 영문/테마, 다운로드 속도 제한/재시도/재개, 저장 위치 변경·Java 자동 검색, 로그 보관 정책
9. Windows 코드서명, 실제 NSIS 설치/제거/업그레이드·경로 공백·일반 사용자 계정 테스트, 공급망 취약점 점검

새 게임 버전의 공식 manifest를 조회할 수 있다는 사실이 해당 버전의 모든 실행 변수·아키텍처·JVM·로더·HUD가 검증됐다는 뜻은 아닙니다. 현재 실행 규칙은 Windows x64 기준입니다.
