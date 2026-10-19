#!/bin/bash
# Lint the F-Droid recipe the way fdroiddata's CI does: `fdroid lint`, then
# require that `fdroid rewritemeta` leaves the file unchanged.
#
#   android/tools/fdroid-lint.sh
#
# Requires `fdroid` (pip install fdroidserver) on PATH, or FDROID set to it.
# Categories are validated against fdroiddata's current list, fetched live.
set -euo pipefail

FDROID="${FDROID:-fdroid}"
APP=io.github.lerc.sltd
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RECIPE="$HERE/../fdroid/metadata/$APP.yml"
CATEGORIES=https://gitlab.com/fdroid/fdroiddata/-/raw/master/config/categories.yml

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/metadata" "$WORK/config"
cp "$RECIPE" "$WORK/metadata/"
curl -fsSL "$CATEGORIES" -o "$WORK/config/categories.yml"
# The category icons live beside the list in fdroiddata; lint only needs names.
sed -i '/^  icon:/d' "$WORK/config/categories.yml"

cd "$WORK"
# lint prints problems but can still exit 0, so also fail on any reported line.
status=0
"$FDROID" lint "$APP" > lint.log 2>&1 || status=$?
grep -v ' INFO: ' lint.log > problems.log || true
cat problems.log
if [ "$status" -ne 0 ] || [ -s problems.log ]; then
  echo "fdroid lint reported problems" >&2
  exit 1
fi

"$FDROID" rewritemeta "$APP" > rewrite.log 2>&1 || { cat rewrite.log; exit 1; }
if ! diff -u "$RECIPE" "metadata/$APP.yml"; then
  echo "Recipe is not in canonical form; apply the diff above" >&2
  exit 1
fi
echo "PASS F-Droid recipe lint and canonical format"
