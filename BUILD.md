# Building DKKF Client

This document describes the currently documented development and build process for **DKKF Client Neon Edition v0.2.0**.

> **Development status:** DKKF Client is not yet production-ready. Microsoft/Xbox/Minecraft sign-in requires appropriate application registration and service access, and successful real-account end-to-end testing remains pending. The in-game Fabric HUD has not yet been fully verified in a live authenticated session.

## 1. Project overview

DKKF Client contains a Windows desktop launcher built with Electron and React, plus a separate Fabric HUD component targeting Minecraft Java Edition 26.3.

Relevant source directories described in the repository README:

| Directory | Purpose |
| --- | --- |
| `launcher/main` | Electron main process, authentication, local data, game launch, updates |
| `launcher/renderer` | React user interface |
| `shared` | Shared types, validation, target versions, integrity metadata |
| `client/common` | Loader-independent HUD components |
| `client/fabric26_3` | Active Fabric 26.3 HUD adapter |
| `client/fabric` | Historical 1.21.1 implementation; not part of the active root build |
| `backend` | Development update service |
| `scripts`, `tests`, `docs` | Utilities, tests, and review documentation |

## 2. Prerequisites

- Windows for the documented Windows packaging workflow.
- Node.js and `pnpm` compatible with the project's package metadata and lockfile. **Check the exact versions in `package.json` and the lockfile before building.**
- Java 25 or newer for the targeted Minecraft game environment.
- A compatible JDK and Gradle toolchain for building the Fabric HUD. The README reports a previous successful build using **JDK 26.0.2.1**, **Gradle 9.5.0**, and **Loom 1.17.21**, targeting Java 25 bytecode. These are reported build versions, not a guarantee that every environment will work.
- Network access to install dependencies and retrieve official game/loader metadata where needed.

## 3. Obtain the source

Clone the repository:

```powershell
git clone https://github.com/pluswoori-droid/DKKF-Client.git
cd DKKF-Client
```

**Important:** The public repository currently publishes a source ZIP (`DKKF-Client-0.2.0-Source.zip`) rather than the complete extracted project tree at its root. If the expected `package.json`, `pnpm-lock.yaml`, and source folders are not present after cloning, extract that ZIP into a working directory and run the commands below from the directory containing `package.json`.

Do not run `pnpm` commands from the GitHub repository root unless that is where the package manifest actually resides.

## 4. Install launcher dependencies

From the extracted project's package root:

```powershell
pnpm install --frozen-lockfile
node node_modules/electron/install.js
```

The second command is included because it is explicitly documented in the repository README. If installation fails, verify the Node.js version, package manager version, lockfile, and network access.

## 5. Run checks and build the launcher

The README documents these commands:

```powershell
pnpm test
pnpm build
pnpm start
```

Run each from the package root. `pnpm test` executes the project's configured tests; `pnpm build` performs its configured build; `pnpm start` launches the configured development/runtime entry point. Consult the `scripts` section of `package.json` for the precise implementation.

## 6. Create a Windows package

```powershell
pnpm package
```

The README identifies the expected development installer name as:

```text
DKKF-Client-0.2.0-Setup.exe
```

The actual output directory and filenames are controlled by the project packaging configuration. Locate the generated artifact after the command finishes. **Do not claim a successful package or publish a download link until the output exists and has been tested.**

The currently documented Windows development builds are **not Authenticode code-signed**. Windows may display publisher/security warnings. A SHA-256 checksum can help detect file changes but does not authenticate the publisher.

## 7. Build the Fabric HUD

The active HUD source is in:

```text
client/fabric26_3
```

The project targets:

- Minecraft Java Edition **26.3**
- Fabric Loader **0.20.1**
- Fabric API **0.166.2+26.3**
- Java **25** bytecode target

The README reports the HUD was compiled with JDK 26.0.2.1, Gradle 9.5.0, and Loom 1.17.21.

**The exact Gradle task, wrapper location, output JAR name, and launcher bundle synchronization commands have not been verified from the source archive.** Before building or replacing the bundled HUD, inspect:

