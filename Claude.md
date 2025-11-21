# SLTD - Tower Defense Game - Headless Analysis

## Project Overview
This is a mobile-oriented tower defense game built with vanilla JavaScript, Canvas 2D, and WebGL for visual effects (glow/bloom).

## File Structure & Browser Dependencies

### Pure Logic Files (Node.js Compatible)
These files contain no browser-specific APIs and can run in Node.js:

- **littleAStar.js** - A* pathfinding algorithm using PriorityQueue
- **Extras.js** (mostly) - Math utilities (vector operations, random, etc.)
  - ⚠️ Contains one browser call: `performance.now()` in `pTime()` function

### Browser-Dependent Files

#### Heavy Browser Dependencies (Complete Rewrite Needed for Headless)

**main.js** - Game initialization and main loop
- `window.onload` - Entry point (line 4)
- `document.querySelector` - DOM manipulation (lines 37, 39)
- `document.createElement` - Canvas creation (line 43)
- `requestAnimationFrame` - Game loop (lines 52, 176)
- `performance.now()` - Timing (lines 173, 179, 182)
- `document.fullscreenElement` - Fullscreen detection (line 517)
- Canvas event listeners: mousemove, mousedown, mouseup (lines 54-56)
- CanvasRenderingContext2D - All drawing operations

**input.js** - Input handling system
- `document.addEventListener` - Keyboard/mouse events (lines 12-16)
- Touch events: touchstart, touchend, touchcancel, touchmove (lines 59-62)
- `document.querySelector` - Element selection (line 57)
- `document.fullscreenElement` - Fullscreen check (line 71)
- Mouse/touch event objects (pageX, pageY, clientX, clientY, etc.)

**Assets.js** - Asset loading
- `Image` object - Image loading (line 33)
- `XMLHttpRequest` - Sound loading (line 87)
- `AudioContext` - Audio system (line 28)
- `document.createElement` - Canvas creation (lines 124, 136, 147)
- Image.onload callbacks (line 34)

**CanvasGlow.js** - Post-processing effects
- WebGL2 context initialization (line 172)
- All WebGL APIs: textures, framebuffers, shaders (throughout)
- Shader compilation and execution

**WebGLBoilerPlate.js** - WebGL utilities
- `canvas.getContext("webgl2")` (line 7)
- All WebGL helper functions
- `alert()` for error messages (lines 12, 29, 55, 119)

#### Moderate Browser Dependencies (Rendering Layer)

**gadgets.js** - UI components
- CanvasRenderingContext2D for drawing (lines 56, 85, 138)
- Uses global `ctx` variable

**ui.js** - UI management
- CanvasRenderingContext2D for drawing (throughout)
- Path2D for SVG paths (line 51)

**world.js** - Game world rendering
- CanvasRenderingContext2D for map drawing (lines 72-89)

**entities.js** - Game entities (creeps, towers, bullets)
- CanvasRenderingContext2D for entity drawing (throughout)
- Uses global `ctx` variable

**renderlist.js** - WebGL rendering system
- WebGL rendering context usage (throughout)
- Direct WebGL API calls

## Browser API Usage Summary

### Critical Browser APIs
1. **Canvas 2D Context** - Used in: main.js, entities.js, world.js, gadgets.js, ui.js, Assets.js
2. **WebGL Context** - Used in: CanvasGlow.js, WebGLBoilerPlate.js, renderlist.js
3. **DOM Events** - Used in: main.js, input.js
4. **RequestAnimationFrame** - Used in: main.js (game loop)
5. **Image/Audio Loading** - Used in: Assets.js
6. **Performance API** - Used in: main.js, Extras.js

### Global Dependencies
- `window` - Used for global state storage
- `document` - Used for DOM manipulation and event handling
- `ctx` - Global canvas context used across multiple files
- `canvas` - Global canvas element

## Architecture for Headless Version

### Approach: Dual-Mode Architecture

Create an abstraction layer that allows the game to run in two modes:
1. **Browser Mode** - Full rendering with Canvas/WebGL
2. **Headless Mode** - Logic only, no rendering

### Required Abstractions

#### 1. Rendering Abstraction
```javascript
// NoopRenderer - Does nothing
class NoopRenderer {
  clear() {}
  fillRect() {}
  drawSprite() {}
  // ... all other canvas methods
}

// In headless mode, replace ctx with NoopRenderer
```

#### 2. Time/Loop Abstraction
```javascript
// Headless: Use setInterval or manual tick() calls
// Browser: Use requestAnimationFrame
```

#### 3. Input Abstraction
```javascript
// Headless: Programmatic API for controlling game
// Browser: Mouse/touch/keyboard events
```

#### 4. Asset Loading Abstraction
```javascript
// Headless: Skip or use mock assets
// Browser: Load images/sounds normally
```

### Implementation Strategy

#### Phase 1: Create Abstraction Layer
1. Create `nodemain.js` - Headless entry point
2. Create `renderer.js` - Rendering abstraction
3. Create `timing.js` - Time/loop abstraction
4. Create `input-api.js` - Programmatic input API

#### Phase 2: Refactor Core Files
1. **Extras.js** - Replace `performance.now()` with abstracted timer
2. **main.js** - Split into:
   - `game-core.js` - Pure game logic
   - `game-browser.js` - Browser-specific initialization
