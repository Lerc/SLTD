# SLTD Tower Defence - Improvement Roadmap

## Document Overview
This document outlines planned improvements for the SLTD (Some kind of Tower Defence) game, focusing on code organization, bug fixes, and feature enhancements.

**Status**: Historical proposal, retained for reference
**Version at time of writing**: 0.91
**Written**: 2025-11-21

This document describes the project and proposed work as they stood in 2025.
Its architecture, examples, and task statuses are not a current development
plan. For present gameplay and tooling, start with [DEVELOPMENT.md](../DEVELOPMENT.md);
for the implemented design, see [Simple Little Tower Defence](branching-defenses.md)
and [tower levels](tower-levels.md). The previous main branch is preserved as
`legacy`; active development uses `main`.

---

## Completed Work

### ✅ Critical Bug Fixes (2025-11-21)
1. **world.js:38** - Fixed infinite loop in `findMapStart()` (y→ty variable correction)
2. **ui.js:37** - Fixed typo in fillStyle property (FillStyle→fillStyle)
3. **Assets.js:139** - Fixed canvas height calculation (from.width→from.height)
4. **WebGLBoilerPlate.js:108** - Standardized shader parameter order (vertex first, fragment second)

---

## Code Organization Plan

### Current Architecture Issues

**Problems:**
- All code in global scope (no modules)
- 50+ global variables (money, lives, creeps, towers, etc.)
- No clear separation of concerns
- Hard to test individual components
- Difficult to maintain and extend

**Current Structure:**
```
srv/
├── main.js           # Game loop, initialization, game modes
├── entities.js       # All entity classes (Creep, Tower, Bullet)
├── world.js          # Map generation and pathfinding
├── ui.js             # UI initialization and drawing
├── input.js          # Input handling (mouse, touch, keyboard)
├── gadgets.js        # UI widgets (buttons, panels)
├── Extras.js         # Utility functions (vectors, math)
├── Assets.js         # Asset loading and canvas helpers
├── CanvasGlow.js     # WebGL bloom post-processing
├── WebGLBoilerPlate.js  # WebGL shader utilities
└── images/           # Game sprites
```

### Proposed Code Organization

#### Phase 1: Extract Configuration
**Goal**: Separate data from logic

**New Files:**
```
srv/config/
├── game-config.js       # Game constants and balance
├── tower-definitions.js # Tower stats and costs
├── creep-definitions.js # Creep stats and values
└── wave-definitions.js  # Wave generation parameters
```

**Benefits:**
- Easy balance tweaking without code changes
- Clear separation of game data
- Potential for JSON-based configs later
- Modder-friendly

**Example:**
```javascript
// game-config.js
export const GameConfig = {
  CELL_SIZE: 96,
  STARTING_LIVES: 20,
  STARTING_MONEY: 250,
  WAVE_RELEASE_RATE: 80,
  DIFFICULTY_MULTIPLIER: 1.08,
  ECONOMY_FACTOR: 0.8
};

// tower-definitions.js
export const TowerTypes = {
  BASIC: {
    name: "Basic Tower",
    cost: 100,
    damage: 4,
    range: 250,
    fireRate: 20,
    bulletType: "pea",
    description: "Low Damage, Medium Range"
  },
  // ... more towers
};
```

#### Phase 2: Module System
**Goal**: Convert to ES6 modules with proper encapsulation

