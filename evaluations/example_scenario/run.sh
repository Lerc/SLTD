#!/bin/bash
# Example evaluation script for SLTD headless mode
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME_DIR="$SCRIPT_DIR/../.."

cd "$SCRIPT_DIR"

echo "Running example scenario evaluation..."

# Starting states are generated and ignored by Git.
if [ ! -f initial_state.json ]; then
  node "$GAME_DIR/srv/nodemain.js" 0 > initial_state.json
fi

# Run evaluation
if node "$SCRIPT_DIR/run.js" > evaluation.log 2>&1; then
  cat evaluation.log
  echo "Evaluation passed; see evaluation.log and final_state.json."
else
  cat evaluation.log >&2
  echo "Evaluation failed; see evaluation.log." >&2
  exit 1
fi
