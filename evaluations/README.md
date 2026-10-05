# SLTD Evaluations

This directory contains headless gameplay scenarios and historical art reviews.
Use `npm test` for the maintained regression suite; use individual scenarios
for repeatable gameplay or appearance investigations.

## Structure

Headless scenarios use a `run.sh` entry point and can include a Node runner with
assertions. Starting states, output logs and final states are generated files
ignored by Git. Art-review directories instead contain their own rendering
scripts, images, prompts and notes.

## Running Evaluations

```bash
# Run a specific scenario
cd evaluations/example_scenario
bash run.sh

# Or, from the repository root:
bash evaluations/example_scenario/run.sh
```

## Creating New Scenarios

1. Create a new directory:
   ```bash
   mkdir evaluations/my_scenario
   cd evaluations/my_scenario
   ```

2. Generate or create initial state:
   ```bash
   # Option A: Generate a fresh game before any ticks
   node ../../srv/nodemain.js 0 > initial_state.json

   # Option B: Copy and modify existing state
   cp ../example_scenario/initial_state.json .
   # Edit initial_state.json as needed
   ```

3. Create run script:
   ```bash
   cp ../example_scenario/run.sh .
   cp ../example_scenario/run.js .
   # Update run.js purchases, simulation length, and assertions
   ```

4. Run and validate:
   ```bash
   bash run.sh
   ```

## Example Scenarios

### example_scenario
The runner creates a fresh `initial_state.json` if one is absent, preserving
an existing starting state for repeatable runs. Its seeded Node scenario places
Sentries at Foundry cells (3,2) and (5,4), launches a wave, and advances 500 ticks.
Assertions require both purchases to succeed, lives to remain unchanged, score
to increase, and money to stay nonnegative. An assertion failure makes the
script exit unsuccessfully; successful runs write `final_state.json` and print
a summary. The runner requires Node.js and Bash; jq is only needed for the
optional queries below.

To reset the scenario to a fresh starting state, run from the repository root:

```bash
node srv/nodemain.js 0 > evaluations/example_scenario/initial_state.json
```

## Available Commands

See all REPL commands:
```bash
node srv/nodemain.js --commands
```

Key commands for evaluations:
- `load_json <file>` - Load game state
- `save_json <file>` - Save game state
- `tower_types` - List the catalog and command class names
- `buy_tower <type> <x> <y>` - Place a buildable foundation; see `towerInfo` in `srv/arsenal.js`
- `level_up_tower <idx>` - Buy a tower level
- `upgrade_tower <idx> <type>` - Buy an available specialization branch
- `send_wave` - Launch a wave when sending is allowed
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
