#!/usr/bin/env node
"use strict"

// Node.js headless entry point for SLTD tower defense game

// Minimal browser API stubs
globalThis.window = global;
globalThis.document = {
  fullscreenElement: null,
  querySelector: () => null,
  createElement: () => null,
  addEventListener: () => {}
};

// Load dependencies in order
require('./Extras.js');
require('./littleAStar.js');
require('./entities.js');
require('./world.js');
require('./gadgets.js');
require('./showRunner.js');

// Stub out browser-only globals
globalThis.Assets = {
  TowerIcons: null,
  Creep1: null,
  Creep2: null,
  Creep3: null,
  Creep4: null,
  Tower1: null,
  Tower2: null,
  Tower3: null,
  Tower4: null,
  Tower5: null,
  Gun1: null,
  Gun2: null,
  Gun3: null,
  Gun5: null
};

globalThis.assetsPending = [];

// Stub out particle system (no-op in headless mode)
globalThis.particleSystem = function(count, state, makeParticle) {
  return {
    move: () => {},
    draw: () => {},
    isActive: () => false
  };
};

// Stub out Input system
globalThis.Input = {
  isKeyDown: () => false,
  keyWentDown: () => false,
  flushKeysDown: () => {}
};

// Stub out UI functions
globalThis.initUI = () => {};
globalThis.updateUI = () => {};
globalThis.drawUI = () => {};
globalThis.pressStartUI = () => {};
globalThis.pressMoveUI = () => {};
globalThis.pressEndUI = () => {};
globalThis.showTowerMenu = () => {};

// No-op canvas context (won't be used since we don't call draw)
globalThis.ctx = null;

// Timing
let lastTime = Date.now();

function init() {
  console.log("Initializing headless SLTD game...");

  // Skip asset loading in headless mode
  globalThis.assetsPending = [];

  // Start game directly (sets gameMode = mainGame)
  globalThis.startGame();

  console.log("Game initialized. Ready to run.");
}

function update() {
  if (!globalThis.running) return;

  let thisTime = Date.now();
  let diff = thisTime - lastTime;
  let ticks = Math.round(diff / 16);
  lastTime = thisTime;
  if (ticks > 10) ticks = 10;
  globalThis.ticker += ticks;

  for (let i = 0; i < ticks; i++) {
    globalThis.gameMode();
    globalThis.Input.flushKeysDown();
  }

  // Note: We do NOT call gameMode.draw()
  // This is the key difference from browser mode
}

// API for external control
function tick(count = 1) {
  // In headless mode, directly execute game ticks instead of relying on time-based update()
  for (let i = 0; i < count; i++) {
    globalThis.ticker += 1;
    globalThis.gameMode();
    globalThis.Input.flushKeysDown();
  }
}

function run(ticks = 1000, logInterval = 100) {
  console.log(`Running simulation for ${ticks} ticks...`);

  for (let i = 0; i < ticks; i++) {
    tick(1);

    if ((i + 1) % logInterval === 0) {
      console.log(`Tick ${i + 1}/${ticks} - Lives: ${globalThis.lives}, Money: ${globalThis.money}, Wave: ${globalThis.waveCounter}, Creeps: ${globalThis.creeps.length}, Towers: ${globalThis.towers.length}, WaveAge: ${globalThis.waveAge}`);
    }
  }

  return getState();
}

function getState() {
  return {
    lives: globalThis.lives,
    money: globalThis.money,
    wave: globalThis.waveCounter,
    difficulty: globalThis.difficulty,
    creeps: globalThis.creeps.map(c => ({
      x: Math.round(c.x),
      y: Math.round(c.y),
      hp: Math.round(c.hitPoints - c.damage),
      maxHp: Math.round(c.hitPoints),
      type: c.constructor.name
    })),
    towers: globalThis.towers.map(t => ({
      cellX: t.cellPosition.x,
      cellY: t.cellPosition.y,
      type: t.constructor.name,
      target: t.target ? t.target.constructor.name : null
    })),
    bullets: globalThis.bullets.length,
    hopper: globalThis.hopper.length
  };
}