**Proposed Structure:**
```
srv/
├── index.html
├── main.js              # Entry point, initialization
├── config/              # Configuration files
├── core/                # Core game systems
│   ├── Game.js          # Main game state manager
│   ├── GameLoop.js      # Update/render loop
│   └── StateManager.js  # Game mode management
├── entities/            # Game entities
│   ├── Entity.js        # Base entity class
│   ├── Creep.js         # Creep base + variants
│   ├── Tower.js         # Tower base + variants
│   └── Bullet.js        # Bullet base + variants
├── systems/             # Game systems
│   ├── WaveManager.js   # Wave generation and spawning
│   ├── EconomySystem.js # Money and difficulty scaling
│   └── PathfindingSystem.js  # Path generation
├── world/               # World and map
│   ├── World.js         # World creation and management
│   └── Map.js           # Map data structure
├── ui/                  # User interface
│   ├── UIManager.js     # UI coordination
│   ├── HUD.js           # Heads-up display
│   ├── TowerMenu.js     # Tower selection/upgrade UI
│   └── widgets/         # Reusable UI components
│       ├── Button.js
│       ├── Panel.js
│       └── Widget.js
├── input/               # Input handling
│   ├── InputManager.js  # Input coordination
│   ├── MouseHandler.js  # Mouse events
│   └── TouchHandler.js  # Touch events
├── rendering/           # Graphics and effects
│   ├── Renderer.js      # Main renderer
│   ├── ParticleSystem.js # Particle effects
│   ├── GlowEffect.js    # Post-processing
│   └── SpriteRenderer.js # Sprite drawing
├── assets/              # Asset management
│   ├── AssetLoader.js   # Loading system
│   └── AssetManager.js  # Asset access
├── utils/               # Utilities
│   ├── Vector.js        # Vector math
│   ├── Math.js          # Math utilities
│   └── Random.js        # RNG functions
└── images/              # Game sprites
```

**Migration Strategy:**
1. Create new directory structure
2. Convert one system at a time (start with utils)
3. Use ES6 modules with proper imports/exports
4. Maintain backward compatibility during transition
5. Update build system if needed

#### Phase 3: State Management
**Goal**: Centralize game state for easier debugging and save/load

**Current State** (scattered globals):
```javascript
var money = 0;
var lives = 20;
var creeps = [];
var towers = [];
var bullets = [];
var waveCounter = 1;
var difficulty = 1;
// ... 40+ more globals
```

**Proposed State** (centralized):
```javascript
class GameState {
  constructor() {
    this.player = {
      money: 250,
      lives: 20
    };
    this.world = {
      map: null,
      entities: {
        creeps: [],
        towers: [],
        bullets: [],
        particles: []
      }
    };
    this.wave = {
      number: 1,
      difficulty: 1,
      hopper: [],
      age: 0
    };
    this.settings = {
      acceleration: 2,
      accelerated: false
    };
  }

  serialize() {
    // For save/load
    return JSON.stringify({
      player: this.player,
      wave: this.wave,
      towers: this.world.entities.towers.map(t => t.serialize())
    });
  }

  deserialize(data) {
    // Restore from save
  }
}
```

**Benefits:**
- Single source of truth
- Easy to save/load entire game state
- Better debugging (inspect one object)
- Cleaner function signatures (no hidden globals)
- Time-travel debugging potential

---

## Feature Improvements

### High Priority Features

#### 1. Tower Upgrade System
**Status**: Planned
**Complexity**: Medium
**Time Estimate**: 4-6 hours

**Description:**
Allow players to upgrade towers through 3 levels, improving damage, range, or fire rate.

**Implementation Plan:**
```javascript
class Tower extends Entity {
  constructor(cellX, cellY) {
    // ... existing code
    this.level = 1;
    this.maxLevel = 3;
  }

  getUpgradeCost() {
    return Math.floor(this.baseCost * Math.pow(1.5, this.level));
  }

  upgrade() {
    if (this.level >= this.maxLevel) return false;

    const cost = this.getUpgradeCost();
    if (money < cost) return false;

    money -= cost;
    this.level++;
    this.applyUpgradeBonus();
    return true;
  }

  applyUpgradeBonus() {
    const multiplier = 1 + (this.level - 1) * 0.3;
    this.damage *= multiplier;
    this.range *= Math.sqrt(multiplier);
    // Visual upgrade (scale, glow, etc.)
  }
}
```

**UI Changes:**
- Click tower to select
- Show upgrade button with cost
- Display current level (★★☆)
- Show stat improvements

#### 2. Tower Selling
**Status**: Planned
**Complexity**: Low
**Time Estimate**: 1-2 hours

