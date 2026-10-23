#!/bin/bash
# Sign the unsigned release APK that the F-Droid build workflow uploads.
#
#   android/tools/sign-release.sh SLTD-<version>-unsigned.apk
#
# Writes SLTD-<version>.apk beside the input, verifies it, and prints the
# signer's SHA-256 for the recipe's AllowedAPKSigningKeys. apksigner asks for
# the keystore password. Sign only the workflow's APK: F-Droid publishes the
# signed one only if its own build, made with JDK 17, has identical contents.
#
# KEYSTORE defaults to sltd-release.jks in the directory above the repository;
# KEY_ALIAS defaults to sltd. Requires ANDROID_HOME with build-tools 35.0.0.
set -euo pipefail

: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
KEYSTORE="${KEYSTORE:-$(dirname "$ROOT")/sltd-release.jks}"
KEY_ALIAS="${KEY_ALIAS:-sltd}"
TOOLS="$ANDROID_HOME/build-tools/35.0.0"
APP=io.github.lerc.sltd

UNSIGNED="${1:?usage: sign-release.sh SLTD-<version>-unsigned.apk}"
[ -f "$KEYSTORE" ] || { echo "No keystore at $KEYSTORE; set KEYSTORE" >&2; exit 1; }

BADGING="$("$TOOLS/aapt2" dump badging "$UNSIGNED" | sed -n 1p)"
PACKAGE="$(sed -n "s/.*package: name='\([^']*\)'.*/\1/p" <<< "$BADGING")"
VERSION_NAME="$(sed -n "s/.*versionName='\([^']*\)'.*/\1/p" <<< "$BADGING")"
if [ "$PACKAGE" != "$APP" ]; then
  echo "$UNSIGNED is $PACKAGE, not $APP" >&2
  exit 1
fi
if "$TOOLS/apksigner" verify "$UNSIGNED" > /dev/null 2>&1; then
  echo "$UNSIGNED is already signed; sign the workflow's unsigned APK" >&2
  exit 1
fi

SIGNED="$(dirname "$UNSIGNED")/SLTD-$VERSION_NAME.apk"
"$TOOLS/apksigner" sign --alignment-preserved true --v4-signing-enabled false --ks "$KEYSTORE" --ks-key-alias "$KEY_ALIAS" --out "$SIGNED" "$UNSIGNED"
CERTS="$("$TOOLS/apksigner" verify --verbose --print-certs "$SIGNED")"
grep -E '^Verified using.*: true' <<< "$CERTS"
FINGERPRINT="$(sed -n 's/^Signer #1 certificate SHA-256 digest: //p' <<< "$CERTS")"
echo "Signed $SIGNED"
echo "AllowedAPKSigningKeys: $FINGERPRINT"