function saveState() {
  // Determine current game mode
  let gameModeName = 'unknown';
  if (globalThis.gameMode === globalThis.mainGame) gameModeName = 'mainGame';
  else if (globalThis.gameMode === globalThis.titleScreen) gameModeName = 'titleScreen';
  else if (globalThis.gameMode === globalThis.waitForContent) gameModeName = 'waitForContent';
  else if (globalThis.gameMode === globalThis.waitForFullScreen) gameModeName = 'waitForFullScreen';
  else if (globalThis.gameMode === globalThis.gameOver) gameModeName = 'gameOver';

  return {
    version: globalThis.versionString,
    timestamp: new Date().toISOString(),

    // Basic game state
    lives: globalThis.lives,
    money: globalThis.money,
    waveCounter: globalThis.waveCounter,
    difficulty: globalThis.difficulty,
    ticker: globalThis.ticker,
    waveAge: globalThis.waveAge,
    releaseRate: globalThis.releaseRate,
    gameAcceleration: globalThis.gameAcceleration,
    gameAccelerated: globalThis.gameAccelerated,
    gameMode: gameModeName,
    taps: globalThis.taps,

    // Creeps
    creeps: globalThis.creeps.map(c => ({
      type: c.constructor.name,
      x: c.x,
      y: c.y,
      angle: c.angle,
      damage: c.damage,
      hitPoints: c.hitPoints,
      pathIndex: c.pathIndex,
      travel: c.travel,
      timeout: c.timeout,
      motion: { x: c.motion.x, y: c.motion.y },
      speed: c.speed,
      turn: c.turn,
      scale: c.scale,
      radius: c.radius,
      value: c.value
    })),

    // Towers
    towers: globalThis.towers.map((t, idx) => ({
      type: t.constructor.name,
      cellX: t.cellPosition.x,
      cellY: t.cellPosition.y,
      x: t.x,
      y: t.y,
      angle: t.angle,
      cooldown: t.cooldown,
      rate: t.rate,
      range: t.range,
      minimumRange: t.minimumRange,
      targetIndex: globalThis.creeps.indexOf(t.target),
      // Star-specific
      outAngle: t.outAngle
    })),

    // Bullets
    bullets: globalThis.bullets.map(b => ({
      type: b.constructor.name,
      x: b.x,
      y: b.y,
      age: b.age,
      damage: b.damage,
      sourceIndex: globalThis.towers.indexOf(b.source),
      targetIndex: globalThis.creeps.indexOf(b.target),
      // Spiral-specific
      angle: b.angle,
      // Laser-specific
      speed: b.speed
    })),

    // Hopper (pending creeps to spawn)
    hopper: globalThis.hopper.map(c => ({
      type: c.constructor.name
    })),

    // Backlog
    backlog: globalThis.backlog.map(c => ({
      type: c.constructor.name
    })),

    // Map
    map: globalThis.map1,

    // Selected tower
    selectedTowerIndex: globalThis.towers.indexOf(globalThis.selectedTower)
  };
}

