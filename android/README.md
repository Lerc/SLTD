# SLTD WebView app

This directory contains the entire native wrapper, build configuration, tests,
and F-Droid submission material. The web project needs no knowledge of it.
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

The F-Droid input is `app/build/outputs/apk/release/app-release-unsigned.apk`.
F-Droid builds it from source and supplies its own signature. For independent
distribution you must sign a release APK with your own persistent key using
`zipalign` and `apksigner`. Keep that key outside source control. The debug APK
is suitable for manual testing; it is not the F-Droid release artifact. Installing
an APK signed with a different key requires removing the old installation,
which erases its local scores.

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
adaptive foreground and legacy PNGs into `app/src/main/res/mipmap-*`. From the
repository root, with `npm ci` done and Chrome installed (`CHROME` overrides the
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
```

`fdroid-lint.sh` runs `fdroid lint` on the recipe against fdroiddata's current
category list, then fails unless `fdroid rewritemeta` leaves it unchanged, as
fdroiddata's CI requires. `check-fastlane.py` enforces F-Droid's listing limits
(title 50, short description 80, full description 4000, changelogs 500
characters) and requires a changelog for the current `versionCode`. The
`F-Droid metadata` GitHub workflow runs these two and the Node host check when
`android/` or `srv/` changes.

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
at a tagged revision with `subdir: android`, using the release Gradle build.
Descriptions and changelogs live in `fastlane/metadata/android/en-US/`, a location
F-Droid discovers relative to the configured build subdirectory.

To release:

1. Update the literal `versionName` and strictly increase `versionCode` in
   `app/build.gradle`. Keep this ID stable once distributed.
2. Add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` and update
   descriptions or screenshots as needed. Build, check, and manually test.
3. Commit both the wrapper and the exact `srv` files to release. Create and push a
   stable tag named `android-v<versionName>` (initially `android-v1.0.0`). These
   steps publish a release and are not performed by the build.
4. For initial inclusion, copy the recipe to fdroiddata's
   `metadata/io.github.lerc.sltd.yml` and submit it through F-Droid's inclusion
   process. Its initial tag must exist publicly before F-Droid can build it.

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
The standard Gradle wrapper JAR is build tooling. No reproducible-binary claim
is made; configure F-Droid's upstream-binary verification separately if desired.

References:

- [F-Droid build metadata and update modes](https://f-droid.org/en/docs/Build_Metadata_Reference/)
- [F-Droid upstream descriptions, graphics and changelogs](https://f-droid.org/en/docs/All_About_Descriptions_Graphics_and_Screenshots/)
- [F-Droid inclusion policy](https://f-droid.org/en/docs/Inclusion_Policy/)
- [Android local WebView content and HTTPS origins](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [Android Gradle plugin 8.13 compatibility](https://developer.android.com/build/releases/agp-8-13-0-release-notes)