**Implementation:**
```javascript
function sellTower(tower) {
  const refund = Math.floor(tower.totalInvestment * 0.7); // 70% refund
  money += refund;
  tower.dead = true;
  selectedTower = null;
}
```

**tower.totalInvestment** = initial cost + all upgrade costs

#### 3. Pause Menu
**Status**: Planned
**Complexity**: Low
**Time Estimate**: 2-3 hours

**Features:**
- Pause/Resume
- Restart wave
- Return to main menu
- Settings access

**Implementation:**
```javascript
function pauseGame() {
  gameMode = pauseMenu;
  // Store previous mode for resume
  pauseMenu.previousMode = mainGame;
}

pauseMenu.draw = function() {
  // Draw previous game state (dimmed)
  this.previousMode.draw();

  // Draw overlay
  ctx.fillStyle = "#0008";
  ctx.fillRect(0, 0, OutputWidth, OutputHeight);

  // Draw menu options
  drawPauseMenuUI();
};
```

#### 4. Tower Menu Implementation
**Status**: Incomplete (function stub exists)
**Complexity**: Medium
**Time Estimate**: 3-4 hours

**Complete the showTowerMenu() function:**
```javascript
function showTowerMenu(tower) {
  const menu = makePanel(300, 800, 480, 600);

  // Tower info
  const infoDisplay = makeTowerInfo(tower);
  menu.contents.push(infoDisplay);

  // Upgrade button
  if (tower.level < tower.maxLevel) {
    const upgradeBtn = makeButton(40, 200, 200, 80);
    upgradeBtn.text = `Upgrade ($${tower.getUpgradeCost()})`;
    upgradeBtn.touched = () => {
      if (tower.upgrade()) {
        closeTowerMenu();
      }
    };
    menu.contents.push(upgradeBtn);
  }

  // Sell button
  const sellBtn = makeButton(260, 200, 180, 80);
  sellBtn.text = `Sell ($${tower.getSellValue()})`;
  sellBtn.touched = () => {
    sellTower(tower);
    closeTowerMenu();
  };
  menu.contents.push(sellBtn);

  widgets.push(menu);
  currentTowerMenu = menu;
}
```

#### 5. Wave Preview
**Status**: Planned
**Complexity**: Low
**Time Estimate**: 1-2 hours

**Add to HUD:**
- Show next wave composition
- Display time until wave
- Show wave difficulty multiplier

#### 6. Better Visual Feedback
**Status**: Planned
**Complexity**: Medium
**Time Estimate**: 3-4 hours

**Features:**
- Floating damage numbers
- Money gain popups (+$5)
- Tower fire animation improvements
- Death animations for creeps
- Highlight affordable towers in green

**Example Damage Numbers:**
```javascript
class FloatingText extends Entity {
  constructor(text, position, color = "#f00") {
    super(position.x, position.y);
    this.text = text;
    this.color = color;
    this.age = 0;
    this.maxAge = 60;
  }

  move() {
    this.age++;
    this.y -= 1;
    if (this.age > this.maxAge) this.dead = true;
  }

  draw() {
    const alpha = 1 - (this.age / this.maxAge);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

// In bullet hit:
floatingTexts.push(new FloatingText(
  `-${this.damage}`,
  this.target.position,
  "#faa"
));
```

### Medium Priority Features

#### 7. Save/Load System
**Status**: Planned
**Complexity**: Medium
**Time Estimate**: 4-5 hours

**Features:**
- Auto-save every wave
- Manual save/load from menu
- Multiple save slots
- Save metadata (wave, date, playtime)

**Storage:**
```javascript
class SaveSystem {
  save(slot = 'auto') {
    const saveData = {
      version: versionString,
      timestamp: Date.now(),
      state: gameState.serialize()
    };
    localStorage.setItem(`sltd_save_${slot}`, JSON.stringify(saveData));
  }

  load(slot = 'auto') {
    const data = localStorage.getItem(`sltd_save_${slot}`);
    if (!data) return false;

    const saveData = JSON.parse(data);
    if (saveData.version !== versionString) {
      // Handle version migration
    }

    gameState.deserialize(saveData.state);
    return true;
  }

  listSaves() {
    const saves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('sltd_save_')) {
        saves.push(JSON.parse(localStorage.getItem(key)));
      }
    }
    return saves;
  }
}
```