function loadState(stateData) {
  console.log(`Loading game state (version: ${stateData.version}, saved: ${stateData.timestamp})`);

  // Restore basic game state
  globalThis.lives = stateData.lives;
  globalThis.money = stateData.money;
  globalThis.waveCounter = stateData.waveCounter;
  globalThis.difficulty = stateData.difficulty;
  globalThis.ticker = stateData.ticker || 0;
  globalThis.waveAge = stateData.waveAge || 0;
  globalThis.releaseRate = stateData.releaseRate || 80;
  globalThis.gameAcceleration = stateData.gameAcceleration || 1;
  globalThis.gameAccelerated = stateData.gameAccelerated || false;
  globalThis.taps = stateData.taps || 0;

  // Initialize world
  globalThis.levelMap = globalThis.createWorld(stateData.map || globalThis.map1);

  // Clear arrays
  globalThis.creeps = [];
  globalThis.towers = [];
  globalThis.bullets = [];
  globalThis.particleSystems = [];
  globalThis.hopper = [];
  globalThis.backlog = [];

  // Restore creeps
  for (const creepData of stateData.creeps || []) {
    const CreepClass = globalThis[creepData.type];
    if (!CreepClass) {
      console.warn(`Unknown creep type: ${creepData.type}`);
      continue;
    }

    const creep = new CreepClass();
    creep.x = creepData.x;
    creep.y = creepData.y;
    creep.angle = creepData.angle;
    creep.damage = creepData.damage;
    creep.hitPoints = creepData.hitPoints;
    creep.pathIndex = creepData.pathIndex;
    creep.travel = creepData.travel || 0;
    creep.timeout = creepData.timeout || 0;
    creep.motion = globalThis.v2(creepData.motion.x, creepData.motion.y);

    // Update destination based on pathIndex
    if (creep.pathIndex < globalThis.levelMap.path.length) {
      creep.destination = globalThis.mapToWorld(globalThis.levelMap.path[creep.pathIndex]);
    }
    if (creep.pathIndex > 0) {
      creep.source = globalThis.mapToWorld(globalThis.levelMap.path[creep.pathIndex - 1]);
    }

    globalThis.creeps.push(creep);
  }

  // Restore towers
  for (const towerData of stateData.towers || []) {
    const TowerClass = globalThis[towerData.type];
    if (!TowerClass) {
      console.warn(`Unknown tower type: ${towerData.type}`);
      continue;
    }

    const tower = new TowerClass(towerData.cellX, towerData.cellY);
    tower.angle = towerData.angle;
    tower.cooldown = towerData.cooldown;
    if (towerData.outAngle !== undefined) tower.outAngle = towerData.outAngle;

    globalThis.towers.push(tower);
  }

  // Restore tower targets (after all creeps and towers are loaded)
  for (let i = 0; i < globalThis.towers.length; i++) {
    const towerData = stateData.towers[i];
    if (towerData.targetIndex >= 0 && towerData.targetIndex < globalThis.creeps.length) {
      globalThis.towers[i].target = globalThis.creeps[towerData.targetIndex];
    }
  }

  // Restore bullets
  for (const bulletData of stateData.bullets || []) {
    const BulletClass = globalThis[bulletData.type];
    if (!BulletClass) {
      console.warn(`Unknown bullet type: ${bulletData.type}`);
      continue;
    }

    const source = globalThis.towers[bulletData.sourceIndex];
    const target = globalThis.creeps[bulletData.targetIndex];

    if (!source || !target) {
      console.warn(`Skipping bullet with invalid source/target`);
      continue;
    }

    const bullet = new BulletClass(source, target);
    bullet.x = bulletData.x;
    bullet.y = bulletData.y;
    bullet.age = bulletData.age;
    if (bulletData.angle !== undefined) bullet.angle = bulletData.angle;
    if (bulletData.speed !== undefined) bullet.speed = bulletData.speed;

    globalThis.bullets.push(bullet);
  }

  // Restore hopper
  for (const hopperData of stateData.hopper || []) {
    const CreepClass = globalThis[hopperData.type];
    if (CreepClass) {
      globalThis.hopper.push(new CreepClass());
    }
  }

  // Restore backlog
  for (const backlogData of stateData.backlog || []) {
    const CreepClass = globalThis[backlogData.type];
    if (CreepClass) {
      globalThis.backlog.push(new CreepClass());
    }
  }

  // Restore selected tower
  if (stateData.selectedTowerIndex >= 0 && stateData.selectedTowerIndex < globalThis.towers.length) {
    globalThis.selectedTower = globalThis.towers[stateData.selectedTowerIndex];
  } else {
    globalThis.selectedTower = null;
  }

  // Restore game mode
  const gameModeMap = {
    'mainGame': globalThis.mainGame,
    'titleScreen': globalThis.titleScreen,
    'waitForContent': globalThis.waitForContent,
    'waitForFullScreen': globalThis.waitForFullScreen,
    'gameOver': globalThis.gameOver
  };
  globalThis.gameMode = gameModeMap[stateData.gameMode] || globalThis.mainGame;

  console.log(`State loaded: ${globalThis.creeps.length} creeps, ${globalThis.towers.length} towers, ${globalThis.bullets.length} bullets`);
}