3. **entities.js, world.js, gadgets.js, ui.js** - Make draw() methods optional

#### Phase 3: Create Headless Mode
1. Implement mock renderer (all methods are no-ops)
2. Implement tick-based game loop
3. Create API for:
   - Starting waves
   - Placing towers
   - Querying game state
   - Running simulation steps

### Files to Create for Headless

```
srv/
├── nodemain.js          # Node.js entry point
├── core/
│   ├── game-core.js     # Refactored game logic (from main.js)
│   ├── renderer.js      # Rendering abstraction
│   ├── timing.js        # Time abstraction
│   └── input-api.js     # Programmatic input API
├── adapters/
│   ├── noop-renderer.js # Headless renderer (no-op)
│   └── canvas-renderer.js # Browser renderer wrapper
└── utils/
    └── node-compat.js   # Node.js compatibility shims
```

### Minimal Changes Approach

For a quicker headless version without major refactoring:

1. **Stub out all rendering** - Replace canvas contexts with no-op objects
2. **Replace requestAnimationFrame** - Use setInterval or manual step function
3. **Mock Assets** - Create empty objects for images/sounds
4. **Remove input system** - Replace with API calls
5. **Replace performance.now()** - Use Date.now() or process.hrtime()

### API Design for Headless Mode

```javascript
const game = require('./nodemain.js');

// Initialize game
game.init();

// Place a tower
game.placeTower(type, cellX, cellY);

// Start a wave
game.startWave();

// Run simulation for N ticks
game.tick(100);

// Get game state
const state = game.getState();
// Returns: { lives, money, wave, creeps: [...], towers: [...] }

// Query specific entities
const creeps = game.getCreeps();
const towers = game.getTowers();
```

## Recommendations

### For Quick Prototype
1. Create `nodemain.js` that:
   - Stubs out all browser globals (window, document, canvas, ctx)
   - Replaces requestAnimationFrame with setInterval
   - Provides a simple API to control the game
2. Minimal changes to existing code

### For Production Headless Version
1. Full refactoring with proper abstraction layers
2. Separate concerns: logic vs. presentation
3. Shared game core that works in both environments
4. TypeScript migration for better type safety

## Next Steps

1. ✅ Complete this analysis
2. ✅ Decide on approach (quick prototype vs. full refactor)
3. ✅ Create `nodemain.js` skeleton
4. ✅ Implement browser API stubs
5. ⬜ Test basic game loop in Node.js
6. ✅ Implement game state API
7. ⬜ Add unit tests for core logic

---

## Implementation (Completed)

### Files Created/Modified

**✅ srv/showRunner.js** (NEW)
- Contains all game logic extracted from main.js
- Pure game state and logic functions
- Game mode functions (mainGame, titleScreen, gameOver, etc.)
- Draw functions (attached as properties, won't be called in headless mode)
- Works in both browser and Node.js environments
- Uses feature detection for browser-only APIs (typeof checks)

**✅ srv/main.js** (REFACTORED)
- Now contains ONLY browser-specific code
- window.onload initialization
- Canvas/WebGL setup
- Event handlers (mouse/touch)
- requestAnimationFrame loop
- Calls game logic from showRunner.js
- Calls draw functions when available

**✅ srv/nodemain.js** (NEW)
- Node.js entry point for headless mode
- Minimal browser API stubs (window, document, Assets, Input, UI)
- Date.now() instead of performance.now()
- No rendering - gameMode.draw() is NOT called
- Exports clean API for external control
- Built-in demo mode when run directly

**✅ srv/index.html** (UPDATED)
- Added `<script src="showRunner.js"></script>` before main.js
- Loads game logic before browser initialization

### Architecture

```
Browser Mode:
index.html → Extras.js → entities.js → world.js → input.js → ui.js →
             showRunner.js (game logic) → main.js (browser init + rendering)

Headless Mode:
nodemain.js → Extras.js → entities.js → world.js →
              showRunner.js (game logic only, no rendering)
```

### Key Design Decision

**No ctx stub needed!** The update() function in nodemain.js simply doesn't call `gameMode.draw()`, so all Canvas 2D rendering code is never executed. This is cleaner than creating elaborate no-op stubs.

### Headless API

```javascript
const game = require('./srv/nodemain.js');

// Run simulation
game.tick(100);  // Run 100 game ticks

// Place towers
game.placeTower('Tower', 5, 5);
game.placeTower('Stubby', 6, 5);

// Get game state
const state = game.getState();
// Returns: { lives, money, wave, creeps: [...], towers: [...] }

// Run automated simulation
const result = game.run(1000, 100); // 1000 ticks, log every 100

// Reset game
game.reset();
```

### Testing

To test headless mode:
```bash
cd srv
node nodemain.js
```

To use as a module:
```javascript
const game = require('./srv/nodemain.js');
console.log(game.getState());
```

### Compatibility Notes

- **showRunner.js** uses feature detection for browser-only APIs
- Falls back gracefully when APIs are undefined
- No hard dependencies on DOM/Canvas in logic functions
- Draw functions are optional and only called when ctx exists