#### 8. Difficulty Selection
**Status**: Planned
**Complexity**: Low
**Time Estimate**: 2-3 hours

**Difficulty Modes:**
```javascript
const DifficultySettings = {
  EASY: {
    startingMoney: 500,
    startingLives: 30,
    economyFactor: 1.0,
    difficultyScale: 1.05
  },
  NORMAL: {
    startingMoney: 250,
    startingLives: 20,
    economyFactor: 0.8,
    difficultyScale: 1.08
  },
  HARD: {
    startingMoney: 150,
    startingLives: 10,
    economyFactor: 0.6,
    difficultyScale: 1.12
  }
};
```

#### 9. Statistics Tracking
**Status**: Planned
**Complexity**: Low
**Time Estimate**: 2-3 hours

**Track:**
- Total damage dealt
- Creeps killed (by type)
- Money earned
- Towers built
- Highest wave reached
- Total playtime

**Display on game over screen**

#### 10. Hotkeys
**Status**: Planned
**Complexity**: Low
**Time Estimate**: 1-2 hours

**Bindings:**
- `1-5`: Select tower types
- `Space`: Pause
- `Esc`: Cancel tower placement
- `S`: Sell selected tower
- `U`: Upgrade selected tower

#### 11. Sound Effects
**Status**: Infrastructure exists, needs implementation
**Complexity**: Low
**Time Estimate**: 2-3 hours

**Sounds needed:**
- Tower firing (different per type)
- Creep death
- Money gain
- Tower placement
- Upgrade/sell confirmation
- Wave start/complete
- Damage taken

**Implementation:**
```javascript
// Assets.js already has playSound() function
const soundList = [
  "tower_fire.ogg",
  "creep_death.ogg",
  "coin.ogg",
  "build.ogg",
  "upgrade.ogg",
  // etc.
];

// In entities.js
fire() {
  bullets.push(new this.bulletKind(this, this.target));
  playSound(Assets.tower_fire);
  this.cooldown = 1000 / this.rate;
}
```

### Lower Priority Features

#### 12. New Tower Types
**Status**: Concept phase
**Complexity**: Medium per tower
**Time Estimate**: 2-3 hours per tower

**Ideas:**
- **Slow Tower**: Reduces creep speed in range
- **Poison Tower**: Damage over time
- **Chain Lightning**: Hits multiple targets
- **Sniper Tower**: Very long range, slow fire
- **Mine Layer**: Places mines on path

#### 13. New Creep Types
**Status**: Concept phase
**Complexity**: Low per creep
**Time Estimate**: 1-2 hours per creep

**Ideas:**
- **Armored**: High HP, slow
- **Healer**: Heals nearby creeps
- **Splitter**: Divides on death
- **Boss**: Massive HP, special abilities
- **Invisible**: Only certain towers can target

#### 14. Multiple Maps
**Status**: Planned
**Complexity**: Medium
**Time Estimate**: 3-4 hours (system) + 1 hour per map

**System:**
```javascript
const MapLibrary = {
  classic: [
    '##.########',
    '##.########',
    // ... current map
  ],

  spiral: [
    '##########',
    '.........#',
    '#######.##',
    // ... new map
  ],

  // More maps
};

function selectMap(mapName) {
  window.levelMap = createWorld(MapLibrary[mapName]);
}
```

#### 15. Special Abilities
**Status**: Concept phase
**Complexity**: High
**Time Estimate**: 6-8 hours

**Per-tower active abilities with cooldowns:**
- **Artillery Strike**: Manual target for AOE damage
- **Overclock**: Temporarily double fire rate
- **Freeze Ray**: Freeze creeps in area
- **Shield**: Prevent damage to lives