function placeTower(towerType, cellX, cellY) {
  // Get tower class from globalThis
  const TowerClass = globalThis[towerType];

  if (!TowerClass) {
    throw new Error(`Unknown tower type: ${towerType}`);
  }

  const pos = globalThis.v2(cellX, cellY);

  // Check if we can build here
  if (!globalThis.levelMap.canBuildHere(pos)) {
    return { success: false, reason: 'Cannot build at this location' };
  }

  // Check if there's already a tower here
  const towerHere = globalThis.towers.find(({cellPosition}) =>
    globalThis.vsame(cellPosition, pos)
  );

  if (towerHere) {
    return { success: false, reason: 'Tower already exists at this location' };
  }

  // Get tower cost
  const info = globalThis.towerInfo.find(t => t.type === TowerClass);
  if (!info) {
    return { success: false, reason: 'Tower type not found in towerInfo' };
  }

  // Check if we can afford it
  if (globalThis.money < info.cost) {
    return { success: false, reason: `Not enough money (need ${info.cost}, have ${globalThis.money})` };
  }

  // Buy the tower
  globalThis.buyTower(info, cellX, cellY);

  return {
    success: true,
    tower: { cellX, cellY, type: towerType, cost: info.cost },
    moneyRemaining: globalThis.money
  };
}

function reset() {
  globalThis.startGame();
}

// Don't initialize immediately - allow control from command line
// init();

// REPL Command Execution
function executeCommand(commandLine) {
  const parts = commandLine.trim().split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  try {
    switch (cmd) {
      case 'advance': {
        const ticks = parseInt(args[0]) || 1;
        tick(ticks);
        console.log(`Advanced ${ticks} tick(s)`);
        console.log(`  Lives: ${globalThis.lives}, Money: ${globalThis.money}, Wave: ${globalThis.waveCounter}`);
        console.log(`  Creeps: ${globalThis.creeps.length}, Towers: ${globalThis.towers.length}, Bullets: ${globalThis.bullets.length}`);
        console.log(`  Ticker: ${globalThis.ticker}, WaveAge: ${globalThis.waveAge}`);
        return true;
      }

      case 'show_creep': {
        const index = parseInt(args[0]) || 0;
        if (index < 0 || index >= globalThis.creeps.length) {
          console.log(`Error: Creep index ${index} out of range (0-${globalThis.creeps.length - 1})`);
          return false;
        }
        const creep = globalThis.creeps[index];
        console.log(`Creep #${index} (${creep.constructor.name}):`);
        console.log(`  Position: (${creep.x.toFixed(2)}, ${creep.y.toFixed(2)})`);
        console.log(`  Health: ${(creep.hitPoints - creep.damage).toFixed(1)}/${creep.hitPoints.toFixed(1)}`);
        console.log(`  Speed: ${creep.speed}, Angle: ${creep.angle.toFixed(2)}`);
        console.log(`  Path Index: ${creep.pathIndex}/${globalThis.levelMap.path.length - 1}`);
        console.log(`  Value: $${creep.value}`);
        return true;
      }

      case 'show_tower': {
        const index = parseInt(args[0]) || 0;
        if (index < 0 || index >= globalThis.towers.length) {
          console.log(`Error: Tower index ${index} out of range (0-${globalThis.towers.length - 1})`);
          return false;
        }
        const tower = globalThis.towers[index];
        console.log(`Tower #${index} (${tower.constructor.name}):`);
        console.log(`  Cell Position: (${tower.cellPosition.x}, ${tower.cellPosition.y})`);
        console.log(`  World Position: (${tower.x.toFixed(2)}, ${tower.y.toFixed(2)})`);
        console.log(`  Range: ${tower.range}, Min Range: ${tower.minimumRange}`);
        console.log(`  Rate: ${tower.rate}, Cooldown: ${tower.cooldown}`);
        console.log(`  Target: ${tower.target ? tower.target.constructor.name : 'none'}`);
        console.log(`  Angle: ${tower.angle.toFixed(2)}`);
        return true;
      }

      case 'save_json': {
        if (!args[0]) {
          console.log('Error: save_json requires a filename');
          return false;
        }
        const fs = require('fs');
        const state = saveState();
        fs.writeFileSync(args[0], JSON.stringify(state, null, 2));
        console.log(`State saved to ${args[0]}`);
        return true;
      }

      case 'load_json': {
        if (!args[0]) {
          console.log('Error: load_json requires a filename');
          return false;
        }
        const fs = require('fs');
        if (!fs.existsSync(args[0])) {
          console.log(`Error: File not found: ${args[0]}`);
          return false;
        }
        const stateData = JSON.parse(fs.readFileSync(args[0], 'utf8'));
        loadState(stateData);
        console.log(`State loaded from ${args[0]}`);
        return true;
      }

      case 'buy_tower': {
        if (args.length < 3) {
          console.log('Error: buy_tower requires <type> <cellX> <cellY>');
          return false;
        }
        const towerType = args[0];
        const cellX = parseInt(args[1]);
        const cellY = parseInt(args[2]);

        const result = placeTower(towerType, cellX, cellY);
        if (result.success) {
          console.log(`Tower placed: ${towerType} at (${cellX}, ${cellY})`);
          console.log(`  Cost: $${result.tower.cost}, Money remaining: $${result.moneyRemaining}`);
        } else {
          console.log(`Failed to place tower: ${result.reason}`);
        }
        return result.success;
      }

      case 'list_counts': {
        console.log('Game State Summary:');
        console.log(`  Lives: ${globalThis.lives}`);
        console.log(`  Money: $${globalThis.money}`);
        console.log(`  Wave: ${globalThis.waveCounter} (difficulty: ${globalThis.difficulty.toFixed(2)})`);
        console.log(`  Ticker: ${globalThis.ticker}, WaveAge: ${globalThis.waveAge}`);
        console.log(`  Creeps: ${globalThis.creeps.length}`);
        console.log(`  Towers: ${globalThis.towers.length}`);
        console.log(`  Bullets: ${globalThis.bullets.length}`);
        console.log(`  Hopper: ${globalThis.hopper.length}`);
        console.log(`  Backlog: ${globalThis.backlog.length}`);
        return true;
      }

      case 'help':
      case '?': {
        console.log('Available commands:');
        console.log('  advance [ticks=1]                - Advance simulation by N ticks');
        console.log('  show_creep [index=0]             - Show details of a creep');
        console.log('  show_tower [index=0]             - Show details of a tower');
        console.log('  save_json <filename>             - Save game state to JSON file');
        console.log('  load_json <filename>             - Load game state from JSON file');
        console.log('  buy_tower <type> <cellX> <cellY> - Purchase and place a tower');
        console.log('  list_counts                      - Show game state summary');
        console.log('  help, ?                          - Show this help');
        console.log('  exit, quit                       - Exit REPL');
        console.log('\nTower types: Tower, Stubby, Star, Boom, BigBoom');
        return true;
      }

      case 'exit':
      case 'quit':
        return 'exit';

      case '':
        return true;

      default:
        console.log(`Unknown command: ${cmd}. Type 'help' for available commands.`);
        return false;
    }
  } catch (error) {
    console.log(`Error executing command: ${error.message}`);
    return false;
  }
}

