# DKKF Client — Neon Edition

An independent Windows launcher for **Minecraft Java Edition**, with a custom **Minecraft 26.3 Fabric HUD** and local instance/mod management.

**NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.**

Project contact: **[pluswoori@gmail.com](mailto:pluswoori@gmail.com)**

## Development and review status

Current version: **0.2.0 development build**. The primary custom-core target is Minecraft **26.3**, Fabric Loader **0.20.1**, Fabric API **0.166.2+26.3**, and **Java 25 or newer**.

The Microsoft/Xbox/Minecraft authentication flow is implemented in source, but **application approval and successful end-to-end authentication with a real entitled account are pending**. The development build starts with an empty Microsoft client ID. It does not show a fabricated signed-in account or provide an unauthenticated/offline-account fallback.

Game installation, launcher UI behavior, local credential encryption availability and HUD installation have been checked. In-game HUD rendering/input and authenticated game launch still require real-account testing. This project does not claim Microsoft approval, full production readiness or completion of every planned feature.

## Project purpose

DKKF gives Minecraft Java Edition users separate game environments, official game-file installation, compatible loader profiles and local mod management in a dark cyan/purple desktop interface. The optional Fabric core provides configurable FPS, CPS, ping, coordinates, direction, keystrokes, armor, potion, clock and JVM-memory HUD widgets, plus an editor and local profiles.

Microsoft authentication is used to establish the user's Minecraft identity, verify the available Java Edition entitlement response, and obtain a token for launching the user's local game session. It is not used to request email, files, contacts or other Microsoft Graph data.

## Features and verification boundaries

| Area                                                                                            | Current state                                                                                                                      |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Home, Instances, Mod Hub, My Mods, Modpacks, Upload Center, Update Center, Settings and Account | Tested in the packaged Windows launcher                                                                                            |
| Instance creation, selection, editing, duplication, deletion and per-instance memory            | Implemented; instance creation verified through the UI                                                                             |
| Official Minecraft metadata and game installation                                               | Minecraft 26.3 Fabric installation verified against official servers; earlier 1.21.1 loader tests retained separately              |
| Microsoft device flow, Xbox/XSTS exchange, entitlement/profile checks, refresh and logout       | Implemented; service approval and real-account end-to-end validation pending                                                       |
| Modrinth search, compatible versions and dependency/file installation                           | Actual API/download checks passed                                                                                                  |
| CurseForge integration                                                                          | Implemented API paths; a valid issued API key is needed for real integration testing                                               |
| Local JAR enable/disable, removal, basic dependency/duplicate warnings, backup and restore      | Automated fixture checks passed; complete version-range/conflict analysis is not implemented                                       |
| MRPACK / CurseForge ZIP import and reference-based export                                       | Partial; MRPACK fixtures tested; broad real-world pack compatibility is not established                                            |
| Existing-project Modrinth version publishing                                                    | Implemented permission checks/upload path; real publishing not tested                                                              |
| Signed launcher-update metadata, staging and announcements                                      | Partial; crypto/protocol and local server tests passed; production update installation is not validated                            |
| Unattended update installation / post-install automatic rollback                                | Not implemented                                                                                                                    |
| Minecraft 26.3 Fabric HUD                                                                       | JAR compilation, metadata/hash checks and launcher installation tested; actual in-game rendering and editor input not yet verified |
| Forge / NeoForge / native Quilt custom HUD modules                                              | Not implemented                                                                                                                    |

The exact test scope and remaining work are in [TEST-REPORT.md](TEST-REPORT.md). Downloaded Minecraft game files, test account databases and credentials are excluded from the source archive and distribution.

## Authentication and account handling

1. A user starts sign-in in the Account page.
2. The launcher requests a Microsoft device code using a configured public client ID and `XboxLive.signin offline_access`.
3. The user completes sign-in and any required consent in Microsoft's official system-browser page. DKKF does not collect the Microsoft password or MFA credentials.
4. The main process exchanges tokens through Xbox User Authentication, XSTS and Minecraft Services.
5. It requires a Java Edition entitlement response and a Minecraft profile before saving/selecting an account. Failure is surfaced as an error.
6. Stored Minecraft credentials are used or refreshed before game launch. No unauthenticated launch option is provided.

