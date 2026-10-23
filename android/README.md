# SLTD WebView app

This directory contains the native wrapper, build configuration, tests, and
F-Droid recipe. The store listing lives at the repository root in `fastlane/`,
the only place F-Droid reads it from. The web project needs no knowledge of either.
The application ID is `io.github.lerc.sltd`.

## Build from the command line

Requirements: JDK 17 or 21, SDK platform `android-35`, and SDK build tools
`35.0.0`. No IDE, NDK, Node dependencies, or game asset regeneration is needed.
The checked-in Gradle wrapper pins Gradle 8.14.3 and verifies its download with
SHA-256; the Android Gradle plugin is pinned to 8.13.0.

Set `ANDROID_HOME` to an existing SDK, or create an ignored `local.properties`
in this directory with `sdk.dir=/absolute/path/to/sdk`. Then, from this directory:

```sh
./gradlew --no-daemon :app:assembleDebug
```

The installable, debug-signed APK is
`app/build/outputs/apk/debug/app-debug.apk`. Transfer it to your phone and open it
to install. You can also use `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

```sh
./gradlew --no-daemon :app:assembleRelease
```

This builds `app/build/outputs/apk/release/app-release-unsigned.apk`. Do not sign
and publish it: released APKs come from the `F-Droid build` workflow (see
[Releases](#f-droid-releases-and-automatic-updates)). The debug APK is for manual
testing. Installing an APK signed with a different key requires removing the old
installation, which erases its local scores.

The first build may download Gradle and Maven build dependencies. The build
explicitly disables automatic SDK package installation. If tools are missing,
install them only after approving that installation. With the command-line SDK
manager available, the required packages are:

```sh
sdkmanager 'platforms;android-35' 'build-tools;35.0.0' 'platform-tools'
```

The SDK manager may ask you to accept licenses. A fully populated dependency
cache can build with `./gradlew --offline --no-daemon :app:assembleDebug`.

## Source of truth and runtime

Every build variant synchronizes **all files in `../srv` without changing their
contents** into generated APK assets under `web/`. The Gradle task tracks source
changes and removes stale generated assets when a source is removed. Never edit
the generated files. Local saved-state files in `srv` are also packaged: keep that
directory free of private or temporary files when making a release. The root MIT
license is included under `assets/legal/LICENSE`.

The native WebView serves bundled files through an intercepted HTTPS origin,
`https://appassets.androidplatform.net/assets/web/index.html`. Requests outside
the bundled web directory are denied; the app has no permissions, including no
Internet permission. There are no third-party runtime libraries, ads, analytics,
JavaScript/native object bridges, downloaded game code, or update installers.
The browser automation client already in `srv` remains byte-for-byte identical
and is inactive on this origin. JavaScript, DOM storage, Canvas and WebGL run in
the device's System WebView. Keep that WebView current.

The wrapper supports Android 6.0 (API 23) and later, with OpenGL ES 2.0 or later.
The app opens immersive fullscreen and locked to portrait; a swipe shows the
system bars briefly. It fits the portrait canvas within the available screen,
including split screen and display cutouts. The host adapter replaces the main
menu's Fullscreen button with Exit, which closes the app, and removes it from
the pause menu. Back closes the archive or map selection, clears a build selection, then pauses a running
game. Back from the pause menu asks before leaving the run. Backgrounding pauses
the simulation and cancels an unfinished drag. Returning keeps the game paused
until you resume it.

Best scores persist in localStorage at the fixed origin across app updates.
Rotation preserves the live WebView. A run is not restored after force-stop,
process death, or leaving the app via the exit prompt; uninstalling or clearing
app storage removes scores. Debug builds enable WebView inspection; release
builds disable it.

## Launcher icon

