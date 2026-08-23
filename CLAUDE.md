# SLTD - Tower Defense Game

## Project Overview
A mobile-oriented tower defense game built with vanilla JavaScript, Canvas 2D, and WebGL for visual effects (glow/bloom). The game runs in **dual-mode architecture**: full browser mode with rendering, and headless mode for testing and automation.

## Tech Stack
- **Language**: Vanilla JavaScript (ES5/ES6)
- **Rendering**: HTML5 Canvas 2D + WebGL for post-processing effects
- **Build Process**: None - no transpilation or bundling required
- **Dependencies**: Zero runtime dependencies
- **Runtime Environments**: Browser (Chrome, Firefox, Safari) + Node.js (headless mode)

---

## Architecture Overview

### Dual-Mode Design

The codebase is structured to run in two distinct modes:

#### 1. Browser Mode (Full Rendering)
```
index.html → [Dependencies] → showRunner.js (game logic) → main.js (browser init + rendering loop)
```
- Full Canvas 2D rendering
- WebGL glow/bloom post-processing effects
- Mouse/touch input handling
- Asset loading (images, sounds)
- requestAnimationFrame game loop

#### 2. Headless Mode (Logic Only)
```
nodemain.js → [Dependencies] → showRunner.js (game logic only)
```
- No rendering (draw() functions never called)
- Programmatic API for game control
- Tick-based simulation
- State persistence (JSON save/load)
- REPL interface for interactive testing

---

## Browser API Dependencies Analysis

Understanding which files use browser-specific APIs is crucial for maintaining dual-mode compatibility.

### Pure Logic Files (Node.js Compatible)
- **littleAStar.js** - A* pathfinding algorithm using PriorityQueue (completely universal)
- **Extras.js** - Math utilities (uses `globalThis.performance?.now()` with fallback to `Date.now()`)

### Browser-Dependent Files

#### Heavy Browser Dependencies
- **main.js** - `window.onload`, `requestAnimationFrame`, Canvas event listeners, CanvasRenderingContext2D
- **input.js** - `document.addEventListener`, mouse/touch/keyboard events
- **Assets.js** - `Image`, `XMLHttpRequest`, `AudioContext`
- **CanvasGlow.js**, **WebGLBoilerPlate.js**, **renderlist.js** - WebGL2 APIs

#### Moderate Browser Dependencies
- **gadgets.js**, **ui.js**, **world.js**, **entities.js** - Use `ctx` for drawing (optional, only called in browser mode)

### Key Design Decision

**No rendering stubs needed!** The headless mode uses minimal browser API stubs in `nodemain.js` and simply **doesn't call `gameMode.draw()`**. All Canvas 2D rendering code is never executed - much cleaner than creating elaborate no-op stubs.

**Compatibility Strategy**:
- `showRunner.js` uses feature detection (`typeof` checks) for browser-only APIs
- Draw functions are optional properties
- Graceful fallback when APIs are undefined
- No hard dependencies on DOM/Canvas in logic functions

### Implementation History

The dual-mode architecture was achieved through refactoring:
1. **Logic Extraction**: Game logic extracted from `main.js` → `showRunner.js`
2. **Minimal Stubs**: `nodemain.js` provides browser API stubs (window, document, Assets)
3. **API Layer**: Clean programmatic API for controlling game state
4. **REPL Interface**: Interactive command-line interface
5. **State Persistence**: JSON serialization for save/load

**Files Created/Modified**:
- ✅ `srv/showRunner.js` (NEW) - Pure game logic
- ✅ `srv/main.js` (REFACTORED) - Browser-only rendering
- ✅ `srv/nodemain.js` (NEW) - Node.js entry point with REPL
- ✅ `srv/index.html` (UPDATED) - Added showRunner.js script tag

---

## Project Structure

### Core Game Files (in `/srv/`)

#### Game Logic (Universal - runs in both modes)
- **`showRunner.js`** - Core game state and logic functions
  - Game modes: `mainGame`, `titleScreen`, `gameOver`, etc.
  - State management and game rules
  - Draw functions attached as properties (optional)
  - Uses feature detection for browser-only APIs
  - **Location**: srv/showRunner.js:1

- **`entities.js`** - Game entities (creeps, towers, projectiles)
  - Creep types and behaviors
  - Tower types and targeting logic
  - Bullet/projectile systems
  - **Location**: srv/entities.js:1

- **`world.js`** - Game world and level management
  - Map data and pathfinding grid
  - Wave spawning logic
  - **Location**: srv/world.js:1

- **`gadgets.js`** - Game gadgets/abilities (UI components)
  - Tower selection UI
  - Interactive game elements
  - **Location**: srv/gadgets.js:1

