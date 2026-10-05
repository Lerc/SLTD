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
require('./maps.js');
require('./gadgets.js');
require('./arsenal.js');
require('./levels.js');
require('./waves.js');
require('./placement.js');
// Match browser script semantics: state vars and globalThis must be the same storage.
require('vm').runInThisContext(require('fs').readFileSync(__dirname + '/showRunner.js', 'utf8'), {filename: 'showRunner.js'});
const { makeCommands } = require('./commands.js');

// Stub out browser-only globals
globalThis.Assets = {
  TowerIcons: null,
  Creep1: null,
  Creep2: null,
  Creep3: null,
  Creep4: null,
  Spikey: null, Mender: null, Splitter: null, Shieldbug: null,
  Skimmer: null, Capacitor: null, Bulwark: null, ShieldBubble: null,
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
    score: globalThis.score,
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

  // Sold towers still own travelling shots and burning damage. Keep their
  // shared identity without restoring them to the buildable tower list.
  const detachedSources = [...new Set([
    ...globalThis.bullets.map(b => b.source),
    ...globalThis.creeps.map(c => c.burnSource)
  ].filter(source => source && !globalThis.towers.includes(source)))];
  const towerState = t => ({
    type: t.constructor.name,
    cellX: t.cellPosition.x, cellY: t.cellPosition.y,
    x: t.x, y: t.y, angle: t.angle, cooldown: t.cooldown,
    rate: t.rate, range: t.range, minimumRange: t.minimumRange,
    targetIndex: globalThis.creeps.indexOf(t.target),
    outAngle: t.outAngle, focus: t.focus, focusTargetIndex: globalThis.creeps.indexOf(t.focusTarget),
    level: t.level, invested: t.invested, targetMode: t.targetMode, kills: t.kills, damageDealt: t.damageDealt
  });

  return {
    version: globalThis.versionString,
    timestamp: new Date().toISOString(),

    // Basic game state
    lives: globalThis.lives,
    money: globalThis.money,
    score: globalThis.score,
    waveCounter: globalThis.waveCounter,
    difficulty: globalThis.difficulty,
    ticker: globalThis.ticker,
    waveAge: globalThis.waveAge,
    activeWaves: globalThis.activeWaves.map(wave => ({...wave})),
    waveCountdownTotal: globalThis.waveCountdownTotal,
    waveClearBase: globalThis.waveClearBase,
    waveClearPayout: globalThis.waveClearPayout ? {...globalThis.waveClearPayout} : null,
    sendCooldown: globalThis.sendCooldown,
    releaseRate: globalThis.releaseRate,
    gameAcceleration: globalThis.gameAcceleration,
    gameAccelerated: globalThis.gameAccelerated,
    gameMode: gameModeName,
    paused: globalThis.paused, betweenWaves: globalThis.betweenWaves, buildTicks: globalThis.buildTicks,
    taps: globalThis.taps,

    // Creeps
    creeps: globalThis.creeps.map(c => ({
      type: c.constructor.name,
      waveNumber: c.waveNumber,
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
      value: c.value,
      slowTicks: c.slowTicks, slowFactor: c.slowFactor, burnTicks: c.burnTicks, burnPower: c.burnPower,
      shield: c.shield, shieldRechargeTicks: c.shieldRechargeTicks, vulnerableTicks: c.vulnerableTicks,
      boostCharge: c.boostCharge, boostTicks: c.boostTicks,
      burnSourceIndex: globalThis.towers.indexOf(c.burnSource),
      burnSourceDetachedIndex: detachedSources.indexOf(c.burnSource)
    })),

    // Towers
    towers: globalThis.towers.map(towerState),
    detachedSources: detachedSources.map(towerState),

    // Bullets
    bullets: globalThis.bullets.map(b => ({
      type: b.constructor.name,
      x: b.x,
      y: b.y,
      age: b.age,
      damage: b.damage,
      range: b.range,
      sourceIndex: globalThis.towers.indexOf(b.source),
      sourceDetachedIndex: detachedSources.indexOf(b.source),
      targetIndex: globalThis.creeps.indexOf(b.target),
      // Spiral-specific
      angle: b.angle,
      // Laser-specific
      speed: b.speed,
      motion: b.motion, fadeTicks: b.fadeTicks, fadeDuration: b.fadeDuration,
      lastTargetPosition: b.target?.position || b.lastTargetPosition,
      launchTicks: b.launchTicks, launchDuration: b.launchDuration, orphanTicks: b.orphanTicks, level: b.level,
      // Flames keep travelling after their original target has gone.
      ...(b instanceof Flame ? {distance: b.distance, radius: b.radius,
        burnPower: b.burnPower, burnDuration: b.burnDuration,
        hitEnemyIndices: [...b.hitEnemies].map(c => globalThis.creeps.indexOf(c)).filter(i => i >= 0)} : {})
    })),

    // Hopper (pending creeps to spawn)
    hopper: globalThis.hopper.map(c => ({
      type: c.constructor.name, waveNumber: c.waveNumber, hitPoints: c.hitPoints, shield: c.shield,
      shieldRechargeTicks: c.shieldRechargeTicks, boostCharge: c.boostCharge, boostTicks: c.boostTicks
    })),

    // Backlog
    backlog: globalThis.backlog.map(c => ({
      type: c.constructor.name, x: c.x, y: c.y, pathIndex: c.pathIndex,
      destination: {...c.destination}, source: {...c.source}, motion: {...c.motion}, hitPoints: c.hitPoints, waveNumber: c.waveNumber
    })),

    // Map
    map: globalThis.activeMapCells,
    mapId: globalThis.selectedMapId,
    mapPath: globalThis.activeMapPath,

    // Selected tower
    selectedTowerIndex: globalThis.towers.indexOf(globalThis.selectedTower)
  };
}