The icon is the Incinerator with its turret at 10 o'clock, exactly as the
Tactical Archive portrait draws it: `guideRenderPortrait` renders it through the
live glow shader at gameplay pixel scale. `tools/make-icon.mjs` serves `../srv`
locally, renders that portrait in headless Chrome (software WebGL), and writes the
adaptive foreground and legacy PNGs into `app/src/main/res/mipmap-*`. It also
writes the 512 px store icon to `fastlane/metadata/android/en-US/images/icon.png`,
because F-Droid does not read adaptive icons. That one is drawn at twice the scale
with one more blur level, which doubles the bloom radius and keeps the look sharp
at that size. From the repository root, with `npm ci` done and Chrome installed (`CHROME` overrides the
binary):

```sh
node android/tools/make-icon.mjs
```

## Checks

```sh
./gradlew --no-daemon :app:testDebugUnitTest :app:lintDebug :app:lintRelease
node tests/host.test.cjs
python3 tools/verify-apk.py app/build/outputs/apk/debug/app-debug.apk
python3 tools/verify-apk.py app/build/outputs/apk/release/app-release-unsigned.apk
tools/fdroid-lint.sh        # needs `pip install fdroidserver`
python3 tools/check-fastlane.py
tools/fdroid-build.sh       # also needs gradlew-fdroid and ANDROID_HOME
```

`fdroid-lint.sh` runs `fdroid lint` on the recipe against fdroiddata's current
category list, then fails unless `fdroid rewritemeta` leaves it unchanged, as
fdroiddata's CI requires. `check-fastlane.py` enforces F-Droid's listing limits
(title 50, short description 80, full description 4000, changelogs 500
characters) and the style rules `fdroid lint` applies to a summary and
description, which it never sees because F-Droid takes them from the listing: no
closing punctuation or "for Android" in the short description, and no trailing
spaces or malformed bullets in the full description. It also requires a
changelog for the current `versionCode`. The
`F-Droid metadata` GitHub workflow runs these two and the Node host check when
`android/`, `fastlane/` or `srv/` changes.

`fdroid-build.sh` builds the way F-Droid does, from a copy of the recipe pointed
at this checkout's HEAD (so a private repository and unreleased work both build),
with the build entry's version taken from that commit's `app/build.gradle`. It
runs `fdroid scanner` on the source, `fdroid build`, then checks the APK with
`verify-apk.py`, the APK scanner, and `aapt2` to confirm no permissions are
requested. `--check-updates` also requires `fdroid checkupdates` to find that
versionCode among the `android-v*` tags, so use it only on a tagged release.
`--verify-release` keeps the recipe's `Binaries` entry, which other runs drop:
`fdroid build` then downloads the signed release APK, requires it to match its own
build apart from the signature, and checks the signer against
`AllowedAPKSigningKeys`. Set `BINARIES` to another URL to check a signed APK
before uploading it. `OUT_DIR` receives a copy of the unsigned APK.
Install the tools with `pip install fdroidserver
git+https://gitlab.com/fdroid/gradlew-fdroid.git`; F-Droid replaces the checked-in
Gradle wrapper with `gradlew-fdroid`. The `F-Droid build` workflow runs it on the
same changes, weekly, and on demand. For an `android-v*` tag it adds
`--check-updates` and uploads the unsigned APK as the `SLTD-<tag>-unsigned`
artifact; publishing a GitHub release for such a tag runs `--verify-release`.

Unit tests cover origin restrictions, path traversal, cache query handling, and
MIME types. The Node check loads the actual shared game and UI handlers to check
the lifecycle adapter. The APK check compares every packaged game file against
`srv` and detects stale or missing assets. Run the existing web project's
`npm test` from the repository root as well.

Manual device checks: launch offline, choose a map, place and upgrade a tower,
verify glow and touch dragging, open and close the archive, use Back, background and resume during combat, confirm the screen stays portrait
when the device rotates, tap Exit on the main menu, and confirm a best
score survives force-stop and a same-signature app update. Check both gesture and
three-button navigation if available. No device testing is claimed by these
command-line checks.

## F-Droid releases and automatic updates

