const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const game = require('../../srv/nodemain.js');

Math.random = makeRandom(42);
game.loadState(JSON.parse(fs.readFileSync(path.join(__dirname, 'initial_state.json'), 'utf8')));
const initial = game.getState();
for (const [x, y] of [[3, 2], [5, 4]]) {
  const purchase = game.placeTower('Tower', x, y);
  assert.ok(purchase.success, `Sentry at ${x},${y}: ${purchase.reason || 'purchase failed'}`);
}
assert.ok(sendWave(), 'The first wave can launch');
game.tick(500);
const state = game.saveState();
assert.equal(state.towers.length, initial.towers.length + 2, 'Both purchased towers remain');
assert.equal(state.lives, initial.lives, 'The opening defense prevents leaks');
assert.ok(state.score > initial.score, 'The defense kills creeps');
assert.ok(state.money >= 0, 'Purchases and combat preserve a valid balance');
fs.writeFileSync(path.join(__dirname, 'final_state.json'), JSON.stringify(state, null, 2) + '\n');
console.log(JSON.stringify({result: 'PASS', lives: state.lives, money: state.money,
  score: state.score, wave: state.waveCounter, towers: state.towers.length}, null, 2));