- **`Extras.js`** - Math utilities and helpers
  - Vector operations (v2, vadd, vsub, vscale, etc.)
  - Random number utilities
  - Timing helpers (uses performance.now() in browser, Date.now() in Node)
  - **Location**: srv/Extras.js:1

- **`littleAStar.js`** - A* pathfinding algorithm
  - PriorityQueue implementation
  - Pure logic, no browser dependencies
  - **Location**: srv/littleAStar.js:1

- **`commands.js`** - Shared command layer (universal)
  - The `advance`/`buy_tower`/`list_counts`/... vocabulary
  - `makeCommands(host)` — host supplies environment-specific I/O
  - Used by both `nodemain.js` and `gameControl.js`
  - **Location**: srv/commands.js:1

#### Browser-Specific Files
- **`main.js`** - Browser entry point and rendering loop
  - window.onload initialization
  - Canvas/WebGL setup
  - Event handlers (mouse/touch)
  - requestAnimationFrame loop
  - **Location**: srv/main.js:1

- **`input.js`** - User input handling
  - Keyboard, mouse, touch events
  - Input state management
  - **Location**: srv/input.js:1

- **`ui.js`** - User interface elements
  - HUD rendering
  - UI state management
  - **Location**: srv/ui.js:1

- **`Assets.js`** - Asset loading and management
  - Image loading
  - Audio system (AudioContext)
  - **Location**: srv/Assets.js:1

- **`CanvasGlow.js`** - Glow effect shader (optimized)
  - WebGL2 post-processing
  - Bloom/glow effects
  - 4x performance improvement from recent optimization
  - **Location**: srv/CanvasGlow.js:1

- **`WebGLBoilerPlate.js`** - WebGL setup utilities
  - Shader compilation helpers
  - WebGL context initialization
  - **Location**: srv/WebGLBoilerPlate.js:1

- **`renderlist.js`** - WebGL rendering system
  - Batch rendering for sprites
  - **Location**: srv/renderlist.js:1

- **`gameControl.js`** - Browser control surface for automated testing
  - Runs shared commands against the live page, plus `screenshot`
  - Synthetic mouse input and cell→client coordinate mapping
  - Driven over browser-bridge; see `tools/sltd-browser.sh`
  - **Location**: srv/gameControl.js:1

#### Headless-Specific Files
- **`nodemain.js`** - Node.js entry point
  - Minimal browser API stubs
  - Headless game loop (tick-based)
  - REPL interface
  - Command execution engine
  - State persistence API
  - **Location**: srv/nodemain.js:1

#### Other Files
- **`index.html`** - Browser entry point
- **`main.css`** - Minimal styling

### Configuration & Documentation
- **`package.json`** - NPM scripts and metadata
- **`CLAUDE.md`** - This file - comprehensive AI assistant guide
- **`README.md`** - Project overview
- **`.claude/settings.json`** - Claude Code configuration
- **`.claude/scripts/session-setup.sh`** - Session startup hook

### Evaluation Framework
- **`evaluations/`** - Test scenarios directory
  - `evaluations/README.md` - Evaluation documentation
  - `evaluations/example_scenario/` - Example test scenario
- **`plans/`** - Development roadmaps

---

## Running the Game

### Browser Mode (Development)

**Option 1: Python (recommended)**
```bash
cd srv
python3 -m http.server 8000
```
Then visit: http://localhost:8000

**Option 2: Node.js**
```bash
npx http-server srv -p 8000
# Or using package.json script:
npm run serve
```

### Headless Mode (Testing/Automation)

**Run simulation for N ticks:**
```bash
node srv/nodemain.js 500
```

**Interactive REPL:**
```bash
node srv/nodemain.js repl
```

**Execute command sequence:**
```bash
node srv/nodemain.js -e "advance 100; list_counts; buy_tower Tower 5 5"
```

**List all available commands:**
```bash
node srv/nodemain.js --commands
```

---

## Game Commands (shared by both modes)

The command vocabulary lives in **`srv/commands.js`** and is environment-agnostic:
it operates only on `globalThis` game state. Both entry points build on it, so a
scenario written for the REPL runs unchanged against the live browser game.

- `advance [ticks=1]` - Advance simulation by N ticks
- `list_counts` - Show game state summary (lives, money, wave, entity counts)
- `show_creep [index=0]` - Show details of a creep
- `show_tower [index=0]` - Show details of a tower
- `buy_tower <type> <cellX> <cellY>` - Purchase and place a tower
- `tower_types` - List tower types and their costs
- `spots [limit=10]` - List buildable cells adjacent to the creep path
- `save_json <filename>` - Save game state
- `load_json <filename>` - Load game state
- `screenshot [name]` - **Browser only.** Capture the live frame as a PNG
- `help`, `?` - Show help
- `exit`, `quit` - Exit REPL (headless only)

