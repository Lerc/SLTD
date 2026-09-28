"use strict"

// Browser-side control surface for SLTD.
//
// Gives the live page the same command vocabulary as the headless REPL
// (see commands.js), so a scenario written for `node nodemain.js -e "..."`
// runs unchanged against the real rendering game -- with `screenshot` added
// on top. Intended to be driven over browser-bridge:
//
//   wsb run --code 'wslog(await gameControl.run("buy_tower Tower 3 0; advance 300; screenshot mid"))'
//
// Everything here is browser-only; nodemain.js never loads this file.

;(function () {

  // The browser drives the simulation from requestAnimationFrame, so ticks
  // must be *waited for* rather than executed inline -- calling gameMode()
  // directly would advance logic without ever drawing those frames.
  let tickCredit = 0;

  // Called once per frame from main.js's update(), before the normal
  // time-based stepping. Returns the number of forced ticks to run.
  function takeTickCredit(max) {
    const n = Math.min(tickCredit, max);
    tickCredit -= n;
    return n;
  }

  function pendingTicks() { return tickCredit; }

  function advanceTicks(count) {
    tickCredit += count;
    return new Promise(resolve => {
      (function poll() {
        if (tickCredit <= 0) resolve();
        else requestAnimationFrame(poll);
      })();
    });
  }

  // --- input synthesis -----------------------------------------------------
  //
  // Coordinates use the same fixed portrait canvas for the map and controls.
  // Synthetic pointer events exercise the same routing as real touch input.

  function canvasToClient(x, y) {
    const el = outputCanvas;
    const r = el.getBoundingClientRect();
    return {
      clientX: r.left + (x * globalScaleFactor) / el.width * r.width,
      clientY: r.top + (y * globalScaleFactor) / el.height * r.height
    };
  }

  function cellToCanvas(cellX, cellY) {
    const w = mapToWorld(v2(cellX, cellY));
    return { x: w.x + 12, y: w.y + mapTop };
  }

  function sendMouse(type, x, y) {
    const { clientX, clientY } = canvasToClient(x, y);
    const opts = {
      button: 0,
      buttons: type === 'mouseup' ? 0 : 1,
      bubbles: true,
      cancelable: true,
      clientX,
      clientY
    };
    const pointerType = {mousedown: 'pointerdown', mouseup: 'pointerup', mousemove: 'pointermove'}[type];
    outputCanvas.dispatchEvent(new PointerEvent(pointerType, {...opts, pointerId: 1, pointerType: 'mouse'}));
  }

  const frame = () => new Promise(r => requestAnimationFrame(r));

  async function tapCanvas(x, y) {
    // A tap has no preceding hover (notably on touchscreens). Tests for mouse
    // previews dispatch pointermove explicitly before clicking.
    sendMouse('mousedown', x, y);
    sendMouse('mouseup', x, y);
    await frame();
  }

  const tapCell = (cellX, cellY) => {
    const p = cellToCanvas(cellX, cellY);
    return tapCanvas(p.x, p.y);
  };

  const tapTower = tower =>
    tapCell(tower.cellPosition.x, tower.cellPosition.y);

  // --- screenshots ---------------------------------------------------------

  const shots = [];

  // captureScreenshot() (main.js) resolves with a PNG data URL taken in the
  // same frame as glowFrame() -- reading outputCanvas later yields blank.
  async function screenshot(name) {
    const dataURL = await captureScreenshot();
    shots.push({ name, dataURL, time: Date.now() });
    return `${name} (${dataURL.length} bytes, index ${shots.length - 1})`;
  }

  function getShot(indexOrName) {
    if (typeof indexOrName === 'number') return shots[indexOrName];
    return shots.find(s => s.name === indexOrName);
  }

  function listShots() { return shots.map((s, i) => `${i}: ${s.name}`); }
  function clearShots() { shots.length = 0; }

  // --- command host --------------------------------------------------------

  // localStorage stands in for the filesystem so save_json/load_json work in
  // the browser with the same command syntax as the REPL.
  const KEY = name => 'sltd.state.' + name;

  const host = {
    interactive: false,
    tick: count => { tickCredit += count; },
    print: line => { output.push(line); if (typeof wslog === 'function') wslog(line); },
    screenshot,
    saveState: () => gameControl.saveState(),
    loadState: state => gameControl.loadState(state),
    writeFile: (name, text) => localStorage.setItem(KEY(name), text),
    readFile: name => localStorage.getItem(KEY(name))
  };

  let output = [];
  const commands = makeCommands(host);

  // Run a ';'-separated command script and return its output as text.
  // `advance` is intercepted so ticks are rendered rather than run inline.
  async function run(script) {
    output = [];
    for (const line of script.split(';').map(c => c.trim()).filter(Boolean)) {
      const parts = line.split(/\s+/);
      if (parts[0] === 'advance') {
        // Intercepted: ticks are queued for the render loop (see advanceTicks)
        // rather than run inline, so the frames are actually drawn.
        const n = parseInt(parts[1]) || 1;
        await advanceTicks(n);
        host.print(`Advanced ${n} tick(s)`);
        host.print(`  Lives: ${lives}, Money: ${money}, Wave: ${waveCounter}`);
        host.print(`  Creeps: ${creeps.length}, Towers: ${towers.length}, Bullets: ${bullets.length}`);
      } else {
        await commands.execute(line);
      }
    }
    return output.join('\n');
  }

  // --- state snapshot ------------------------------------------------------
  // Mirrors nodemain.js's shape closely enough to move states between modes.

  function saveState() {
    return {
      lives, money, score, waveCounter, difficulty, ticker, waveAge,
      mapId: selectedMapId, map: activeMapCells, mapPath: activeMapPath,
      towers: towers.map(t => ({
        type: t.constructor.name,
        cellX: t.cellPosition.x,
        cellY: t.cellPosition.y, level: t.level, invested: t.invested, targetMode: t.targetMode, kills: t.kills, damageDealt: t.damageDealt
      }))
    };
  }

  function loadState(state) {
    startGame(state.mapId);
    if (state.map) {
      activeMapCells = state.map;
      selectedMapId = mapCatalog.find(m => JSON.stringify(m.cells) === JSON.stringify(state.map))?.id || 'custom';
      activeMapPath = state.mapPath || mapCatalog.find(m => m.id === selectedMapId)?.path || null;
      globalThis.levelMap = createWorld(activeMapCells, activeMapPath);
    }
    globalThis.lives = state.lives;
    globalThis.money = state.money;
    globalThis.score = state.score ?? 0;
    globalThis.waveCounter = state.waveCounter;
    globalThis.difficulty = state.difficulty;
    globalThis.selectedTower = null;
    globalThis.towers.length = 0;
    for (const t of state.towers || []) {
      const info = towerInfo.find(i => i.type.name === t.type);
      if (info) {
        const tower = new info.type(t.cellX, t.cellY);
        applyTowerLevel(tower, t.level || 1);
        for (const key of ['invested', 'targetMode', 'kills', 'damageDealt']) if (t[key] !== undefined) tower[key] = t[key];
        towers.push(tower);
      }
    }
  }

  // Reset to a fresh run regardless of the current mode. startGame() clears
  // money/lives/towers/creeps and rebuilds the level, which is exactly what a
  // scenario wants; tapping through the title screen would leave an
  // in-progress game untouched.
  async function newGame() {
    startGame();
    await advanceTicks(2);
    return gameMode === mainGame;
  }

  globalThis.gameControl = {
    run, commands,
    advanceTicks, takeTickCredit, pendingTicks,
    tapCanvas, tapCell, tapTower, cellToCanvas, canvasToClient,
    screenshot, getShot, listShots, clearShots,
    saveState, loadState, newGame,
    spots: () => commands.buildableSpots()
  };
})();
