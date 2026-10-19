#!/bin/bash
# Build the app the way F-Droid does, from the recipe, and check the result.
#
#   android/tools/fdroid-build.sh [--check-updates]
#
# The recipe is pointed at this checkout's HEAD commit, so unreleased work and a
# private repository can both be built. Runs the source scanner, `fdroid build`,
# then checks the APK: packaged files match srv, the APK scanner is clean, and no
# permissions are requested. --check-updates also runs `fdroid checkupdates` and
# requires it to find the versionCode in app/build.gradle among the release tags.
#
# Requires: fdroid (FDROID), gradlew-fdroid (GRADLEW_FDROID), and ANDROID_HOME
# with build-tools 35.0.0 and platform android-35.
set -euo pipefail

FDROID="${FDROID:-fdroid}"
GRADLEW_FDROID="${GRADLEW_FDROID:-$(command -v gradlew-fdroid)}"
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK}"
APP=io.github.lerc.sltd
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
AAPT2="$ANDROID_HOME/build-tools/35.0.0/aapt2"

# Read the version from the commit being built, not the working tree.
GRADLE_FILE="$(git -C "$ROOT" show "$SHA:android/app/build.gradle")"
VERSION_CODE="$(sed -n 's/^\s*versionCode\s\+\([0-9]\+\).*/\1/p' <<< "$GRADLE_FILE")"
VERSION_NAME="$(sed -n "s/^\s*versionName\s\+'\([^']\+\)'.*/\1/p" <<< "$GRADLE_FILE")"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/metadata"
# fdroid build rejects an APK whose version differs from the build entry, and
# HEAD may be ahead of the last release, so the entry takes HEAD's version too.
sed -e "s|^Repo: .*|Repo: $ROOT|" -e "s|^    commit: .*|    commit: $SHA|" \
  -e "s|^  - versionName: .*|  - versionName: $VERSION_NAME|" \
  -e "s|^    versionCode: .*|    versionCode: $VERSION_CODE|" \
  "$HERE/../fdroid/metadata/$APP.yml" > "$WORK/metadata/$APP.yml"
printf 'gradle: %s\n' "$GRADLEW_FDROID" > "$WORK/config.yml"
chmod 600 "$WORK/config.yml"
cd "$WORK"

echo "== Scanning source at $SHA"
"$FDROID" scanner --exit-code --refresh "$APP"

echo "== Building with fdroid build"
# fdroid build exits 0 even when the build fails, so check for its output.
"$FDROID" build --verbose --latest --no-tarball "$APP" > build.log 2>&1 || true
APK="unsigned/${APP}_$VERSION_CODE.apk"
if [ ! -f "$APK" ]; then
  grep -E 'ERROR|FAILURE|What went wrong' -A5 build.log || tail -40 build.log
  echo "fdroid build produced no $APK" >&2
  exit 1
fi
echo "Built $APK"

echo "== Checking the APK"
python3 "$HERE/verify-apk.py" "$APK"
"$FDROID" scanner --exit-code "$APK"
PERMISSIONS="$("$AAPT2" dump permissions "$APK" | grep -v '^package:' || true)"
if [ -n "$PERMISSIONS" ]; then
  echo "$PERMISSIONS"
  echo "The APK requests permissions; the listing promises none" >&2
  exit 1
fi
echo "PASS no permissions requested"

if [ "${1:-}" = "--check-updates" ]; then
  echo "== Checking update detection"
  "$FDROID" checkupdates --allow-dirty "$APP"
  FOUND="$(sed -n 's/^CurrentVersionCode: //p' "metadata/$APP.yml")"
  if [ "$FOUND" != "$VERSION_CODE" ]; then
    echo "checkupdates found versionCode $FOUND, but app/build.gradle has $VERSION_CODE" >&2
    exit 1
  fi
  echo "PASS checkupdates finds versionCode $FOUND"
fi
echo "PASS F-Droid build and APK checks"
