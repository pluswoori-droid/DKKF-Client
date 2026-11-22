# Dkkf Launcher 0.6.2

게임 설치와 실행 전에 필요한 Java 버전을 확인합니다. 설정된 Java가 없거나 너무 낮으면 PC와 런처 전용 런타임 폴더를 검색하고, 호환 버전이 없으면 Eclipse Temurin JRE를 자동으로 설치합니다. 게임 버전의 공식 `javaVersion.majorVersion`을 기준으로 하며 Minecraft 26.3은 Java 25 이상이 필요합니다.

Adoptium 공식 API에서 Windows 아키텍처에 맞는 ZIP과 SHA-256을 조회합니다. 공식 Temurin GitHub 릴리스에서 다운로드하고 해시 및 Java 실행 버전을 검증한 뒤 설정에 경로를 저장합니다. 시스템 PATH·레지스트리·다른 프로그램의 Java 설치는 변경하지 않습니다. 설치 중단·실패 시 임시 파일을 정리하며 다음 설치/실행 요청에서 다시 시도할 수 있습니다.

Android 0.1.1-preview에는 Java 25 ARM64 자동 설치가 이미 있으므로 변경하지 않았습니다.

TypeScript 검사와 Windows 설치 파일 빌드를 완료했습니다. 사용자 요청에 따라 실제 Java 설치·게임·기기 실행 테스트는 생략했습니다. Windows 설치 파일은 기존과 같이 Authenticode 무서명이며 자동 업데이트 매니페스트의 서명은 별도로 유지합니다.
