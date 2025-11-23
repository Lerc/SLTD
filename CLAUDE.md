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

### Key Architectural Decision
**No rendering stubs needed!** The headless mode simply doesn't call `gameMode.draw()`, so all Canvas 2D rendering code is never executed. This is cleaner than creating elaborate no-op stubs.

---

## Browser API Dependencies Analysis

Understanding which files use browser-specific APIs is crucial for maintaining dual-mode compatibility.

### Pure Logic Files (Node.js Compatible)
These files contain no browser-specific APIs and can run in Node.js:

- **littleAStar.js** - A* pathfinding algorithm using PriorityQueue (completely universal)
- **Extras.js** - Math utilities (uses `globalThis.performance?.now()` with fallback to `Date.now()`)

### Browser-Dependent Files

#### Heavy Browser Dependencies
**main.js** - Browser initialization and rendering loop
- `window.onload`, `document.querySelector`, `document.createElement`
- `requestAnimationFrame` - Game loop
- `performance.now()` - Timing
- Canvas event listeners (mousemove, mousedown, mouseup)
- CanvasRenderingContext2D

**input.js** - Input handling system
- `document.addEventListener` for keyboard/mouse/touch events
- Mouse/touch event objects (pageX, pageY, clientX, clientY)

**Assets.js** - Asset loading
- `Image` object, `XMLHttpRequest`, `AudioContext`
- `document.createElement` for canvas creation

**CanvasGlow.js** - WebGL2 post-processing effects
**WebGLBoilerPlate.js** - WebGL utilities
**renderlist.js** - WebGL rendering system

#### Moderate Browser Dependencies (Rendering Layer)
**gadgets.js**, **ui.js**, **world.js**, **entities.js** - Use `ctx` (CanvasRenderingContext2D) for drawing, but draw functions are optional and only called in browser mode

### Critical Browser APIs Summary
1. **Canvas 2D Context** - main.js, entities.js, world.js, gadgets.js, ui.js, Assets.js
2. **WebGL Context** - CanvasGlow.js, WebGLBoilerPlate.js, renderlist.js
3. **DOM Events** - main.js, input.js
4. **RequestAnimationFrame** - main.js (game loop)
5. **Image/Audio Loading** - Assets.js
6. **Performance API** - main.js, Extras.js (with fallback)

### Implementation Notes

**Key Design Decision**: The headless mode uses minimal browser API stubs in `nodemain.js` and simply **doesn't call `gameMode.draw()`**. This means all Canvas 2D rendering code is never executed - much cleaner than creating elaborate no-op stubs for every Canvas API.

**Compatibility Strategy**:
- `showRunner.js` uses feature detection (`typeof` checks) for browser-only APIs
- Draw functions are attached as properties and are optional
- Falls back gracefully when APIs are undefined
- No hard dependencies on DOM/Canvas in logic functions

### Headless Mode Implementation Approach

The dual-mode architecture was achieved through refactoring, not rewriting:

1. **Logic Extraction**: Game logic was extracted from `main.js` into `showRunner.js`
2. **Minimal Stubs**: `nodemain.js` provides minimal browser API stubs (window, document, Assets)
3. **No Rendering**: The headless update loop simply doesn't call `gameMode.draw()`
4. **API Layer**: Clean programmatic API for controlling game state
5. **REPL Interface**: Interactive command-line interface for testing
6. **State Persistence**: JSON serialization for save/load functionality

**Files Created/Modified**:
- ✅ `srv/showRunner.js` (NEW) - Pure game logic extracted from main.js
- ✅ `srv/main.js` (REFACTORED) - Browser-only rendering and initialization
- ✅ `srv/nodemain.js` (NEW) - Node.js entry point with REPL and API
- ✅ `srv/index.html` (UPDATED) - Added showRunner.js script tag

This approach avoided major refactoring while achieving full dual-mode support.

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
- **`CLAUDE.md`** - This file - AI assistant instructions
- **`Claude.md`** - Detailed headless mode documentation and architecture analysis
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

## Headless Mode Commands

### Available REPL Commands
- `advance [ticks=1]` - Advance simulation by N ticks
- `show_creep [index=0]` - Show details of a creep
- `show_tower [index=0]` - Show details of a tower
- `save_json <filename>` - Save game state to JSON file
- `load_json <filename>` - Load game state from JSON file
- `buy_tower <type> <cellX> <cellY>` - Purchase and place a tower
- `list_counts` - Show game state summary (lives, money, wave, entity counts)
- `help`, `?` - Show help
- `exit`, `quit` - Exit REPL

### Tower Types
- `Tower` - Basic tower
- `Stubby` - Short range, high fire rate
- `Star` - Multi-target
- `Boom` - Area damage
- `BigBoom` - Large area damage

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
- **Naming**: Use camelCase for variables and functions
- **Structure**: Modular files organized by functionality
- **Globals**: Game state stored in global variables (accessible across files)
- **No strict mode inconsistency**: Some files use `"use strict"`, others don't - be consistent within each file
- **Feature detection**: Use `typeof window !== 'undefined'` for browser-only code

### Global State Variables (in showRunner.js)
Key globals you'll work with:
- `lives` - Player lives remaining
- `money` - Current money
- `waveCounter` - Current wave number
- `difficulty` - Game difficulty multiplier
- `creeps` - Array of active enemies
- `towers` - Array of placed towers
- `bullets` - Array of active projectiles
- `gameMode` - Current game mode function (mainGame, titleScreen, etc.)
- `ctx` - Canvas 2D rendering context (browser only)

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
9. main.js (browser entry) OR nodemain.js (headless entry)

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
- Test game runs without errors in BOTH modes
- Verify no console errors
- Don't commit secrets (.env files, credentials, API keys)

**Current development branch:** `claude/claude-md-mibotq2cpuhvjhh9-01DXDtWCpoEqhK2PBxf3gX9R`

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

**Global variables are intentional**
- This uses a procedural style, not OOP
- State is shared across files via globals
- showRunner.js is the source of truth for game state

**Draw functions are optional**
- All draw() functions check for ctx existence
- Logic and rendering are decoupled
- gameMode.draw() is only called in browser mode

**WebGL is for effects only**
- Game logic uses Canvas 2D
- WebGL provides bloom/glow post-processing
- Can be disabled without breaking gameplay

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

- **CLAUDE.md** (this file) - AI assistant instructions and project overview
- **Claude.md** - Detailed headless mode architecture and browser API analysis
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

## Version Information

- **Game Version**: 0.91
- **License**: MIT
- **Repository**: SLTD (Simple Little Tower Defense)

---

## Summary for AI Assistants

This is a **dual-mode tower defense game** with:
- Vanilla JavaScript (no frameworks)
- Canvas 2D rendering + WebGL effects
- Zero build process
- Global state management
- Browser AND headless execution
- REPL interface for testing
- Evaluation framework for automation

**Key principle**: Keep logic and presentation separate. showRunner.js contains pure game logic that works everywhere. main.js handles browser-specific rendering and input. nodemain.js provides headless execution and testing.

When making changes:
1. ✅ Test in browser (visual)
2. ✅ Test in headless (logic)
3. ✅ Check console for errors
4. ✅ Create evaluation if needed
5. ✅ Commit with clear message

**Current branch**: `claude/claude-md-mibotq2cpuhvjhh9-01DXDtWCpoEqhK2PBxf3gX9R`