#### 16. Achievement System
**Status**: Concept phase
**Complexity**: Medium
**Time Estimate**: 4-5 hours

**Examples:**
- "First Blood": Kill first creep
- "Tower Lord": Build 50 towers in one game
- "Survivor": Reach wave 50
- "Perfectionist": Complete wave without damage
- "Rich": Have $5000 at once

---

## Code Quality Improvements

### Immediate Improvements

#### 1. Add Error Handling
**Priority**: High
**Effort**: Low

**Add try-catch to game loop:**
```javascript
function update() {
  requestAnimationFrame(update);
  if (!running) return;

  try {
    // ... game loop code
  } catch(e) {
    console.error("Game error:", e);
    running = false;
    showErrorScreen(e);
  }
}

function showErrorScreen(error) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, OutputWidth, OutputHeight);
  ctx.fillStyle = "#f00";
  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Game Error", OutputWidth/2, 100);
  ctx.font = "20px monospace";
  ctx.fillText(error.message, OutputWidth/2, 150);
  ctx.fillText("Check console for details", OutputWidth/2, 200);
}
```

#### 2. Extract Magic Numbers
**Priority**: Medium
**Effort**: Low

**Create constants file:**
```javascript
// constants.js
export const GameConstants = {
  // Timing
  TICK_DURATION: 16,
  MAX_TICKS_PER_FRAME: 10,

  // Spawning
  WAVE_RELEASE_RATE: 80,
  BACKLOG_RELEASE_RATE: 15,

  // Scaling
  DIFFICULTY_MULTIPLIER: 1.08,
  ECONOMY_FACTOR: 0.8,

  // Rendering
  MAP_TOP_OFFSET: 106,
  GLOBAL_SCALE: 0.5,

  // Particles
  PARTICLE_MAX_AGE: 30,
  PARTICLE_FADE_START: 0.05,
};
```

#### 3. Add JSDoc Comments
**Priority**: Medium
**Effort**: Medium

**Example:**
```javascript
/**
 * Creates a new tower at the specified cell position
 * @param {Object} info - Tower configuration from towerInfo array
 * @param {number} cellX - Map cell X coordinate
 * @param {number} cellY - Map cell Y coordinate
 * @returns {boolean} True if tower was purchased, false if insufficient funds
 */
function buyTower(info, cellX, cellY) {
  if (money >= info.cost) {
    money -= info.cost;
    towers.push(new info.type(cellX, cellY));
    return true;
  }
  return false;
}
```

#### 4. Consistent Naming Conventions
**Priority**: Low
**Effort**: Low

**Standards:**
- Classes: PascalCase (Tower, Creep, BasicCreep)
- Functions: camelCase (buyTower, findTarget)
- Constants: UPPER_SNAKE_CASE (CELL_SIZE, MAX_LEVEL)
- Private methods: _prefixed (_internalMethod)

#### 5. Add Unit Tests
**Priority**: Medium
**Effort**: High

**Test Framework Setup:**
```javascript
// tests/vector.test.js
import { v2, vadd, vdiff, vlength } from '../src/utils/Vector.js';

describe('Vector Math', () => {
  test('v2 creates vector', () => {
    const v = v2(3, 4);
    expect(v).toEqual({ x: 3, y: 4 });
  });

  test('vadd adds vectors', () => {
    expect(vadd(v2(1, 2), v2(3, 4))).toEqual(v2(4, 6));
  });

  test('vlength calculates magnitude', () => {
    expect(vlength(v2(3, 4))).toBe(5);
  });
});
```

---

## Performance Optimizations

### Potential Improvements

#### 1. Object Pooling
**Goal**: Reduce garbage collection pauses

**Implementation:**
```javascript
class BulletPool {
  constructor(size = 100) {
    this.pool = [];
    this.active = [];

    for (let i = 0; i < size; i++) {
      this.pool.push(new Pea(null, null));
    }
  }

  acquire(source, target) {
    let bullet = this.pool.pop() || new Pea(null, null);
    bullet.reset(source, target);
    this.active.push(bullet);
    return bullet;
  }

  release(bullet) {
    const index = this.active.indexOf(bullet);
    if (index >= 0) {
      this.active.splice(index, 1);
      this.pool.push(bullet);
    }
  }
}
```