Environment-specific behaviour is supplied by a `host` object passed to
`makeCommands(host)`: Node backs `save_json`/`load_json` with real files, the
browser with `localStorage`, and only the browser provides `screenshot`.

---

## Browser Control (browser-bridge integration)

**`srv/gameControl.js`** gives the live page the same commands, plus screenshots
and synthetic input. It is browser-only — `nodemain.js` never loads it.

```bash
# Run a command script against the live page and save any screenshots
tools/sltd-browser.sh --new "buy_tower Tower 3 0; advance 600; screenshot mid" ./shots
```

`--new` calls `startGame()` for a clean run first. Screenshots land in the output
directory as `<name>.png`.

Direct use over browser-bridge:

```bash
wsb run --code 'wslog(await gameControl.run("buy_tower Tower 3 0; advance 300; list_counts"))' --app sltd
```

### gameControl API
- `run(script)` - Execute a `;`-separated command script, returns output text
- `newGame()` - Reset to a fresh game
- `advanceTicks(n)` - Advance N ticks **as rendered frames** (see below)
- `screenshot(name)`, `getShot(i|name)`, `listShots()`, `clearShots()`
- `tapCell(x,y)`, `tapTower(tower)`, `tapCanvas(x,y)` - Synthetic input
- `spots()` - Buildable cells beside the path

### Three things that will bite you

1. **Screenshots must go through `captureScreenshot()`** (`main.js:104`).
   The WebGL context has no `preserveDrawingBuffer`, so the drawing buffer is
   cleared once the browser composites — `outputCanvas.toDataURL()` called any
   later returns a blank image. Capture happens in the same frame as `glowFrame()`.

2. **`advance` queues ticks for the render loop rather than running them inline.**
   Calling `gameMode()` directly would advance logic without drawing those frames,
   so scripted stepping would desync from what a screenshot shows.
   `gameControl.takeTickCredit()` is drained in `main.js`'s `update()`.

3. **Tower selection needs real `MouseEvent`s.** It gates on
   `Input.keyWentDown(133)`, which only the document-level `mousedown` listener
   sets — calling `pressStart()`/`pressEnd()` directly does nothing.
   Coordinates chain: cell → world (`mapToWorld`) → canvas (`+ mapTop`) →
   client (`× globalScaleFactor`, scaled to the element box). `tapCell()` handles this.

**Cache busting:** bump the `?v=` query on the script tags in `index.html` (and the
matching `window.WSB.version`) whenever you edit browser JS, or `wsb reload` will
serve the cached file.

### Tower Types
- `Tower` ($100) - Basic tower, low damage, medium range
- `Stubby` ($300) - Very short range, high damage
- `Zappy` ($350) - Rapid fire, low damage
- `Star` ($1000) - Long range, high damage, slow
- `Thumper` ($500) - Area damage around tower

The authoritative list is `towerInfo` in `entities.js`; `tower_types` prints it.

### State Persistence

**Save state after simulation:**
```bash
node srv/nodemain.js 500 > state1.json
```

**Load state and continue:**
```bash
node srv/nodemain.js state1.json 300 > state2.json
# Or with named output:
node srv/nodemain.js state1.json 300 state2.json
```

**Command sequence with state files:**
```bash
node srv/nodemain.js -e "load_json start.json; buy_tower Tower 5 5; advance 300; save_json end.json"
```

---

## Evaluation Workflow

### Purpose
Run automated test scenarios to validate gameplay mechanics, tower effectiveness, and game balance.

### Directory Structure
```
evaluations/
├── README.md                  # Evaluation documentation
├── example_scenario/
│   ├── initial_state.json     # Starting game state
│   ├── run.sh                 # Evaluation script
│   ├── evaluation.log         # Execution log (generated)
│   └── final_state.json       # End result (generated)
└── [your_scenario]/
    └── ...
```

### Creating an Evaluation

1. **Create scenario directory:**
   ```bash
   mkdir -p evaluations/my_test
   cd evaluations/my_test
   ```

2. **Generate initial state:**
   ```bash
   # From scratch (run 200 ticks to get game started)
   node ../../srv/nodemain.js 200 > initial_state.json

   # Or copy and modify existing
   cp ../example_scenario/initial_state.json .
   ```

