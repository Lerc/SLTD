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
  for (let i = 0; i < count; i++) {
    update();
  }
}

function run(ticks = 1000, logInterval = 100) {
  console.log(`Running simulation for ${ticks} ticks...`);

  for (let i = 0; i < ticks; i++) {
    tick();

    if ((i + 1) % logInterval === 0) {
      console.log(`Tick ${i + 1}/${ticks} - Lives: ${globalThis.lives}, Money: ${globalThis.money}, Wave: ${globalThis.waveCounter}, Creeps: ${globalThis.creeps.length}, Towers: ${globalThis.towers.length}`);
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

// Initialize immediately
init();

// Export API
module.exports = {
  init,
  tick,
  run,
  update,
  getState,
  placeTower,
  reset,

  // Direct access to game state (read-only recommended)
  get lives() { return globalThis.lives; },
  get money() { return globalThis.money; },
  get wave() { return globalThis.waveCounter; },
  get creeps() { return globalThis.creeps; },
  get towers() { return globalThis.towers; },
  get bullets() { return globalThis.bullets; }
};

// If run directly, run a simple demo
if (require.main === module) {
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
}