1. `client/fabric26_3` for `gradlew.bat`, `settings.gradle*`, and `build.gradle*`.
2. The configured Java toolchain and Loom/Fabric dependencies.
3. Project scripts that copy the compiled HUD JAR into launcher resources.
4. Integrity metadata in `shared` that records the bundled JAR's hash.

Do not substitute a newly built JAR without updating any required bundle metadata and hashes. Do not use the historical `client/fabric` (1.21.1) module as the active 26.3 HUD.

## 8. Microsoft authentication configuration

The launcher uses a Microsoft device-code flow followed by Xbox/XSTS and Minecraft Services exchanges. The documented development build starts with an **empty Microsoft public client ID**.

For actual account testing:

1. Register and control an appropriate public client application.
2. Establish any required Microsoft/Minecraft service permissions or approvals.
3. Configure the public client ID in the launcher settings as supported by the project.
4. Authenticate through Microsoft's official browser/device flow with a legitimate Minecraft Java Edition account.
5. Verify entitlement, Minecraft profile retrieval, token refresh, logout, and authenticated game launch.

Do not embed client secrets in a public Electron application, distribute credentials, or bypass entitlement checks. The presence of the authentication source code does **not** mean the application is approved or that real-account login has been verified.

## 9. Modrinth and CurseForge

- **Modrinth:** The README reports successful API and download tests. Verify compatibility and dependency handling with the versions you intend to support.
- **CurseForge:** A valid issued API key is required for real integration testing. Do not commit an API key to Git or expose a confidential key in Electron renderer code or a distributable bundle. Confirm the provider's current API terms and an appropriate key-management architecture before public distribution.

## 10. Release checklist

Before publishing a release:

- [ ] Confirm the extracted source matches the intended Git commit/version.
- [ ] Run `pnpm install --frozen-lockfile` successfully.
- [ ] Run `pnpm test` and review failures.
- [ ] Run `pnpm build` successfully.
- [ ] Run `pnpm package` and verify the installer exists.
- [ ] Install and launch the packaged Windows app on a clean test machine.
- [ ] Verify Java discovery and Minecraft game installation.
- [ ] Verify Microsoft login and authenticated game launch with an authorized, entitled account.
- [ ] Verify Modrinth operations and CurseForge operations if enabled.
- [ ] Compile the active Fabric HUD, verify the bundled JAR/hash, and test it in-game.
- [ ] Confirm that secrets, credentials, personal data, game files, and test account databases are absent from release artifacts.
- [ ] Review `PRIVACY.md`, `AUTHENTICATION.md`, and `THIRD-PARTY-NOTICES.md` for accuracy.
- [ ] Produce and verify checksums (for example, `SHA256SUMS.txt`).
- [ ] Clearly label development builds and any incomplete features.

## 11. Troubleshooting

**`package.json` not found:** You may still be in the repository root. Extract `DKKF-Client-0.2.0-Source.zip` and change into the package root.

**`pnpm` not recognized:** Install or enable a compatible `pnpm` version and reopen the terminal.

**Electron binary missing:** Check the dependency installation and run the README's documented `node node_modules/electron/install.js` step.

**Java or Gradle build failure:** Confirm the selected JDK, toolchain configuration, wrapper, and dependencies in the active Fabric module.

**Microsoft sign-in fails:** Confirm public client ID, application permissions, provider approval, network access, and legitimate game entitlement. Do not treat the incomplete authentication flow as a successful login.

**CurseForge requests fail:** Check that a valid API key was issued, is configured securely, and is permitted for the intended use.

## 12. Source and limitations

Based on the public repository README: https://github.com/pluswoori-droid/DKKF-Client

This document records the build commands and versions published in that README. It has **not** independently executed the build or audited every file inside the source ZIP. Verify commands against the actual extracted source before relying on this document for a release.

DKKF Client is an independent project and is not approved by or affiliated with Mojang or Microsoft.