3. **Create run script** (`run.sh`):
   ```bash
   #!/bin/bash
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   cd "$SCRIPT_DIR"

   node ../../srv/nodemain.js -e "
     load_json initial_state.json;
     buy_tower Tower 5 5;
     buy_tower Stubby 6 5;
     advance 1000;
     list_counts;
     save_json final_state.json
   " > evaluation.log 2>&1

   echo "Evaluation complete"
   cat final_state.json | jq '{lives, money, wave: .waveCounter}'
   ```

4. **Run evaluation:**
   ```bash
   chmod +x run.sh
   bash run.sh
   ```

### Automated Assertions

Use `jq` to validate results:
```bash
# Check lives threshold
LIVES=$(cat final_state.json | jq -r '.lives')
if [ "$LIVES" -ge 15 ]; then
  echo "PASS: Lives = $LIVES"
else
  echo "FAIL: Lives dropped to $LIVES"
  exit 1
fi

# Compare initial vs final money
INITIAL_MONEY=$(cat initial_state.json | jq -r '.money')
FINAL_MONEY=$(cat final_state.json | jq -r '.money')
echo "Money: $INITIAL_MONEY → $FINAL_MONEY"
```

---

## Code Style & Conventions

### JavaScript Style
- **Naming**: camelCase for variables and functions
- **Structure**: Modular files by functionality
- **Globals**: Game state in global variables (accessible across files)
- **Strict mode**: Be consistent within each file
- **Feature detection**: Use `typeof window !== 'undefined'` for browser-only code

### Key Global Variables
Defined in `showRunner.js`:
- `lives`, `money`, `waveCounter`, `difficulty`
- `creeps`, `towers`, `bullets` - Entity arrays
- `gameMode` - Current game mode function
- `ctx` - Canvas 2D context (browser only)

### File Dependencies
Files must be loaded in this order (see index.html):
1. Extras.js (utilities)
2. littleAStar.js (pathfinding)
3. entities.js (game objects)
4. world.js (map)
5. input.js (browser only)
6. ui.js (browser only)
7. gadgets.js (UI components)
8. showRunner.js (game logic)
9. commands.js (shared command layer)
10. main.js (browser entry) OR nodemain.js (headless entry)
11. gameControl.js (browser only; must follow main.js)

---

## Development Workflows

### Adding New Features

1. **Identify the right file:**
   - New tower type? → `entities.js`
   - New game mechanic? → `showRunner.js`
   - New rendering effect? → `CanvasGlow.js` or rendering files
   - New UI element? → `gadgets.js` or `ui.js`

2. **Test in both modes:**
   - Browser: Visual verification at http://localhost:8000
   - Headless: `node srv/nodemain.js repl` for logic testing

3. **Create evaluation if needed:**
   - For significant gameplay changes, add evaluation scenario
   - Document expected behavior

### Testing Workflow

**Before committing, always verify:**

1. **Browser mode works:**
   ```bash
   cd srv && python3 -m http.server 8000
   # Visit http://localhost:8000
   # Open browser console (F12), check for errors
   # Test tower placement, enemy spawning, wave progression
   # Verify glow effects render correctly
   ```

2. **Headless mode works:**
   ```bash
   node srv/nodemain.js 500
   # Should complete without errors

   node srv/nodemain.js repl
   # Test basic commands: advance, list_counts, buy_tower
   ```

3. **No console errors:**
   - Check browser console (F12)
   - Check Node.js output for errors

4. **Cross-browser (if UI changes):**
   - Test on Chrome AND Firefox minimum
   - Safari if available

### Git Workflow

**Branch naming convention:**
- Feature branches should start with `claude/`
- Use descriptive names: `claude/add-freeze-tower`

**Commit messages:**
- Be concise and descriptive
- Focus on "why" rather than "what"
- Examples:
  - ✅ "Add freeze tower to slow creeps in mid-game"
  - ✅ "Fix tower targeting to prioritize closest creep"
  - ❌ "Update entities.js"
  - ❌ "Changes"

**Before committing:**
- Test in BOTH modes (browser + headless)
- Verify no console errors
- Don't commit secrets

---

## Common Tasks for AI Assistants

### Task: Debug a gameplay issue
1. Read relevant files (entities.js, showRunner.js, world.js)
2. Use headless REPL to isolate the issue:
   ```bash
   node srv/nodemain.js repl
   > advance 100
   > list_counts
   > show_creep 0
   > show_tower 0
   ```
3. Fix the logic in the appropriate file
4. Test in both browser and headless modes

### Task: Add a new tower type
1. Read `entities.js` to understand existing tower structure
2. Add new tower definition following existing patterns
3. Update tower costs/stats in `showRunner.js` if needed
4. Test in browser for visual confirmation
5. Test in headless mode: `node srv/nodemain.js -e "buy_tower NewTower 5 5; advance 200"`

