"use strict"

// Shared command layer for SLTD.
//
// The same command vocabulary drives the headless REPL (nodemain.js) and the
// live browser page (browser-bridge). Commands operate purely on globalThis
// game state, so they work in either mode. Anything environment-specific --
// reading a file in Node, capturing a frame in the browser -- arrives through
// the `host` object passed to makeCommands().
//
// host = {
//   tick(count),                  advance the simulation
//   print(line),                  emit a line of output
//   readFile(name) -> string,     optional; enables load_json
//   writeFile(name, text),        optional; enables save_json
//   saveState() -> object,        optional; enables save_json
//   loadState(obj),               optional; enables load_json
//   screenshot(name) -> Promise,  optional; enables screenshot
// }
//
// Commands may return a promise; callers that support async (the browser
// bridge) should await the result of execute().

function makeCommands(host) {
  const G = globalThis;
  const out = line => host.print(line);

  function requireHost(fn, cmd, need) {
    if (typeof host[need] !== 'function') {
      out(`Error: ${cmd} is not available in this environment`);
      return false;
    }
    return fn();
  }

  function summary() {
    out(`  Lives: ${G.lives}, Money: ${G.money}, Wave: ${G.waveCounter}`);
    out(`  Creeps: ${G.creeps.length}, Towers: ${G.towers.length}, Bullets: ${G.bullets.length}`);
    out(`  Ticker: ${G.ticker}, WaveAge: ${G.waveAge}`);
  }

  // Tower placement, shared by buy_tower in both modes.
  function placeTower(towerType, cellX, cellY) {
    // Resolve through towerInfo rather than globalThis: in the browser the
    // tower classes are lexical `class` declarations and never land on the
    // global object, whereas entities.js exports them in Node.
    const info = G.towerInfo.find(t => t.type.name === towerType);
    if (!info) return { success: false, reason: `Unknown tower type: ${towerType}` };

    if (!info.upgrades) return {success: false, reason: 'This specialization requires a building upgrade'};
    if (!Number.isInteger(cellX) || !Number.isInteger(cellY)) return {success: false, reason: 'Invalid cell coordinates'};
    const pos = G.v2(cellX, cellY);
    if (!G.levelMap.canBuildHere(pos)) return { success: false, reason: 'Cannot build at this location' };

    const towerHere = G.towers.find(({cellPosition}) => G.vsame(cellPosition, pos));
    if (towerHere) return { success: false, reason: 'Tower already exists at this location' };

    if (G.money < info.cost) {
      return { success: false, reason: `Not enough money (need ${info.cost}, have ${G.money})` };
    }

    if (!G.buyTower(info, cellX, cellY)) return {success: false, reason: 'Cannot build now'};
    return {
      success: true,
      tower: { cellX, cellY, type: towerType, cost: info.cost },
      moneyRemaining: G.money
    };
  }

  // Buildable cells adjacent to the creep path -- the spots worth putting a
  // tower on. Used by `spots` and handy when scripting a scenario.
  function buildableSpots() {
    const spots = [];
    for (const p of (G.levelMap.path || [])) {
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const c = G.v2(p.x + dx, p.y + dy);
        if (G.levelMap.canBuildHere(c) && !spots.some(s => s.x === c.x && s.y === c.y)) spots.push(c);
      }
    }
    return spots;
  }

  const commands = {
    advance(args) {
      const ticks = parseInt(args[0]) || 1;
      host.tick(ticks);
      out(`Advanced ${ticks} tick(s)`);
      summary();
      return true;
    },

    list_counts() {
      out('Game State Summary:');
      out(`  Lives: ${G.lives}`);
      out(`  Money: $${G.money}`);
      out(`  Wave: ${G.waveCounter} (difficulty: ${G.difficulty.toFixed(2)})`);
      out(`  Ticker: ${G.ticker}, WaveAge: ${G.waveAge}`);
      out(`  Creeps: ${G.creeps.length}`);
      out(`  Towers: ${G.towers.length}`);
      out(`  Bullets: ${G.bullets.length}`);
      out(`  Hopper: ${G.hopper.length}`);
      out(`  Backlog: ${G.backlog.length}`);
      return true;
    },

    show_creep(args) {
      const index = parseInt(args[0]) || 0;
      if (index < 0 || index >= G.creeps.length) {
        out(`Error: Creep index ${index} out of range (0-${G.creeps.length - 1})`);
        return false;
      }
      const creep = G.creeps[index];
      out(`Creep #${index} (${creep.constructor.name}):`);
      out(`  Position: (${creep.x.toFixed(2)}, ${creep.y.toFixed(2)})`);
      out(`  Health: ${(creep.hitPoints - creep.damage).toFixed(1)}/${creep.hitPoints.toFixed(1)}`);
      out(`  Speed: ${creep.speed}, Angle: ${creep.angle.toFixed(2)}`);
      out(`  Path Index: ${creep.pathIndex}/${G.levelMap.path.length - 1}`);
      out(`  Value: $${creep.value}`);
      return true;
    },

    show_tower(args) {
      const index = parseInt(args[0]) || 0;
      if (index < 0 || index >= G.towers.length) {
        out(`Error: Tower index ${index} out of range (0-${G.towers.length - 1})`);
        return false;
      }
      const tower = G.towers[index];
      out(`Tower #${index} (${tower.constructor.name}):`);
      out(`  Cell Position: (${tower.cellPosition.x}, ${tower.cellPosition.y})`);
      out(`  World Position: (${tower.x.toFixed(2)}, ${tower.y.toFixed(2)})`);
      out(`  Range: ${tower.range}, Min Range: ${tower.minimumRange}`);
      out(`  Rate: ${tower.rate}, Cooldown: ${tower.cooldown}`);
      out(`  Target: ${tower.target ? tower.target.constructor.name : 'none'}`);
      out(`  Angle: ${tower.angle.toFixed(2)}`);
      return true;
    },

    buy_tower(args) {
      if (args.length < 3) {
        out('Error: buy_tower requires <type> <cellX> <cellY>');
        return false;
      }
      const result = placeTower(args[0], parseInt(args[1]), parseInt(args[2]));
      if (result.success) {
        out(`Tower placed: ${args[0]} at (${args[1]}, ${args[2]})`);
        out(`  Cost: $${result.tower.cost}, Money remaining: $${result.moneyRemaining}`);
      } else {
        out(`Failed to place tower: ${result.reason}`);
      }
      return result.success;
    },

    upgrade_tower(args) {
      const result = G.upgradeTower(G.towers[Number(args[0])], args[1]);
      out(result ? 'Upgraded to ' + args[1] : 'Upgrade unavailable');
      return !!result;
    },
    sell_tower(args) { return G.sellTower(G.towers[Number(args[0])]); },
    send_wave() { return G.sendWave(); },
    tower_types() {
      out('Tower types: ' + G.towerInfo.map(t => `${t.type.name} ($${t.cost})`).join(', '));
      return true;
    },

    spots(args) {
      const limit = parseInt(args[0]) || 10;
      const spots = buildableSpots();
      out(`${spots.length} buildable cell(s) adjacent to the path; first ${Math.min(limit, spots.length)}:`);
      for (const s of spots.slice(0, limit)) out(`  (${s.x}, ${s.y})`);
      return true;
    },

    save_json(args) {
      if (!args[0]) { out('Error: save_json requires a filename'); return false; }
      return requireHost(() => {
        host.writeFile(args[0], JSON.stringify(host.saveState(), null, 2));
        out(`State saved to ${args[0]}`);
        return true;
      }, 'save_json', 'writeFile');
    },

    load_json(args) {
      if (!args[0]) { out('Error: load_json requires a filename'); return false; }
      return requireHost(() => {
        const text = host.readFile(args[0]);
        if (text === null || text === undefined) {
          out(`Error: File not found: ${args[0]}`);
          return false;
        }
        host.loadState(JSON.parse(text));
        out(`State loaded from ${args[0]}`);
        return true;
      }, 'load_json', 'readFile');
    },

    // Browser-only: capture the live post-glow frame.
    screenshot(args) {
      return requireHost(() => {
        const name = args[0] || 'shot';
        return Promise.resolve(host.screenshot(name)).then(where => {
          out(`Screenshot captured: ${where || name}`);
          return true;
        }, err => {
          out(`Screenshot failed: ${err.message}`);
          return false;
        });
      }, 'screenshot', 'screenshot');
    },

    help() {
      out('Available commands:');
      for (const line of helpLines()) out(line);
      return true;
    }
  };
  commands['?'] = commands.help;

  function helpLines() {
    const lines = [
      'advance [ticks=1]                - Advance simulation by N ticks',
      'list_counts                      - Show game state summary',
      'show_creep [index=0]             - Show details of a creep',
      'show_tower [index=0]             - Show details of a tower',
      'buy_tower <type> <cellX> <cellY> - Purchase and place a tower',
      'tower_types                      - List tower types and costs',
      'upgrade_tower <index> <type>     - Choose a specialization',
      'sell_tower <index>               - Sell for 70% of total investment',
      'send_wave                        - Launch early for bonus credits',
      'spots [limit=10]                 - List buildable cells beside the path',
      'save_json <filename>             - Save game state to JSON file',
      'load_json <filename>             - Load game state from JSON file'
    ];
    if (typeof host.screenshot === 'function') {
      lines.push('screenshot [name]                - Capture the live frame as a PNG');
    }
    lines.push('help, ?                          - Show this help');
    if (host.interactive) lines.push('exit, quit                       - Exit REPL');
    lines.push('');
    lines.push('Tower types: ' + globalThis.towerInfo.map(t => t.type.name).join(', '));
    return lines;
  }

  // Execute one command line. Returns the command's result, or a promise for
  // it; 'exit' is returned for exit/quit so a REPL can act on it.
  function execute(commandLine) {
    const parts = commandLine.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    if (cmd === '') return true;
    if (cmd === 'exit' || cmd === 'quit') return 'exit';

    const handler = commands[cmd];
    if (!handler) {
      out(`Unknown command: ${cmd}. Type 'help' for available commands.`);
      return false;
    }

    try {
      return handler(args);
    } catch (error) {
      out(`Error executing command: ${error.message}`);
      return false;
    }
  }

  // Run a ';'-separated script, awaiting each command in turn.
  async function executeScript(script) {
    const results = [];
    for (const line of script.split(';').map(c => c.trim()).filter(c => c.length > 0)) {
      results.push(await execute(line));
    }
    return results;
  }

  return { execute, executeScript, placeTower, buildableSpots, helpLines };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { makeCommands };
} else {
  globalThis.makeCommands = makeCommands;
}
