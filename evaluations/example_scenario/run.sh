#!/bin/bash
# Example evaluation script for SLTD headless mode

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME_DIR="$SCRIPT_DIR/../.."

cd "$SCRIPT_DIR"

echo "Running example scenario evaluation..."
echo "======================================="
echo ""

# Run evaluation
node "$GAME_DIR/srv/nodemain.js" -e "
  load_json initial_state.json;
  buy_tower Tower 5 5;
  buy_tower Tower 6 5;
  advance 500;
  list_counts;
  show_tower 0;
  show_tower 1;
  save_json final_state.json
" > evaluation.log 2>&1

# Check if evaluation succeeded
if [ $? -eq 0 ]; then
  echo "✓ Evaluation completed successfully"
  echo ""
  echo "Final state summary:"
  cat final_state.json | jq '{lives, money, wave: .waveCounter, creeps: (.creeps | length), towers: (.towers | length)}'
  echo ""
  echo "See evaluation.log for detailed trace"
else
  echo "✗ Evaluation failed - check evaluation.log"
  exit 1
fi
