const assert = require('node:assert/strict');
const game = require('../../srv/nodemain.js');

// Representative strategy, using only earned money and legal placements.
const orders = [
  ['Tower',3,2], ['Tower',5,4], ['upgrade',0,'Ranger'],
  ['Zappy',8,4], ['upgrade',2,'Tesla'], ['Stubby',8,8], ['upgrade',3,'Incinerator'],
  ['Thumper',6,8], ['upgrade',4,'Cryo'], ['upgrade',1,'Repeater'],
  ['Star',5,6], ['upgrade',5,'Railgun'], ['Zappy',5,11], ['upgrade',6,'Prism'],
  ['Thumper',4,10], ['upgrade',7,'Quake']
];
function simulate(seed, active) {
  Math.random = makeRandom(seed);
  game.reset();
  let order = 0, ticks = 0;
  const checkpoints = [];
  while (lives > 0 && waveCounter <= 24 && ticks < 100000) {
    if (betweenWaves) {
      while (order < (active ? orders.length : 2)) {
        const [kind, x, y] = orders[order];
        const result = kind === 'upgrade' ? upgradeTower(towers[x], y) : game.placeTower(kind, x, y).success;
        if (!result) break;
        order++;
      }
      checkpoints.push({wave: waveCounter, lives, money, order});
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
  assert.ok(result.checkpoints.find(c => c.wave === 12)?.lives >= 15, 'Mixed upgrades can handle all introductions');
  assert.ok(result.wave >= 18, 'A coherent defense has a viable midgame');
  assert.ok(result.wave <= 24 && result.lives === 0, 'An unexpanded defense cannot coast forever');
  console.log(`PASS mixed defense, seed ${seed}: reaches wave ${result.wave}; all opening and economy checks passed`);
}
const idle = simulate(42, false);
assert.ok(idle.wave >= 3 && idle.wave <= 6, 'Ignoring upgrades loses after the tutorial waves');
console.log(`PASS starter-only defense: loses on wave ${idle.wave}`);
