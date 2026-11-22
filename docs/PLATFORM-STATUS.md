> **0.3.0 current release:** [변경·검증·로그인 설정](RELEASE-0.3.0.md) · [공개 다운로드](https://dkkf-launcher.gitbal-cream.chatgpt.site). Earlier feature/test descriptions below may describe prior builds; see the release notes for current navigation and verification.

# Platform access status

Updated: November 17, 2026 (Asia/Seoul)

| Platform              | Reported access status                                        | Verification performed in this project                                                                                                                 |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Microsoft / Minecraft | Project owner reported approval received on November 17, 2026 | Registered public client ID is configured. No real-account OAuth, Xbox/XSTS, entitlement, refresh or authenticated game-launch test has been completed |
| Overwolf / CurseForge | Project owner reported approval is still pending              | No issued API key has been supplied; actual authenticated CurseForge integration remains untested                                                      |
| Modrinth              | Public API integration is available                           | Search and compatible mod/Fabric API downloads were tested; actual project publishing has not been tested                                              |

## Registered Microsoft application

- Display name: **Dkkf Launcher**
- Application (client) ID: **[앱 내부 설정 — 문서에 표시하지 않음]**
- Runtime configuration: [`shared/microsoft-app.json`](../shared/microsoft-app.json)
- Public-client authentication: personal Microsoft accounts using the existing `consumers` device-code endpoint

The client ID identifies a public desktop application; it is not a client secret. The directory/tenant ID and object ID shown in the registration portal are not substituted for the client ID in the OAuth flow. They are not needed by the current personal-account sign-in implementation.

The approval status above records information supplied by the project owner. It is not an independently retrieved Microsoft/Overwolf review decision or evidence that a particular account can already sign in. Registration, service access, device-flow settings, successful account authentication and authenticated game launch are distinct checkpoints.

## Release behavior

Launcher 0.3.0 uses the registered client ID by default. On first upgrade, an older empty client-ID setting is filled once. An existing nonempty custom client ID is preserved. If the user intentionally clears the field after that migration, subsequent restarts do not automatically refill it. Migration never creates an authenticated account or token.

An actual user must select Microsoft sign-in and complete the official browser authentication/consent flow. The launcher still requires successful Xbox/Minecraft responses, entitlement and profile checks before adding an account or launching a game. No device code or sign-in session is created just to test the registration setting.

Overwolf pending status is displayed in the CurseForge tab. No placeholder key is supplied and download restrictions are not bypassed. Existing configured keys are not removed by this update.

The launcher release is **0.3.0**; the unchanged Minecraft 26.3 Fabric HUD artifact remains **0.2.0**. Public API access does not imply product endorsement, so the common launcher footer remains:

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