function startREPL() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'sltd> '
  });

  console.log('\n=== SLTD Headless REPL ===');
  console.log("Type 'help' for available commands, 'exit' to quit\n");

  rl.prompt();

  rl.on('line', (line) => {
    const result = executeCommand(line);
    if (result === 'exit') {
      console.log('Goodbye!');
      rl.close();
      return;
    }
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

// Export API
module.exports = {
  init,
  tick,
  run,
  update,
  getState,
  saveState,
  loadState,
  placeTower,
  reset,
  executeCommand,
  startREPL,

  // Direct access to game state (read-only recommended)
  get lives() { return globalThis.lives; },
  get money() { return globalThis.money; },
  get wave() { return globalThis.waveCounter; },
  get creeps() { return globalThis.creeps; },
  get towers() { return globalThis.towers; },
  get bullets() { return globalThis.bullets; }
};

// If run directly, handle command line arguments
if (require.main === module) {
  const fs = require('fs');
  const args = process.argv.slice(2);

  function showUsage() {
    console.log(`
Usage:
  node nodemain.js                              Run interactive demo
  node nodemain.js repl                         Start interactive REPL
  node nodemain.js -e "<commands>"              Execute command sequence (semicolon-separated)
  node nodemain.js <ticks>                      Start game, run N ticks, output state
  node nodemain.js <input.json> <ticks>         Load state, run N ticks, output state
  node nodemain.js <input.json> <ticks> <output.json>
                                                Load state, run N ticks, save to file

REPL Commands:
  advance [ticks=1]                - Advance simulation by N ticks
  show_creep [index=0]             - Show details of a creep
  show_tower [index=0]             - Show details of a tower
  save_json <filename>             - Save game state to JSON file
  load_json <filename>             - Load game state from JSON file
  buy_tower <type> <cellX> <cellY> - Purchase and place a tower
  list_counts                      - Show game state summary
  help                             - Show help in REPL
  exit, quit                       - Exit REPL

Examples:
  node nodemain.js                              # Run demo
  node nodemain.js repl                         # Interactive mode
  node nodemain.js -e "list_counts; advance 100; list_counts"
  node nodemain.js 1000                         # Run 1000 ticks, print state
  node nodemain.js state.json 500               # Load state, run 500 ticks
  node nodemain.js state.json 500 next.json     # Load, run, save to file
`);
  }

  // Parse arguments
  if (args.length === 0) {
    // Run demo
    init();
    console.log("\n=== SLTD Headless Demo ===\n");
    console.log("Initial state:", getState());

    console.log("\nPlacing towers...");
    console.log(placeTower('Tower', 5, 5));
    console.log(placeTower('Tower', 6, 5));
    console.log(placeTower('Stubby', 7, 5));

    console.log("\nRunning simulation for 500 ticks...\n");
    const finalState = run(500, 100);

    console.log("\n=== Final State ===");
    console.log(JSON.stringify(finalState, null, 2));
    console.log("\n=== Demo Complete ===");

  } else if (args[0] === '--help' || args[0] === '-h') {
    showUsage();

  } else if (args[0] === 'repl') {
    // Start REPL mode
    init();
    console.log('Game initialized.');
    startREPL();

  } else if (args[0] === '-e') {
    // Execute command sequence
    if (args.length < 2) {
      console.error('Error: -e requires a command string');
      process.exit(1);
    }

    init();
    const commandString = args.slice(1).join(' ');
    const commands = commandString.split(';').map(c => c.trim()).filter(c => c.length > 0);

    for (const cmd of commands) {
      console.log(`\n> ${cmd}`);
      const result = executeCommand(cmd);
      if (result === 'exit') {
        break;
      }
    }

  } else if (args.length === 1) {
    // node nodemain.js <ticks>
    const ticks = parseInt(args[0]);
    if (isNaN(ticks)) {
      console.error(`Error: Invalid number of ticks: ${args[0]}`);
      process.exit(1);
    }

    // Temporarily suppress console.log for init/run
    const originalLog = console.log;
    console.log = () => {};

    init();
    run(ticks, Math.max(1, Math.floor(ticks / 10)));

    console.log = originalLog;

    const finalState = saveState();
    console.log(JSON.stringify(finalState, null, 2));

  } else if (args.length === 2) {
    // node nodemain.js <input.json> <ticks>
    const inputFile = args[0];
    const ticks = parseInt(args[1]);

    if (isNaN(ticks)) {
      console.error(`Error: Invalid number of ticks: ${args[1]}`);
      process.exit(1);
    }

    if (!fs.existsSync(inputFile)) {
      console.error(`Error: Input file not found: ${inputFile}`);
      process.exit(1);
    }

    const stateData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    // Temporarily suppress console.log for load/run
    const originalLog = console.log;
    console.log = () => {};

    loadState(stateData);
    run(ticks, Math.max(1, Math.floor(ticks / 10)));

    console.log = originalLog;

    const finalState = saveState();
    console.log(JSON.stringify(finalState, null, 2));

  } else if (args.length === 3) {
    // node nodemain.js <input.json> <ticks> <output.json>
    const inputFile = args[0];
    const ticks = parseInt(args[1]);
    const outputFile = args[2];

    if (isNaN(ticks)) {
      console.error(`Error: Invalid number of ticks: ${args[1]}`);
      process.exit(1);
    }

    if (!fs.existsSync(inputFile)) {
      console.error(`Error: Input file not found: ${inputFile}`);
      process.exit(1);
    }

    const stateData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    loadState(stateData);

    console.log(`Running for ${ticks} ticks...`);
    run(ticks, Math.max(1, Math.floor(ticks / 10)));

    const finalState = saveState();
    fs.writeFileSync(outputFile, JSON.stringify(finalState, null, 2));
    console.log(`State saved to ${outputFile}`);
    console.log(`Lives: ${finalState.lives}, Money: ${finalState.money}, Wave: ${finalState.waveCounter}`);

  } else {
    console.error('Error: Invalid number of arguments');
    showUsage();
    process.exit(1);
  }
}
