# Privacy Notice — DKKF Client

Last updated: November 16, 2026  
Applies to: the DKKF Client 0.2.0 Windows launcher source and development build  
Project contact: [pluswoori@gmail.com](mailto:pluswoori@gmail.com)

This notice describes the current implementation. Microsoft/Minecraft authentication has not yet been validated end to end with an approved application ID and a real user account. Features requiring platform credentials are identified as pending in the project documentation. This notice does not assert Microsoft approval or legal certification.

## 1. Local data

The launcher stores data under its Electron user-data directory, normally `%APPDATA%/dkkf-client/data`. Settings → Open data folder shows the actual location. Development tests can use a separate directory through `DKKF_DATA_DIR`.

| Data                                                              | Purpose                                                   | Storage                                                                          |
| ----------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Minecraft profile name, profile UUID and token expiration         | Show and select a verified game account                   | Local SQLite database; this profile metadata is not encrypted by the application |
| Microsoft refresh token and Minecraft access token                | Refresh authentication and start an entitled game session | Separate local `.vault` file encrypted using Electron safeStorage on Windows     |
| Optional Modrinth token / CurseForge API key                      | Perform the user's platform requests                      | Separate safeStorage-encrypted local vaults                                      |
| Settings, Java path, instance names, game/loader versions and RAM | Configure and install the user's game environments        | Local SQLite database                                                            |
| Instance ID, launch time and exit code                            | Display recent play history                               | Local SQLite database                                                            |
| Game files, mods, configurations, worlds and local backups        | Install and run the selected instance                     | Local instance directories                                                       |
| Launcher/game logs                                                | Diagnose game startup and execution problems              | Local log files                                                                  |
| HUD positions, colors, visibility, scale and profiles             | Preserve in-game HUD preferences                          | Local `config/dkkf/profiles/*.properties` files inside the game instance         |

The current launcher has no automatic retention period for these local files. They remain until removed by the user or by the applicable instance/account management action. Windows safeStorage encryption does not make tokens inaccessible to all software running as the same Windows user; protect the Windows account and device accordingly.

The launcher can look for installed Java executables in known installation directories and run `java -version` locally. That discovery result is used to select a suitable Java runtime; it is not uploaded to a project analytics service.

## 2. Microsoft and Minecraft authentication

Sign-in begins only when the user selects Microsoft sign-in. The launcher requests a device authorization code from Microsoft. The user completes authentication and any required consent in Microsoft's official browser page. The launcher does not collect or store the Microsoft account password or MFA credentials.

The implementation requests `XboxLive.signin offline_access`. It exchanges the resulting authorization through Xbox User Authentication, XSTS and Minecraft Services, checks the Minecraft Java Edition entitlement response, and retrieves the Minecraft profile. It adds an account only after those checks succeed. Device codes and intermediate Microsoft access/Xbox/XSTS tokens are used in memory; the persisted credentials are the Microsoft refresh token and Minecraft access token described above.

Credential tokens remain in the Electron main process and are not returned to the renderer UI. When a game is launched, its Minecraft access token is passed to the local Java game process through the game's launch arguments. This is a local credential exposure boundary: other software running with sufficient local privileges and third-party game code may be able to inspect or misuse credentials. The project does not claim that encrypted storage protects against a compromised device or malicious mod.

Authentication requests go to Microsoft, Xbox and Minecraft endpoints. The current source uses `login.microsoftonline.com`, `user.auth.xboxlive.com`, `xsts.auth.xboxlive.com` and `api.minecraftservices.com`. Those providers receive the data needed for the requested authentication operation and ordinary connection information, such as the user's public IP address. Their own privacy terms apply.

## 3. Downloads and optional platform features

- **Official game installation:** the launcher contacts Mojang/Minecraft metadata and download servers. Selecting a mod loader can also contact its official metadata/Maven servers. The official Forge/NeoForge installer may make its own dependency requests.
- **Mod search and installation:** Modrinth or CurseForge receives the user's search terms, requested project/file IDs, game version and loader filters, together with normal HTTP connection information. CurseForge requests include the user's configured API key. Download servers receive the requested file URLs.
- **Modrinth publishing:** only when the user starts a publish operation, the launcher checks the token's user/team permissions and sends the selected JAR/MRPACK file, project/version details, changelog, game versions and loaders to Modrinth. Review selected files before publishing; their contents become subject to the platform's publishing and visibility rules.
- **Updates and announcements:** when the user configures an update server and trusted public key, update checks and a signed-announcement WebSocket connection contact that server. Automatic checks are enabled by default, but the initial update URL and key are empty. The update server can observe normal connection/request information. The current launcher does not attach Minecraft profile metadata or credential tokens to update requests.

Requests made through the launcher's shared HTTP helper include a product/version User-Agent; other requests may use the runtime's default headers. External providers may maintain their own access logs. DKKF cannot determine their retention practices from this source code.

## 4. Telemetry and developer access

The current launcher source does not implement an advertising SDK, developer analytics upload, automatic crash-report upload, or automatic upload of local account databases, worlds, play history or logs to the project contact. An optional update server is not an analytics service in the current code, although its operator or hosting provider may log requests.

Minecraft itself and installed mods are separate programs and may have their own telemetry, network connections and privacy behavior. Mod JARs run with the game process's privileges; this launcher does not sandbox their code. This notice does not describe or guarantee the behavior of every external mod or game version.

If the user emails the project contact or opens a public GitHub issue, the information they include is shared with the selected email/GitHub service and its recipients. Do not include passwords, access/refresh tokens, private keys, `.vault` files, account databases or unredacted logs in support requests. No fixed support-message retention or deletion schedule has been established; ask the project contact about a specific message.

## 5. Logs and retention limitations

The launcher attempts to redact known bearer/access/refresh token patterns and the active Minecraft token from captured launch output. Redaction is not a guarantee that all secrets or personal information are removed. Game and mod logs may contain local paths, Windows usernames, profile names/UUIDs, server addresses, mod lists or other information.

Logs and play history have no automatic expiration in this development build. Examine and redact them before sharing. Account logout does not erase historical logs, game worlds, backups or all account references that another program may have written.

## 6. Removal and user controls

- **Account logout:** removes the launcher's local vault and saved profile entry for the selected account. It does not revoke every Microsoft session or guarantee secure deletion from disk, OS backups or other programs.
- **Platform key deletion:** Settings can delete a stored Modrinth token or CurseForge key from the local launcher vault. Revoke the credential at its issuing platform if access must be withdrawn there as well.
- **Instance deletion:** after the launcher's confirmation, removes that instance directory, including its worlds and local files. Make a backup first. Local database history may remain.
- **Complete local removal:** close the launcher and game, back up wanted worlds/files, then remove the launcher data directory. This removes the launcher's local database, vaults and contained instances. Uninstalling the application should not be assumed to erase all user data.
- **Remote service access:** use Microsoft's or the relevant platform's own account controls to review/revoke access and manage data held by that provider.

## 7. Questions and changes

Contact [pluswoori@gmail.com](mailto:pluswoori@gmail.com) for questions about this implementation or to report a privacy concern. Do not email live credentials. If the launcher adds hosted accounts, telemetry, new uploads or other materially different data handling, this notice must be updated to match the released code.

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