#### 2. Spatial Partitioning
**Goal**: Faster collision/targeting

**Grid-based lookup:**
```javascript
class SpatialGrid {
  constructor(cellSize = 200) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  insert(entity) {
    const key = this.getKey(entity.position);
    if (!this.grid.has(key)) this.grid.set(key, []);
    this.grid.get(key).push(entity);
  }

  getNearby(position, radius) {
    const cells = this.getCellsInRadius(position, radius);
    return cells.flatMap(key => this.grid.get(key) || []);
  }
}
```

#### 3. Render Optimization
**Goal**: Reduce draw calls

**Batching:**
- Sprite batching for creeps
- Canvas layer caching for map
- Dirty rectangle rendering

---

## Browser Compatibility

### Current Issues
- WebGL 2.0 required (not all mobile browsers)
- Fullscreen API varies by browser
- Touch events need better handling

### Improvements
1. Add WebGL 1.0 fallback
2. Graceful degradation without glow effects
3. Better mobile performance profiling

---

## Testing Strategy

### Manual Testing Checklist
- [ ] All tower types fire correctly
- [ ] All creep types pathfind properly
- [ ] Money calculation accurate
- [ ] Lives decrease on creep escape
- [ ] Wave progression works
- [ ] UI responsive to clicks/touches
- [ ] Game over state handled
- [ ] Restart functionality works
- [ ] Fullscreen mode functional
- [ ] Mobile touch controls work

### Automated Testing
- Unit tests for utility functions
- Integration tests for systems
- Visual regression tests for UI

---

## Migration Path

### Recommended Implementation Order

**Week 1: Foundation**
1. Extract configuration files
2. Add error handling
3. Create constants file
4. Add JSDoc to core functions

**Week 2: Core Features**
5. Implement tower upgrades
6. Implement tower selling
7. Complete tower menu UI
8. Add pause menu

**Week 3: Polish**
9. Add damage numbers
10. Implement sound effects
11. Add wave preview
12. Improve visual feedback

**Week 4: Advanced**
13. Save/load system
14. Statistics tracking
15. Achievement system (basic)

**Week 5: Refactoring**
16. Begin module conversion
17. Implement state management
18. Add unit tests
19. Performance profiling

---

## Notes and Considerations

### Breaking Changes
- Module conversion will require build step or type="module"
- Save format may change with state refactor
- Config extraction might break mods/hacks

### Backward Compatibility
- Keep old global API during transition
- Provide migration guide
- Version save files

### Performance Targets
- 60 FPS with 100 entities
- <100ms load time
- <50MB memory usage

### Mobile Considerations
- Touch targets at least 44x44px
- Virtual joystick for camera?
- Reduce particle count on mobile
- Lower resolution textures option

---

## Open Questions

1. Should we use a build system (webpack/rollup)?
2. TypeScript conversion worth the effort?
3. Framework adoption (Phaser, PixiJS)?
4. Multiplayer potential?
5. Monetization strategy (if any)?

---

## Resources Needed

### Assets
- Sound effects (11 sounds minimum)
- Additional sprite sheets for new towers/creeps
- UI icons for upgrades/abilities
- Background music (optional)

### Tools
- Build system setup
- Testing framework (Jest/Vitest)
- Linting (ESLint)
- Asset pipeline for optimization

---

## Conclusion

This roadmap provides a clear path from the current codebase to a well-organized, feature-rich tower defence game. The modular approach allows incremental improvements without major disruption.

**Priority focus:**
1. Fix remaining bugs as they're discovered
2. Implement core missing features (upgrades, selling, pause)
3. Improve code organization for long-term maintainability
4. Add polish and juice (sounds, effects, feedback)
5. Consider advanced features (achievements, multiple maps)

The goal is to create a solid, extensible foundation while maintaining the fun, engaging gameplay that already exists.