function loadState(stateData) {
  console.log(`Loading game state (version: ${stateData.version}, saved: ${stateData.timestamp})`);

  // Restore basic game state
  globalThis.lives = stateData.lives;
  globalThis.money = stateData.money;
  globalThis.score = stateData.score ?? 0;
  globalThis.waveCounter = stateData.waveCounter;
  globalThis.difficulty = stateData.difficulty;
  globalThis.ticker = stateData.ticker || 0;
  globalThis.waveAge = stateData.waveAge || 0;
  globalThis.releaseRate = stateData.releaseRate || 80;
  globalThis.gameAcceleration = stateData.gameAcceleration || 1;
  globalThis.gameAccelerated = stateData.gameAccelerated || false;
  globalThis.taps = stateData.taps || 0;
  globalThis.paused = stateData.paused || false;
  globalThis.betweenWaves = stateData.betweenWaves || false;
  globalThis.buildTicks = stateData.buildTicks || 0;
  globalThis.sendCooldown = stateData.sendCooldown ?? (globalThis.betweenWaves ? 0 : Math.max(0, 180 - globalThis.waveAge));
  globalThis.activeWaves = stateData.activeWaves ? stateData.activeWaves.map(wave => ({...wave})) :
    globalThis.betweenWaves ? [] : [{number:globalThis.waveCounter, age:globalThis.waveAge, interval:globalThis.releaseRate}];

  // Initialize world
  globalThis.activeMapCells = stateData.map || globalThis.mapCatalog.find(m => m.id === stateData.mapId)?.cells || globalThis.map1;
  globalThis.selectedMapId = globalThis.mapCatalog.find(m => JSON.stringify(m.cells) === JSON.stringify(globalThis.activeMapCells))?.id || 'custom';
  globalThis.activeMapPath = stateData.mapPath || globalThis.mapCatalog.find(m => m.id === globalThis.selectedMapId)?.path || null;
  globalThis.levelMap = globalThis.createWorld(globalThis.activeMapCells, globalThis.activeMapPath);
  globalThis.cancelPlacement();

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
    creep.waveNumber = creepData.waveNumber ?? globalThis.waveCounter;
    for (const key of ['slowTicks', 'slowFactor', 'burnTicks', 'burnPower', 'shield', 'shieldRechargeTicks', 'vulnerableTicks', 'boostCharge', 'boostTicks']) {
      if (creepData[key] !== undefined) creep[key] = creepData[key];
    }
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

  function restoreTower(towerData) {
    const TowerClass = globalThis[towerData.type];
    if (!TowerClass) {
      console.warn(`Unknown tower type: ${towerData.type}`);
      return null;
    }

    const tower = new TowerClass(towerData.cellX, towerData.cellY);
    applyTowerLevel(tower, towerData.level || 1);
    for (const key of ['invested', 'targetMode', 'kills', 'damageDealt']) {
      if (towerData[key] !== undefined) tower[key] = towerData[key];
    }
    tower.angle = towerData.angle;
    tower.cooldown = towerData.cooldown;
    if (towerData.outAngle !== undefined) tower.outAngle = towerData.outAngle;
    tower.x = towerData.x ?? tower.x;
    tower.y = towerData.y ?? tower.y;
    return tower;
  }

  // Detached sources are reconstructed for combat references only.
  const detachedSources = (stateData.detachedSources || []).map(restoreTower);
  for (const towerData of stateData.towers || []) {
    const tower = restoreTower(towerData);
    if (tower) globalThis.towers.push(tower);
  }

  // Restore tower targets (after all creeps and towers are loaded)
  for (let i = 0; i < globalThis.towers.length; i++) {
    const towerData = stateData.towers[i];
    const tower = globalThis.towers[i];
    if (towerData.focus !== undefined) tower.focus = towerData.focus;
    tower.focusTarget = globalThis.creeps[towerData.focusTargetIndex] || null;
    if (towerData.targetIndex >= 0 && towerData.targetIndex < globalThis.creeps.length) {
      globalThis.towers[i].target = globalThis.creeps[towerData.targetIndex];
    }
  }

  for (let i = 0; i < globalThis.creeps.length; i++) {
    const creepData = stateData.creeps[i];
    globalThis.creeps[i].burnSource = globalThis.towers[creepData.burnSourceIndex] ||
      detachedSources[creepData.burnSourceDetachedIndex] || null;
  }

  // Restore bullets
  for (const bulletData of stateData.bullets || []) {
    const BulletClass = globalThis[bulletData.type];
    if (!BulletClass) {
      console.warn(`Unknown bullet type: ${bulletData.type}`);
      continue;
    }

    const source = globalThis.towers[bulletData.sourceIndex] || detachedSources[bulletData.sourceDetachedIndex];
    const target = globalThis.creeps[bulletData.targetIndex];

    if (!source) {
      console.warn(`Skipping bullet with invalid source`);
      continue;
    }

    const bullet = new BulletClass(source, target);
    bullet.x = bulletData.x;
    bullet.y = bulletData.y;
    bullet.age = bulletData.age;
    if (bulletData.damage !== undefined) bullet.damage = bulletData.damage;
    if (bulletData.range !== undefined) bullet.range = bulletData.range;
    if (bulletData.angle !== undefined) bullet.angle = bulletData.angle;
    if (bulletData.speed !== undefined) bullet.speed = bulletData.speed;
    for (const key of ['motion', 'fadeTicks', 'fadeDuration', 'lastTargetPosition', 'launchTicks', 'launchDuration', 'orphanTicks', 'level']) {
      if (bulletData[key] !== undefined) bullet[key] = bulletData[key];
    }
    if (bullet instanceof Flame) {
      for (const key of ['distance', 'radius', 'burnPower', 'burnDuration']) {
        if (bulletData[key] !== undefined) bullet[key] = bulletData[key];
      }
      bullet.hitEnemies = new Set((bulletData.hitEnemyIndices || []).map(i => globalThis.creeps[i]).filter(Boolean));
    }

    globalThis.bullets.push(bullet);
  }

  // Restore hopper
  for (const hopperData of stateData.hopper || []) {
    const CreepClass = globalThis[hopperData.type];
    if (CreepClass) {
      const creep = new CreepClass();
      creep.waveNumber = hopperData.waveNumber ?? globalThis.waveCounter;
      if (hopperData.hitPoints !== undefined) creep.hitPoints = hopperData.hitPoints;
      if (hopperData.shield !== undefined) creep.shield = hopperData.shield;
      if (hopperData.shieldRechargeTicks !== undefined) creep.shieldRechargeTicks = hopperData.shieldRechargeTicks;
      for (const key of ['boostCharge', 'boostTicks']) {
        if (hopperData[key] !== undefined) creep[key] = hopperData[key];
      }
      globalThis.hopper.push(creep);
    }
  }

  // Restore backlog
  for (const backlogData of stateData.backlog || []) {
    const CreepClass = globalThis[backlogData.type];
    if (CreepClass) {
      const child = new CreepClass();
      child.waveNumber = backlogData.waveNumber ?? globalThis.waveCounter;
      for (const key of ['x', 'y', 'pathIndex', 'destination', 'source', 'motion', 'hitPoints']) {
        if (backlogData[key] !== undefined) child[key] = backlogData[key];
      }
      globalThis.backlog.push(child);
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
  globalThis.restoreWaveCountdown(stateData);

  console.log(`State loaded: ${globalThis.creeps.length} creeps, ${globalThis.towers.length} towers, ${globalThis.bullets.length} bullets`);
}

// Tower placement now lives in the shared command layer (commands.js) so the
// browser and headless modes cannot drift apart.
function placeTower(towerType, cellX, cellY) {
  return commands.placeTower(towerType, cellX, cellY);
}

function reset() {
  globalThis.startGame();
}

// Don't initialize immediately - allow control from command line
// init();

// REPL Command Execution
// The command vocabulary is shared with the browser (commands.js); this host
// supplies the Node-specific pieces: real files and direct tick execution.
const commandHost = {
  interactive: true,
  tick: count => tick(count),
  print: line => console.log(line),
  saveState: () => saveState(),
  loadState: state => loadState(state),
  writeFile: (name, text) => require('fs').writeFileSync(name, text),
  readFile: name => {
    const fs = require('fs');
    return fs.existsSync(name) ? fs.readFileSync(name, 'utf8') : null;
  }
};

const commands = makeCommands(commandHost);

function executeCommand(commandLine) {
  return commands.execute(commandLine);
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

function showCommands() {
  for (const line of commands.helpLines()) console.log(line);
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
  get score() { return globalThis.score; },
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
  node nodemain.js --commands                   Show available REPL commands
  node nodemain.js -e "<commands>"              Execute command sequence (semicolon-separated)
  node nodemain.js <ticks>                      Start game, run N ticks, output state
  node nodemain.js <input.json> <ticks>         Load state, run N ticks, output state
  node nodemain.js <input.json> <ticks> <output.json>
                                                Load state, run N ticks, save to file

Examples:
  node nodemain.js                              # Run demo
  node nodemain.js repl                         # Interactive mode
  node nodemain.js --commands                   # List REPL commands
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

  } else if (args[0] === '--commands') {
    showCommands();

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
