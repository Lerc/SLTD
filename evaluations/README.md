# SLTD Evaluations

This directory contains evaluation scenarios for testing gameplay in headless mode.

## Structure

Each evaluation scenario should be in its own subdirectory with:
- `initial_state.json` - Starting game state
- `run.sh` - Evaluation script that executes commands
- `evaluation.log` - Output log from the evaluation
- `final_state.json` - End state after evaluation completes

## Running Evaluations

```bash
# Run a specific scenario
cd evaluations/example_scenario
bash run.sh

# Or run directly
node ../../srv/nodemain.js -e "load_json initial_state.json; advance 500; save_json final_state.json"
```

## Creating New Scenarios

1. Create a new directory:
   ```bash
   mkdir evaluations/my_scenario
   cd evaluations/my_scenario
   ```

2. Generate or create initial state:
   ```bash
   # Option A: Generate from scratch
   node ../../srv/nodemain.js 200 > initial_state.json

   # Option B: Copy and modify existing state
   cp ../example_scenario/initial_state.json .
   # Edit initial_state.json as needed
   ```

3. Create run script:
   ```bash
   cp ../example_scenario/run.sh .
   # Edit run.sh to customize commands
   ```

4. Run and validate:
   ```bash
   bash run.sh
   ```

## Example Scenarios

### example_scenario
Basic tower placement and advancement test:
- Loads initial state at tick 100
- Places two towers
- Advances 500 ticks
- Validates final state

## Available Commands

See all REPL commands:
```bash
node srv/nodemain.js --commands
```

Key commands for evaluations:
- `load_json <file>` - Load game state
- `save_json <file>` - Save game state
- `buy_tower <type> <x> <y>` - Place tower (types: Tower, Stubby, Star, Boom, BigBoom)
- `advance [ticks]` - Run simulation
- `list_counts` - Show game state summary
- `show_creep [idx]` - Inspect creep details
- `show_tower [idx]` - Inspect tower details

## Automated Testing

Use jq to extract and validate metrics:

```bash
# Check that lives didn't drop below threshold
LIVES=$(cat final_state.json | jq -r '.lives')
if [ "$LIVES" -ge 15 ]; then
  echo "PASS: Lives = $LIVES"
else
  echo "FAIL: Lives dropped to $LIVES"
  exit 1
fi

# Check that money increased
INITIAL_MONEY=$(cat initial_state.json | jq -r '.money')
FINAL_MONEY=$(cat final_state.json | jq -r '.money')
if [ "$FINAL_MONEY" -gt "$INITIAL_MONEY" ]; then
  echo "PASS: Money increased from $INITIAL_MONEY to $FINAL_MONEY"
fi
```
