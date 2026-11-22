# API review submission — text to adapt

This is a project-specific draft, not an official Microsoft application form or a statement of approval. Follow the actual form's current questions and requirements. Do not submit placeholders or unverified claims.

Contact email is confirmed: **pluswoori@gmail.com**.

Status update (November 17, 2026): the project owner reports Microsoft approval received for DKKF Client. The public client ID below is filled from the supplied registration. Actual account authentication is still untested, and Overwolf/CurseForge approval is pending. This document remains a reusable description for platform review or registration updates, not an independently verified approval certificate.

Before submitting, replace:

- `[GITHUB_REPOSITORY_URL]` with the published repository URL.
- In a form that requires your legal name, organization, address or other identity details, supply your own accurate information. Those details have not been invented in this draft.

## Application name

DKKF Client — Neon Edition

## Short description

DKKF Client is an independent Windows launcher for Minecraft Java Edition, with a Minecraft 26.3 Fabric HUD module, isolated instances, official game downloads, and mod management. It uses Microsoft sign-in to verify the user's Minecraft identity and entitlement before launching the local game.

## Detailed description / intended API use

DKKF Client — Neon Edition is an independent Windows desktop launcher using its own registered public Microsoft application, client ID `[앱 내부 설정 — 문서에 표시하지 않음]`. The application is implemented with Electron, React and TypeScript; its optional custom Fabric HUD currently targets Minecraft 26.3.

The project provides separate game instances, official version metadata and file installation, compatible loader profiles, local mod management, and optional integrations with Modrinth and CurseForge. It downloads official Minecraft files to each user's local machine and does not bundle Minecraft game binaries in the launcher distribution.

The authentication implementation uses a public-client Microsoft device authorization flow with XboxLive.signin and offline_access. Users complete their sign-in and any required consent on Microsoft's official browser page. The launcher does not collect Microsoft passwords or MFA credentials. It exchanges tokens through Xbox User Authentication and XSTS, obtains a Minecraft access token, checks the Minecraft Java Edition entitlement response, and retrieves the user's Minecraft profile before saving a signed-in account or allowing game launch.

The launcher does not provide an unauthenticated/offline-account fallback, a fabricated successful login, or a bypass of the entitlement check. Microsoft refresh tokens and Minecraft access tokens are stored locally using Electron safeStorage on Windows. Credential tokens are not exposed to the renderer UI or uploaded to a developer analytics endpoint. The local Java game process receives the Minecraft token needed for its game session. Users can remove an account and its local credential vault through logout.

The authentication code is available for review. The project owner reports Microsoft approval received on November 17, 2026. Successful end-to-end Minecraft authentication with a real entitled account is still untested and is not advertised as completed. Overwolf/CurseForge approval remains pending. The project uses its own registered public application ID rather than another launcher's application ID.

Repository: [GITHUB_REPOSITORY_URL]

Registered application client ID: [앱 내부 설정 — 문서에 표시하지 않음]

Contact: pluswoori@gmail.com

## Why these permissions are requested

XboxLive.signin is used for the Xbox authentication chain required by the implemented Minecraft sign-in flow. offline_access is requested for refresh-token functionality so the user does not need to repeat interactive browser sign-in on every launch. The intended Minecraft Services operations are authentication token exchange, entitlement verification and retrieval of the signed-in user's own Minecraft profile.

No Microsoft Graph mail, files, contacts or directory permissions are requested by the current code. No client secret is embedded in the desktop application.

## Data handling answer

Account profile name, Minecraft UUID, expiration metadata, launcher settings and launch history are stored locally in SQLite. Profile metadata and history are not encrypted by the application. Microsoft refresh tokens and Minecraft access tokens are stored in separate local vault files encrypted with Windows-backed Electron safeStorage. Intermediate Xbox/XSTS tokens are transient. Logout deletes the selected launcher's local profile entry and credential vault, but does not revoke every Microsoft session or delete all historical game logs. The launcher has no automatic developer telemetry or crash-report upload in the current source. User-requested mod/platform operations and optional configured update requests contact the relevant providers, which receive ordinary connection information.

The repository includes a privacy notice describing these details, third-party requests and local removal controls. Game/mod logs may contain personal information and should be reviewed before the user shares them for support.

## URLs to copy after the repository is published

| Field                            | Repository location                                                      |
| -------------------------------- | ------------------------------------------------------------------------ |
| Project / source URL             | The repository's root URL                                                |
| Privacy notice                   | Root `PRIVACY.md` file                                                   |
| Authentication explanation       | `docs/AUTHENTICATION.md`                                                 |
| Build instructions               | Root `BUILD.md` file                                                     |
| Verification / known limitations | Root `TEST-REPORT.md` file                                               |
| Screenshots                      | `docs/screenshots/home-26.3.png` and `docs/screenshots/my-mods-26.3.png` |
| Download                         | The repository's Releases page, after a release is actually created      |

Use each published file's real browser URL if the form asks for an absolute URL. The repository URL and release page do not exist yet in this draft.

## Branding statement

The launcher displays this notice in its common footer:

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.

## Before sending

1. Fill the repository URL and verify the prefilled public application client ID; provide any identity fields required by the real form.
2. Verify that the application registration and the submitted application refer to the same owner/project and client ID.
3. Publish the source and documentation, check their URLs, and attach only the build/screenshots requested by the reviewer.
4. Keep API keys, client secrets, access/refresh tokens, private keys, account databases and downloaded Minecraft game files out of the repository and attachments.
5. Preserve the current pending/untested labels. Update them only after the corresponding real approval or test has occurred.
