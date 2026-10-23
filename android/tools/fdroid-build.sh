#!/bin/bash
# Build the app the way F-Droid does, from the recipe, and check the result.
#
#   android/tools/fdroid-build.sh [--check-updates] [--verify-release]
#
# The recipe is pointed at this checkout's HEAD commit, so unreleased work and a
# private repository can both be built. Runs the source scanner, `fdroid build`,
# then checks the APK: packaged files match srv, the APK scanner is clean, and no
# permissions are requested. --check-updates also runs `fdroid checkupdates` and
# requires it to find the versionCode in app/build.gradle among the release tags.
#
# The recipe's Binaries entry is dropped unless --verify-release is given, since
# HEAD rarely has a published release. With it, `fdroid build` downloads the
# signed release APK, requires its contents to match this build, and checks its
# signer against AllowedAPKSigningKeys, exactly as F-Droid will. BINARIES
# overrides the download URL, for checking a signed APK before it is uploaded.
#
# OUT_DIR, if set, receives a copy of the unsigned APK: the file to sign.
#
# Requires: fdroid (FDROID), gradlew-fdroid (GRADLEW_FDROID), and ANDROID_HOME
# with build-tools 35.0.0 and platform android-35. F-Droid builds with JDK 17,
# and a release APK only matches its build when compiled by the same JDK.
set -euo pipefail

CHECK_UPDATES=
VERIFY_RELEASE=
for arg in "$@"; do
  case "$arg" in
    --check-updates) CHECK_UPDATES=1 ;;
    --verify-release) VERIFY_RELEASE=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

FDROID="${FDROID:-fdroid}"
GRADLEW_FDROID="${GRADLEW_FDROID:-$(command -v gradlew-fdroid)}"
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK}"
APP=io.github.lerc.sltd
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
AAPT2="$ANDROID_HOME/build-tools/35.0.0/aapt2"
if [ -n "${OUT_DIR:-}" ]; then
  mkdir -p "$OUT_DIR"
  OUT_DIR="$(cd "$OUT_DIR" && pwd)"
fi

# Read the version from the commit being built, not the working tree.
GRADLE_FILE="$(git -C "$ROOT" show "$SHA:android/app/build.gradle")"
VERSION_CODE="$(sed -n 's/^\s*versionCode\s\+\([0-9]\+\).*/\1/p' <<< "$GRADLE_FILE")"
VERSION_NAME="$(sed -n "s/^\s*versionName\s\+'\([^']\+\)'.*/\1/p" <<< "$GRADLE_FILE")"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/metadata"
# F-Droid clones a repository whose default branch exists. A CI tag checkout
# has none, so serve a copy with HEAD on main holding the commit and all tags.
git init -q --bare -b main "$WORK/source"
git -C "$WORK/source" fetch -q "$ROOT" "+$SHA:refs/heads/main" '+refs/tags/*:refs/tags/*'
# fdroid build rejects an APK whose version differs from the build entry, and
# HEAD may be ahead of the last release, so the entry takes HEAD's version too.
EDITS=(-e "s|^Repo: .*|Repo: $WORK/source|" -e "s|^    commit: .*|    commit: $SHA|"
  -e "s|^  - versionName: .*|  - versionName: $VERSION_NAME|"
  -e "s|^    versionCode: .*|    versionCode: $VERSION_CODE|")
if [ -z "$VERIFY_RELEASE" ]; then
  EDITS+=(-e '/^Binaries: /d')
elif [ -n "${BINARIES:-}" ]; then
  EDITS+=(-e "s|^Binaries: .*|Binaries: $BINARIES|")
fi
sed "${EDITS[@]}" "$HERE/../fdroid/metadata/$APP.yml" > "$WORK/metadata/$APP.yml"
if [ -n "$VERIFY_RELEASE" ] && ! grep -q '^Binaries: ' "$WORK/metadata/$APP.yml"; then
  echo "--verify-release needs a Binaries entry in the recipe" >&2
  exit 1
fi
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
  grep -E 'ERROR|FAILURE|What went wrong|compared built binary|reference binary' -A5 build.log \
    || tail -40 build.log
  echo "fdroid build produced no $APK" >&2
  exit 1
fi
echo "Built $APK"
if [ -n "$VERIFY_RELEASE" ]; then
  # A missing AllowedAPKSigningKeys is only a warning in fdroid build.
  grep -E 'compared built binary|reference binary|AllowedAPKSigningKeys' build.log
  if ! grep -q 'has allowed signer' build.log; then
    echo "The release APK's signer is not in AllowedAPKSigningKeys" >&2
    exit 1
  fi
  echo "PASS the signed release APK matches this build and has an allowed signer"
fi

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
if [ -n "${OUT_DIR:-}" ]; then
  cp "$APK" "$OUT_DIR/SLTD-$VERSION_NAME-unsigned.apk"
  echo "Copied the unsigned APK to $OUT_DIR/SLTD-$VERSION_NAME-unsigned.apk"
fi

if [ -n "$CHECK_UPDATES" ]; then
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