`fdroid/metadata/io.github.lerc.sltd.yml` is a proposed recipe for the official
fdroiddata repository, not an already accepted listing. It builds the whole repo
at a tagged revision with `subdir: android/app`, using the release Gradle build.
The subdirectory is the app module because F-Droid looks for the APK under
`<subdir>/build/outputs/apk`; Gradle still finds `android/settings.gradle` above it.
Descriptions and changelogs live in the repository root's
`fastlane/metadata/android/en-US/`. F-Droid reads listings only from the root of
the source checkout, never from the build subdirectory.

To release:

1. Update the literal `versionName` and strictly increase `versionCode` in
   `app/build.gradle`. Keep this ID stable once distributed.
2. Add `../fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` and update
   descriptions or screenshots as needed. Build, check, and manually test.
3. Commit both the wrapper and the exact `srv` files to release. Create and push a
   stable tag named `android-v<versionName>` (initially `android-v1.0.0`). These
   steps publish a release and are not performed by the build.
4. When the tag's `F-Droid build` run passes, download its
   `SLTD-android-v<versionName>-unsigned` artifact and sign the APK inside:

   ```sh
   android/tools/sign-release.sh SLTD-<versionName>-unsigned.apk
   ```

   It writes `SLTD-<versionName>.apk` and prints the signer's SHA-256, which must
   match the recipe's `AllowedAPKSigningKeys`. The keystore defaults to
   `sltd-release.jks` in the directory above the repository (`KEYSTORE` and
   `KEY_ALIAS` override). Never commit it, and keep backups of it and its
   password: without them no update can install over existing copies.
5. Create a GitHub release for the tag, attach `SLTD-<versionName>.apk` with
   exactly that name, and publish it. Its `F-Droid build` run then checks the
   APK as F-Droid will. F-Droid builds the tag itself and publishes this signed
   APK only if the contents match, so users can move between GitHub and F-Droid.
6. For initial inclusion, copy the recipe to fdroiddata's
   `metadata/io.github.lerc.sltd.yml` and submit it through F-Droid's inclusion
   process. Its initial tag and release must exist publicly before F-Droid can
   build it.

`UpdateCheckMode` selects only stable `android-vX.Y.Z` tags. `UpdateCheckData`
reads the version literals in `android/app/build.gradle`, so a web-only release
tag cannot accidentally trigger an app update. `AutoUpdateMode: Version` lets
F-Droid generate later build entries from matching tags. Future release tags
must contain an increased versionCode. F-Droid review and actual server build
validation are still required; automatic updating starts after inclusion.

The source and wrapper use the repository's MIT license. Existing artwork is
distributed under the repository license; verify that all shipped assets have
the necessary redistribution rights before submission. No proprietary runtime
SDKs, bundled native libraries, or precompiled application binaries are needed.
The standard Gradle wrapper JAR is build tooling.

Builds are reproducible: the same commit gives a byte-identical APK regardless of
checkout path, and `fdroid build` matches a plain `assembleRelease`. The JDK
matters, though. `classes.dex` differs between JDK 17 and 21, and F-Droid's build
server uses JDK 17, which is why the APK to sign comes from the workflow (JDK 17)
rather than a local build. `sign-release.sh` signs with `--alignment-preserved`:
apksigner otherwise re-pads stored entries, and F-Droid's signature copier then
fails to verify an APK whose contents are identical.

References:

- [F-Droid build metadata and update modes](https://f-droid.org/en/docs/Build_Metadata_Reference/)
- [F-Droid upstream descriptions, graphics and changelogs](https://f-droid.org/en/docs/All_About_Descriptions_Graphics_and_Screenshots/)
- [F-Droid inclusion policy](https://f-droid.org/en/docs/Inclusion_Policy/)
- [Android local WebView content and HTTPS origins](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [Android Gradle plugin 8.13 compatibility](https://developer.android.com/build/releases/agp-8-13-0-release-notes)
