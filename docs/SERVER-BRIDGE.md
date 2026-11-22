# DKKF Server Bridge — Paper 26.3

이 구현은 DKKF 전용 Paper 플러그인과 Fabric 모드가 기능 목록을 교환하는 서버 연동입니다. **LiquidBounce 전체 모듈의 이식/복제 또는 모든 서버 플러그인과의 무조건 호환을 제공하지 않습니다.** LiquidBounce 코드를 포함하지 않으며 아래 18개 기능을 독립 구현했습니다.

## 설치

1. 런처 0.5.0의 설정 → **Paper 26.3 서버 플러그인 저장**을 누릅니다.
2. `dkkf-bridge-paper-26.3-0.1.0.jar`를 Paper **26.3 / Java 25 이상** 서버의 `plugins` 폴더에 넣고 서버를 완전히 재시작합니다. 이 작업에서 실제 서버 파일을 수정하거나 서버를 실행하지 않았습니다.
3. 26.3 Fabric 인스턴스를 실행합니다. `DKKF 서버 연동 모드 자동 추가`가 켜져 있으면 연동 모드를 최초 추가합니다. Fabric API 0.166.2 이상이 필요하며 낮은 기존 API는 자동 교체하지 않습니다. 기존에 직접 비활성화한 모드도 강제로 켜지 않습니다.
4. 해당 서버에서 **F10**을 누릅니다. 연결된 DKKF 플러그인이 설정 및 권한으로 허용한 기능만 표시되며 클릭해 활성화합니다. OP는 기본 사용 가능하고 일반 플레이어는 권한을 부여해야 합니다.

## 지원 기능

| ID | 기능 | 처리 |
|---|---|---|
| flight | 비행 | 서버의 정식 비행 허용/비행 상태 |
| speed | 이동 속도 | 서버 속도 attribute modifier |
| high_jump | 높은 점프 | 서버 점프 attribute modifier |
| step | 발판 높이 | 서버 step-height attribute modifier |
| reach | 상호작용 거리 | 서버 블록/엔티티 상호작용 거리 |
| fast_break | 빠른 채굴 | 서버 채굴 속도 attribute modifier |
| no_fall | 낙하 피해 방지 | 서버 낙하 피해 이벤트 |
| anti_knockback | 넉백 저항 | 서버 일반/폭발 넉백 저항 |
| water_speed | 수중 이동 | 서버 수중 이동 attribute |
| low_gravity | 낮은 중력 | 서버 중력 attribute |
| night_vision | 야간 시야 | 서버 물약 효과 |
| water_breathing | 수중 호흡 | 서버 물약 효과 |
| no_fire | 화염 피해 방지 | 서버 화염/용암 피해 이벤트 |
| no_hunger | 허기 방지 | 서버 음식 수치/이벤트 |
| regeneration | 재생 | 서버 물약 효과 |
| auto_sprint | 자동 달리기 | 서버 허용 확인 후 클라이언트 달리기 |
| auto_attack | 자동 공격 | 서버 공격 API, 사거리/시야/공격 쿨다운 검사 |
| trigger_bot | 조준 대상 공격 | 서버 시선 추적 및 일반 공격 API |

전투 기능은 기본적으로 적대적 몬스터만 대상으로 합니다. 플레이어 대상은 서버 `combat.target-players: true`, 월드 PvP 허용 및 별도 `dkkfbridge.combat.players` 권한이 모두 필요합니다. 실제 피해는 Paper의 일반 공격/피해 처리와 다른 플러그인의 이벤트를 거칩니다.

## 서버 권한과 설정

- `dkkfbridge.use`: DKKF 기능 사용
- `dkkfbridge.feature.<id>`: 개별 기능 사용
- `dkkfbridge.feature.*`: 전체 지원 기능 사용. 명시적인 개별 거부 권한을 우선합니다.
- `dkkfbridge.admin`: 설정 다시 읽기
- `dkkfbridge.combat.players`: 플레이어 대상 전투 기능

예: LuckPerms 사용 시 서버 콘솔에서 `lp user <닉네임> permission set dkkfbridge.use true`, `lp user <닉네임> permission set dkkfbridge.feature.flight true`로 비행만 부여할 수 있습니다. 모든 지원 기능은 `dkkfbridge.feature.* true`로 부여합니다.

`plugins/DkkfBridge/config.yml`에서 전체 연동 또는 개별 기능을 끌 수 있습니다. `/dkkfbridge`는 상태를, `/dkkfbridge reload`는 권한 확인 후 설정을 다시 읽습니다. 설정 다시 읽기 시 기존 활성 기능을 해제합니다.

## 연결과 해제

`dkkf:control` / `dkkf:state` 플러그인 메시지로 세션 nonce, 서버 토큰, 허용된 기능 ID 및 상태만 교환합니다. 채팅의 플러그인 이름이나 `/plugins` 결과를 보고 활성화하지 않습니다. 서버는 매 요청에서 설정/권한을 다시 검사하고, 패킷 크기와 빈도를 제한합니다.

다른 서버 접속·연결 종료·리스폰·월드 이동·플러그인 해제 시 활성 기능을 비웁니다. 클라이언트의 상태 유효기간은 6초, 서버의 연결 임대는 10초입니다. 통신이 끊기면 기능을 해제하며 다시 연결해도 자동으로 켜지 않습니다. 다른 플러그인의 attribute 수정자를 제거하지 않고 DKKF의 수정자만 제거합니다. 비행/기존 물약 상태는 가능한 범위에서 복원합니다. 이미 회복된 체력·허기는 소급해 되돌리지 않습니다.

## 미구현 및 검증 한계

Freecam, ESP, Scaffold, InventoryMove, NoClip, Blink, FakeLag, Disabler 등 **나열되지 않은 LiquidBounce 모듈은 구현하지 않았습니다.** 다른 안티치트/전투/이동 플러그인이 동작을 제한하거나 변경할 수 있어 무조건 호환을 보장하지 않습니다.

Paper 26.3 API 및 Fabric 26.3 컴파일은 통과했습니다. 사용자의 이전 요청에 따라 추가 테스트와 실제 서버·게임 실행은 생략했습니다. 기능별 게임 내 동작 및 다른 플러그인과의 조합은 미검증입니다. 서버 JAR는 공개 소스 ZIP 대신 런처 설치 파일 안에 포함하며 설정에서 내보냅니다.

참고: [Paper 플러그인 메시징](https://docs.papermc.io/paper/dev/plugin-messaging/), [Paper 26.3 개발 환경](https://docs.papermc.io/paper/dev/project-setup/), [Fabric 네트워킹](https://docs.fabricmc.net/develop/networking).
