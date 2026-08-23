#!/bin/bash
# Drive the live browser game with the shared REPL command vocabulary and pull
# any screenshots it captured out to PNG files.
#
#   tools/sltd-browser.sh "buy_tower Tower 3 0; advance 400; screenshot mid"
#   tools/sltd-browser.sh --new "advance 300; screenshot wave1" ./shots
#
# --new taps through the title/game-over screen for a fresh game first.
# Screenshots land in OUTDIR (default ./shots) named <name>.png.
#
# Requires: the page open at the served URL, and `wsb ensure` already run.
set -euo pipefail

WSB="${WSB:-$HOME/.claude/skills/browser-bridge/wsb}"
APP="${SLTD_APP:-sltd}"

NEW=0
if [ "${1:-}" = "--new" ]; then NEW=1; shift; fi

SCRIPT="${1:?usage: sltd-browser.sh [--new] \"<commands>\" [outdir]}"
OUTDIR="${2:-./shots}"
mkdir -p "$OUTDIR"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PRE=""
[ "$NEW" = "1" ] && PRE="await gameControl.newGame();"

# JSON-quote the command script so it survives embedding in the JS below.
QUOTED=$(printf '%s' "$SCRIPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

# Run the command script in the page, then emit each shot as name<TAB>dataURL.
"$WSB" run --code "
gameControl.clearShots();
$PRE
wslog(await gameControl.run($QUOTED));
for (const line of gameControl.listShots()) {
  const shot = gameControl.getShot(parseInt(line));
  wslog('SHOT\t' + shot.name + '\t' + shot.dataURL);
}
" --app "$APP" --wait --timeout 120 2>&1 | python3 "$HERE/extract-shots.py" "$OUTDIR"
