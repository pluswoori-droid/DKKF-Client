> **0.3.0 current release:** [변경·검증·로그인 설정](RELEASE-0.3.0.md) · [공개 다운로드](https://dkkf-launcher.gitbal-cream.chatgpt.site). Earlier feature/test descriptions below may describe prior builds; see the release notes for current navigation and verification.

# Authentication and API access — reviewer notes

Project: Dkkf Launcher  
Version reviewed: 0.3.0  
Contact: [pluswoori@gmail.com](mailto:pluswoori@gmail.com)

## Current review status

On November 17, 2026, the project owner reported that Microsoft approval had been received for Dkkf Launcher, application client ID `[앱 내부 설정 — 문서에 표시하지 않음]`. This document records that owner report; it does not independently verify the decision. Real-account sign-in, token refresh and authenticated game launch remain untested. Overwolf/CurseForge approval is reported as pending.

The registered public client ID is now the launcher default. An older blank setting is filled once on upgrade; existing nonempty custom IDs are preserved. Settings still allows changing the public ID. No client secret, developer account token or borrowed launcher ID is shipped. The profile remains signed out until the user completes the actual sign-in and entitlement/profile checks. See [platform status](PLATFORM-STATUS.md) for the distinction between reported approval and tested authentication.

## Purpose and access boundary

DKKF is an independent Windows launcher for Minecraft Java Edition. Its current custom HUD targets Minecraft 26.3 Fabric. Authentication is used to establish the user's Minecraft identity, verify the available Java Edition entitlement response, and obtain a game-session access token for the local official game client. The launcher does not offer an unauthenticated/offline-account fallback or bypass the entitlement check.

This document explains the implementation; it is not evidence that Microsoft has granted service access or that all entitlement types/account configurations are supported.

## Implemented sequence

1. The user explicitly selects Microsoft sign-in in Account.
2. The Electron main process requests a device code at `https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode` with the configured public client ID and `XboxLive.signin offline_access` scope.
3. The UI displays the returned user code and opens the returned verification page in the system browser after an explicit user action. External links are restricted to allowed HTTPS domains.
4. The user enters their password/MFA details only on Microsoft's browser page. The launcher polls Microsoft's token endpoint and handles pending, slow-down and failure responses.
5. The Microsoft access token is exchanged at Xbox User Authentication, then XSTS for `rp://api.minecraftservices.com/`.
6. The XSTS identity is exchanged at Minecraft Services `/authentication/login_with_xbox`.
7. The launcher requests `/entitlements/mcstore` and requires a `game_minecraft` or `product_minecraft` item in the response.
8. The launcher requests `/minecraft/profile` and requires a profile ID and name.
9. Only after these checks does it persist the profile metadata and encrypted credential vault and select the account.
10. Before game launch, it uses an existing Minecraft token if sufficiently unexpired; otherwise it refreshes via the Microsoft refresh-token grant and repeats the Xbox/Minecraft checks. A valid stored account is required for launch.

An authentication or entitlement/profile error is surfaced as a failure. The flow does not create a fabricated successful account. Account types, Game Pass behavior, child accounts, Xbox restrictions, denial/expiry/revocation cases and service approval failures still need end-to-end testing.

## Scopes and credentials

| Item                                   | Purpose / handling                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Public application client ID           | Identifies the project's registered public client; not treated as a client secret                             |
| `XboxLive.signin`                      | Request Xbox authentication needed for the Minecraft sign-in chain                                            |
| `offline_access`                       | Request refresh capability so a user can remain signed in without repeating browser sign-in on every launch   |
| Microsoft refresh token                | Stored locally in a safeStorage-encrypted vault                                                               |
| Minecraft access token                 | Stored in that encrypted vault; used by the main process and passed to the local Java game process for launch |
| Microsoft access, Xbox and XSTS tokens | Used transiently in the main process's authentication chain; not intentionally persisted                      |
| Profile UUID/name/expiry               | Stored as plaintext local SQLite metadata for account display/selection                                       |

The renderer receives the user-facing device code/status and profile metadata, not the credential tokens. The launcher does not collect Microsoft passwords. Logout deletes the selected local credential vault and profile entry; it does not implement global Microsoft token revocation or erase all previous logs.

## Source map

| Concern                                                                         | Source                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Device flow, Xbox/XSTS exchange, entitlement/profile checks, refresh and logout | [`launcher/main/auth.ts`](../launcher/main/auth.ts)           |
| Main-process methods, secret vaults, external-link allowlist, trusted-frame IPC | [`launcher/main/main.ts`](../launcher/main/main.ts)           |
| Restricted renderer bridge                                                      | [`launcher/main/preload.ts`](../launcher/main/preload.ts)     |
| Local profile/settings/history database                                         | [`launcher/main/store.ts`](../launcher/main/store.ts)         |
| Authenticated Java launch                                                       | [`launcher/main/minecraft.ts`](../launcher/main/minecraft.ts) |
| Log redaction, hashes, path/URL/signature checks                                | [`launcher/main/security.ts`](../launcher/main/security.ts)   |
| Account UI and non-affiliation notice                                           | [`launcher/renderer/src.tsx`](../launcher/renderer/src.tsx)   |
| Actual verification and untested features                                       | [`TEST-REPORT.md`](../TEST-REPORT.md)                         |

## Review reproduction

The repository can be built using [BUILD.md](../BUILD.md) without embedding a client secret. In a fresh data directory, the launcher shows no signed-in user. Missing application configuration prevents sign-in. The reviewer can inspect sign-in code without completing a user login.

After an appropriate application ID and access are available, configure that ID and use an account entitled to Minecraft Java Edition. Complete sign-in manually in Microsoft's page. Do not use another application's ID to circumvent an access decision. Do not attach live token files or an account database to an issue or application submission.

## References

- [Microsoft device authorization grant](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)
- [Project privacy notice](../PRIVACY.md)

These references explain relevant mechanisms. They do not establish approval for this project's application ID.
