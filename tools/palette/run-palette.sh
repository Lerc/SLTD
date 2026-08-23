#!/bin/bash
# Render each glow-probe chart in the live page, capture the post-glow frame,
# and write both the PNG and the sampled input->output data as JSON.
#
#   tools/palette/run-palette.sh [outdir]
#
# Requires the game page open and `wsb ensure` already run. The palette tool is
# injected fresh each time, so no game files need to change.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WSB="${WSB:-$HOME/.claude/skills/browser-bridge/wsb}"
APP="${SLTD_APP:-sltd}"
OUTDIR="${1:-$HERE/out}"
mkdir -p "$OUTDIR"

# Chart list: name plus optional argument.
CHARTS=("ramp" "blocks" "context" "lines:white" "lines:cyan" "lines:green" "lines:orange")

"$WSB" run "$HERE/palette.js" --app "$APP" --wait >/dev/null

for spec in "${CHARTS[@]}"; do
  chart="${spec%%:*}"
  arg="${spec#*:}"
  [ "$arg" = "$chart" ] && arg=""
  name="${spec/:/-}"

  echo "rendering $name ..."
  "$WSB" run --code "
    await palette.render('$chart'${arg:+, '$arg'});
    const shot = await palette.capture('$name');
    const sampled = await palette.sampleFromImage(shot.dataURL, shot.regions);
    wslog('SHOT\t$name\t' + shot.dataURL);
    wslog('DATA\t$name\t' + JSON.stringify({
      chart: '$chart', arg: '$arg', settings: palette.settings(), samples: sampled
    }));
  " --app "$APP" --wait --timeout 90 2>&1 | python3 "$HERE/collect.py" "$OUTDIR"
done

echo
echo "Charts written to $OUTDIR"
