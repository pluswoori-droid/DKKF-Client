# Third-Party Notices

**Project:** DKKF Client — Neon Edition  
**Version reviewed:** 0.2.0 development build  
**Status:** Preliminary notice; dependency-level license audit required before distribution.

DKKF Client is an independent Minecraft Java Edition launcher with an Electron/React desktop interface and an optional Fabric-based in-game HUD. This notice identifies third-party technologies and external services described in the project's public documentation. It is **not** a complete inventory of packages distributed in the installer or HUD JAR.

## 1. Project ownership and independence

DKKF Client's original source code and artwork are described by its maintainers as **All Rights Reserved** (package metadata: `UNLICENSED`). This does not override any third-party licenses.

**NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.**

Minecraft and related marks are the property of their respective owners.

## 2. Third-party frameworks and components

The public project documentation identifies the following technologies. Their inclusion here does not establish which exact package versions, transitive dependencies, or license texts are bundled in any particular distribution.

| Component | Role | License / attribution follow-up |
| --- | --- | --- |
| Electron | Desktop application runtime | Electron is distributed under the MIT license; preserve the applicable copyright and license text for the exact distributed version and its bundled components. |
| React | Launcher user interface | React is distributed under the MIT license; preserve the applicable copyright and license text for the exact distributed version. |
| Fabric Loader | Minecraft mod loader | Verify the exact distributed version and preserve its applicable license and notices. |
| Fabric API | Minecraft modding APIs | Verify the licenses and notices of the specific modules and versions distributed or downloaded. |
| SQLite and its Node bindings | Local application data | Audit the actual SQLite binding package and its bundled native dependencies separately; do not assume they all share SQLite's public-domain status. |
| Minecraft game files and assets | Official game installation | Obtained from official services; not relicensed by DKKF Client. Distribution must follow applicable Minecraft terms. |
| Other npm, Java, and native dependencies | Launcher, HUD, and build/runtime support | Inventory exact shipped dependencies and include required notices and license texts. |

## 3. External APIs and services

The services below are accessed over the network. Calling an API does not, by itself, mean the service's source code is bundled or licensed to DKKF Client.

### Microsoft / Xbox / Minecraft Services

DKKF Client describes a Microsoft sign-in flow followed by Xbox and Minecraft Services authentication and Java Edition entitlement/profile checks. Microsoft, Xbox, Minecraft, and related names are trademarks of their respective owners. DKKF Client is not sponsored or endorsed by Microsoft or Mojang.

- Microsoft identity platform: https://learn.microsoft.com/en-us/entra/identity-platform/
- Minecraft: https://www.minecraft.net/

Use is subject to applicable service agreements, developer requirements, and permissions. The project's public README states that service approval and real-account end-to-end authentication testing remain pending.

### Modrinth API

DKKF Client uses Modrinth for mod and modpack discovery, metadata, and compatible downloads.

- Website: https://modrinth.com/
- API documentation: https://docs.modrinth.com/api/
- Terms: https://modrinth.com/legal/terms

Individual projects and downloadable files may have their own licenses. DKKF Client does not acquire redistribution rights merely by retrieving content through the API. DKKF Client is not endorsed by Modrinth.

### CurseForge API

DKKF Client describes CurseForge integration for mod and modpack information and downloads, subject to API access and applicable restrictions.

- Website: https://www.curseforge.com/
- API terms: https://support.curseforge.com/support/solutions/articles/9000207405-curseforge-3rd-party-api-terms-and-conditions

Use requires compliance with the applicable API terms and access requirements. Content rights remain with the respective creators and rights holders. DKKF Client is not endorsed by CurseForge or Overwolf.

## 4. User-installed mods and modpacks

Mods, modpacks, resource packs, and other user-selected content may be licensed independently. Their licenses and attribution requirements are not replaced by this document. DKKF Client must not imply that content is freely redistributable merely because it is available through a third-party catalog.

## 5. Required distribution audit

Before publishing an installer, source archive, or bundled HUD JAR:

1. Extract the exact runtime dependency list from the release's `pnpm-lock.yaml`, package manifests, Gradle dependencies, and bundled native artifacts.
2. Record component name, exact version, author/copyright holder, license identifier, source URL, and whether its code is actually redistributed.
3. Include the full license text and copyright/NOTICE files whenever required, including notices for transitive dependencies and embedded runtimes.
4. Review any copyleft, source-offer, modification, or redistribution obligations separately.
5. Verify the Microsoft, Modrinth, and CurseForge integration against current provider policies and permissions.
6. Recheck this document for every release; do not mark it complete until the release artifacts have been audited.

## 6. Corrections and contact

If a required notice is missing or inaccurate, contact the project maintainer at **pluswoori@gmail.com** with the affected component and relevant license information.

**Repository:** https://github.com/pluswoori-droid/DKKF-Client

---

*This preliminary document is informational and is not a substitute for the complete license and copyright notices required by the software actually distributed.*