Microsoft refresh tokens and Minecraft access tokens are stored in separate local vaults using Windows-backed Electron safeStorage. Profile names/UUIDs, token expiration metadata, settings and launch history are local SQLite records and are **not encrypted by the application**. Credential tokens are not returned to the renderer UI. The local Java game process receives the Minecraft access token required for its session.

Logout removes the selected local account entry and vault; it does not implement global Microsoft session revocation or erase all old game/mod logs. External mods run with the game's privileges and are not sandboxed by DKKF. See [PRIVACY.md](PRIVACY.md) and the [authentication source map](docs/AUTHENTICATION.md) for details.

The source currently exposes public-client-ID configuration in Settings. The project must register/control its own application ID and establish the necessary service access for a public release. It does not ship another launcher's ID or an embedded client secret.

## Data and network use

Default local data is under `%APPDATA%/dkkf-client/data`; Settings can open the actual directory. Instances contain their own game files, mods, worlds, configurations and logs. Tests use isolated data directories.

The launcher contacts official Microsoft/Xbox/Minecraft services, official loader repositories and the user's selected mod platform for the requested operation. Modrinth publishing sends a user-selected file and version information only when the user starts that action. Configured update servers can receive normal connection/request information. The initial update-server URL and key are empty.

The current source has no developer analytics SDK, advertising SDK or automatic crash/log upload. Minecraft, mods, external providers and hosting services can have their own network/privacy behavior. Local logs may contain personal information despite attempted token redaction, so inspect them before sharing. Retention and removal details are in the [privacy notice](PRIVACY.md).

## Getting started

1. Obtain the development build from this repository's **Releases** page once a release has actually been published. The installer filename is `DKKF-Client-0.2.0-Setup.exe`. This repository draft does not create a release URL automatically.
2. Install Java **25+**. A fresh launcher configuration searches known local Java installations. Existing users can select Settings → Java auto-discovery and save the result.
3. Create an instance; the defaults are **26.3 / Fabric**. Select a compatible loader version and install the official files.
4. For actual sign-in, configure an appropriate public application ID that you control and whose service access has been established. Complete browser sign-in with a legitimately entitled Minecraft account.
5. Select My Mods → Install DKKF HUD to verify/install the bundled 26.3 core and download compatible Fabric API from Modrinth.
6. In game, the intended controls are F8 for the HUD editor and F9 for profiles. Actual authenticated in-game validation remains pending.

The Windows builds currently have **no Authenticode code signature**. The source archive and `SHA256SUMS.txt` are supplied alongside development artifacts. Hashes do not establish publisher identity or guarantee that third-party mods are safe.

## Building and reviewing

```powershell
pnpm install --frozen-lockfile
node node_modules/electron/install.js
pnpm test
pnpm build
pnpm start
```

Windows packaging:

```powershell
pnpm package
```

The 26.3 core was built with JDK 26.0.2.1, Gradle 9.5.0 and Loom 1.17.21, targeting Java 25 bytecode. See [BUILD.md](BUILD.md) for the separate Java build and bundle/hash synchronization steps. Review is possible without supplying real credentials; end-to-end sign-in cannot be claimed before the appropriate access and account testing.

## Repository guide

- `launcher/main`: authentication, trusted IPC, local database/vaults, game installation/launch, mods/packs and updates.
- `launcher/renderer`: React launcher UI and the common non-affiliation footer.
- `shared`: types, validation schemas, 26.3 target and bundled-core integrity metadata.
- `client/common`: loader-independent HUD profiles/model.
- `client/fabric26_3`: active Minecraft 26.3 Fabric adapter.
- `client/fabric`: preserved historical 1.21.1 source; excluded from the active root build.
- `backend`: development update-file service and signed announcements.
- `scripts`, `tests`, `docs`: build/review utilities, tests, screenshots and recorded evidence.

## Review and support documents

- [Authentication and API reviewer notes](AUTHENTICATION.md)
- [Privacy notice](PRIVACY.md)

Contact: [pluswoori@gmail.com](mailto:pluswoori@gmail.com). Do not send passwords, live tokens, private keys, account databases or unredacted logs in an issue/email. Use the security contact for sensitive reports; no response-time or bounty commitment has been established.

## Licensing and affiliation

DKKF's own source and artwork are currently **All Rights Reserved** (`UNLICENSED` in package metadata). Public availability for review does not by itself grant an open-source redistribution license. Third-party components retain their own licenses; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Minecraft is owned by its respective rights holders. DKKF is an independent project and is not endorsed by Mojang or Microsoft.

**NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.**