### Task: Optimize performance
1. Review `CanvasGlow.js` for shader optimizations
2. Check `entities.js` for unnecessary calculations in loops
3. Profile in browser (F12 → Performance tab)
4. Test headless mode for logic performance: `node srv/nodemain.js 10000`

### Task: Create a new game mode
1. Read `showRunner.js` to understand existing modes (titleScreen, mainGame, gameOver)
2. Create new mode function following the pattern
3. Set up mode transitions
4. Add draw() function for browser rendering
5. Test mode switching in browser and headless

---

## Key Insights for AI Assistants

### What Makes This Codebase Unique

1. **Dual-mode architecture** - Every change must work in browser AND headless
2. **Global state** - State is managed globally, not in classes/modules
3. **No build step** - Directly runnable JavaScript, no transpilation
4. **Separation of concerns** - Logic (showRunner.js) vs Presentation (main.js)
5. **Feature detection** - Uses `typeof` checks instead of environment variables

### Common Pitfalls to Avoid

❌ **Don't add browser-only code to showRunner.js**
- showRunner.js must remain environment-agnostic
- Use feature detection: `if (typeof ctx !== 'undefined')`

❌ **Don't use npm packages for core functionality**
- This is a zero-dependency project
- Only use npm for dev tools (http-server, eslint, prettier)

❌ **Don't break the file load order**
- Dependencies must load before dependents
- Check index.html for correct order

❌ **Don't assume canvas context exists**
- In headless mode, ctx is undefined
- All draw() functions should be safe to skip

✅ **Do test in both modes**
- Browser visual test + headless logic test

✅ **Do use evaluations for complex changes**
- Automated testing catches regressions

✅ **Do preserve the global state pattern**
- Don't refactor into classes unless explicitly requested

### Understanding the Code

- **Global variables are intentional** - Procedural style, not OOP; shared state via globals
- **Draw functions are optional** - Logic and rendering decoupled; only called in browser mode
- **WebGL is for effects only** - Bloom/glow post-processing; doesn't affect game logic

---

## Recent Improvements

- ✅ Glow shader optimized for 4x performance improvement
- ✅ Enhanced glow quality and configurability
- ✅ Dual-mode architecture (browser + headless)
- ✅ REPL interface for interactive testing
- ✅ State persistence (JSON save/load)
- ✅ Evaluation framework for automated testing
- ✅ Command execution interface (-e flag)
- ✅ globalThis compatibility for universal code

---

## Configuration Files

### Claude Code Integration

**`.claude/settings.json`**
- Configures Claude Code permissions
- Sets up SessionStart hook for environment setup

**`.claude/scripts/session-setup.sh`**
- Runs on session start
- Checks Python3 availability
- Validates game files
- Displays quick start commands

### Package Scripts

```json
{
  "serve": "npx http-server srv -p 8000 -o",  // Start dev server
  "lint": "npx eslint srv/**/*.js",            // Lint code
  "format": "npx prettier --write 'srv/**/*.{js,html,css}'"  // Format code
}
```

---

## Documentation References

- **CLAUDE.md** (this file) - Comprehensive AI assistant guide
- **README.md** - Project summary
- **evaluations/README.md** - Evaluation framework documentation

---

## Quick Reference

### File Locations (Line References)
When referencing code, use format: `filename:line_number`

Example: "Creep spawning logic is in world.js:45"

### Essential Commands

```bash
# Start browser mode
cd srv && python3 -m http.server 8000

# Run headless simulation
node srv/nodemain.js 500

# Interactive testing
node srv/nodemain.js repl

# Show all commands
node srv/nodemain.js --commands

# Execute command sequence
node srv/nodemain.js -e "advance 100; list_counts"

# Save/load state
node srv/nodemain.js 200 > state.json
node srv/nodemain.js state.json 300 final.json

# Run evaluation
cd evaluations/example_scenario && bash run.sh
```

---

## Summary for AI Assistants

**SLTD (Simple Little Tower Defense) - Version 0.91**

Dual-mode tower defense game:
- Vanilla JavaScript (no frameworks, zero dependencies)
- Canvas 2D + WebGL effects
- Browser AND headless execution
- REPL interface + evaluation framework

**Key Principle**: Separation of concerns
- `showRunner.js` - Pure game logic (universal)
- `main.js` - Browser rendering and input
- `nodemain.js` - Headless execution and testing

**Before Every Commit**:
1. Test in browser (visual verification)
2. Test in headless mode (logic verification)
3. Check for console errors
4. Create evaluation for significant changes
5. Write clear commit message

**License**: MIT
