const assert = require('node:assert/strict');
const game = require('../../srv/nodemain.js');

// Representative strategy, using only earned money and legal placements.
const orders = [
  ['Tower',3,2], ['Tower',5,4], ['level',0], ['level',1],
  ['Incinerator',8,8], ['Zappy',8,4], ['level',2], ['level',3],
  ['upgrade',0,'Ranger'], ['upgrade',1,'Repeater'], ['Thumper',6,8],
  ['level',4], ['level',4], ['upgrade',3,'Tesla'], ['upgrade',2,'Inferno'],
  ['Stubby',4,10], ['level',5], ['upgrade',5,'Star'], ['upgrade',4,'Cryo']
];
function simulate(seed, active) {
  Math.random = makeRandom(seed);
  game.reset();
  let order = 0, ticks = 0;
  const checkpoints = [];
  while (lives > 0 && waveCounter <= 24 && ticks < 100000) {
    if (betweenWaves || waveClearPayout) {
      while (order < (active ? orders.length : 2)) {
        const [kind, x, y] = orders[order];
        const result = kind === 'level' ? levelUpTower(towers[x]) : kind === 'upgrade' ? upgradeTower(towers[x], y) : game.placeTower(kind, x, y).success;
        if (!result) break;
        order++;
      }
      checkpoints.push({wave: betweenWaves ? waveCounter : waveCounter + 1, lives, money, order});
      sendWave();
    }
    game.tick(); ticks++;
    assert.ok(money >= 0, 'No negative balance');
    assert.ok(creeps.length + hopper.length + backlog.length < 180, 'Enemy count stays bounded');
  }
  return {seed, active, wave: waveCounter, lives, ticks, checkpoints};
}
for (const seed of [11, 42, 87]) {
  const result = simulate(seed, true);
  assert.ok(result.checkpoints.find(c => c.wave === 3)?.lives === 20, 'Opening is forgiving');
  // Travelling flames and turret acquisition time allow a few more early leaks.
  assert.ok(result.checkpoints.find(c => c.wave === 12)?.lives >= 14, 'Mixed upgrades retain at least 70% of lives through introductions');
  assert.ok(result.wave >= 18, 'A coherent defense has a viable midgame');
  assert.ok(result.wave <= 24 && result.lives === 0, 'An unexpanded defense cannot coast forever');
  console.log(`PASS mixed defense, seed ${seed}: reaches wave ${result.wave}; all opening and economy checks passed`);
}
const idle = simulate(42, false);
assert.ok(idle.wave >= 3 && idle.wave <= 6, 'Ignoring upgrades loses after the tutorial waves');
console.log(`PASS starter-only defense: loses on wave ${idle.wave}`);
