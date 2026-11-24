# Dkkf Launcher Android 0.1.2-preview

Fixes the missing DkkfLoginActivity manifest declaration that caused ActivityNotFoundException when opening Microsoft login. Reported on Galaxy Z Fold 4. The release uses the same application ID and signing certificate so it can update 0.1.0-preview without uninstalling.

ARM64 Android preview based on Amethyst Android / PojavLauncher. This is a native Java/JNI launcher, not an Electron WebView conversion. The Windows launcher remains separate.

Upstream: https://github.com/AngelAuraMC/Amethyst-Android
Base revision: `166af615dbdca1a507b8c2d379822cca02795132`
License: LGPLv3; see `LICENSE` and `COPYING-GPL3.txt`. Original copyright notices and upstream credits are retained. The modified Android source is supplied with this preview. It does not contain Windows launcher sources or the private APK signing key.

TaCZ and mod 3 are no longer automatically installed, repaired or enabled. Existing copies in user instances are preserved.

## Implemented in this preview

- Separate application ID `kr.dkkf.launcher.android`, ARM64 only, minimum Android 8/API 26, compile SDK 36, upstream target SDK 34.
- DKKF icon and server profile. Java 25 ARM64 is downloaded from the official Amethyst runtime release and checked against a pinned SHA-256 before installation.
- Fabric 26.3 / Loader 0.20.1 preparation and the same three pinned client mods as Windows 0.6.3: Fabric API, Xaero's Minimap and Dkkf Loot Xaero Client. XaeroLib is included in the minimap JAR.
- Setup runs before each requested game launch. Existing incompatible required mods and DKKF HUD are moved into a profile backup. Locator Bar is not installed by default.
- Official Microsoft device-code sign-in in the external browser. The app does not collect passwords. It requires Java Edition entitlement and a real Minecraft profile. Local/demo login is not offered for DKKF launch.
- Refresh/access tokens are saved in AES-GCM account files using Android Keystore. Original authentication-body/token logging is removed. Android app backup is disabled.
- Quick Play connects to `dkkf.mc-hosting.xyz`. Conflicting singleplayer/server/Realms selectors are removed.
- Existing engine touch controls, renderer settings and Korean/English/Mongolian resource support are retained. DKKF setup/login messages are provided in these three languages.

## Installation and first use

Transfer the signed APK to an ARM64 Android phone and open it with the Android package installer. Android controls installation from outside an app store. No phone has been connected to, installed on, or modified by this work.

1. Open Dkkf Launcher Preview and sign in with a Microsoft account that owns Minecraft Java Edition.
2. Use the DKKF server profile and press Play. First launch downloads Java 25, the official game/Fabric files and remote required mods; an Internet connection is required.
3. The initial renderer is MobileGlues. Existing engine settings provide renderer, memory and touch-control options. Android graphics support depends on the actual GPU/driver and game/mod combination.

## Limits and verification

The APK builds and its developer signature verifies. Native code is ARM64 only. Build/signature/manifest/library inspection is not a successful game launch test. Actual Samsung device installation, Microsoft sign-in, server joining, TaCZ rendering and touch usability have not been tested, in line with the owner's request to skip execution tests. This preview does not claim full Windows UI/instance-management feature parity.

Eleven upstream graphics/input libraries in the first artifact have 4 KB ELF LOAD alignment. The locally compiled JNI bridge uses flexible page-size support. The app explicitly enables Android 16+ page-size compatibility mode, which is a fallback rather than full native 16 KB support. This can still fail on a device; do not advertise complete compatibility with every recent Galaxy phone or Play Store eligibility. See https://developer.android.com/guide/practices/page-sizes.

The APK is signed with a separate DKKF Android developer key. It is not a Microsoft/Windows code-signing certificate or a Play Store approval. The key and its Windows-DPAPI-protected password remain outside this source tree.

## Rebuilding

Use JDK 21, Android SDK platform 36, build-tools 36.1.0, NDK 27.0.12077973 and CMake 3.22.1. Gradle wrapper 9.6.1 is included. MioLibPatcher compiles using JDK 21 with Java 8 API/bytecode compatibility. Both submodule source trees are included in the source archive.

Create an untracked `local.properties` with your own `sdk.dir`. For a release build, configure `DKKF_ANDROID_KEYSTORE`, `DKKF_ANDROID_STORE_PASSWORD` and a keystore alias `dkkf-android`, then run:

```
gradlew.bat :app_pojavlauncher:assembleRelease -x lint -x test
```

Use your own signing key. Rebuilding with another key does not update the original signed installation. No runtime credentials or private signing files are included. The Microsoft public client identifier is internal app configuration, not a client secret; a fork should use its own approved public-client registration.

## Publication status

The owner approved public APK and corresponding Android source distribution. Windows sources remain private. Device execution tests remain excluded; the manifest and packaged activity declaration are inspected during the build.

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
