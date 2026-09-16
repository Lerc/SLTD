const assert = require('node:assert/strict');
const {test, beforeEach} = require('node:test');
const game = require('../../srv/nodemain.js');
beforeEach(() => { game.reset(); });
function build(type = 'Tower', x = 3, y = 2) { assert.equal(game.placeTower(type, x, y).success, true); return towers.at(-1); }
function buildTree(type) {
  const info=towerInfo.find(i=>i.type.name===type);
  if(info.buildable) return build(type);
  const parent=towerInfo.find(i=>i.upgrades?.includes(type));
  return upgradeTower(buildTree(parent.type.name),type);
}
function enemy(Kind = Basic, x = 380, y = 240) { const c = new Kind(); c.x = x; c.y = y; creeps.push(c); return c; }
function fund() { globalThis.money = 10000; }
test('only foundations can be purchased, placement validates coordinates and occupancy', () => {
  const before = money;
  assert.equal(game.placeTower('Ranger', 3, 2).success, false);
  assert.equal(buyTower(towerInfo[0], NaN, 2), false);
  assert.equal(game.placeTower('Tower', 2, 2).success, false);
  assert.equal(money, before);
  build(); assert.equal(game.placeTower('Tower', 3, 2).success, false);
});
test('all branches require their parent and preserve investment', () => {
  for (const base of towerInfo.filter(i => i.upgrades)) for (const branch of base.upgrades) {
    game.reset(); fund(); const tower = buildTree(base.type.name);
    const investment = tower.invested;
    tower.kills = 4; tower.targetMode = 'strong';
    const balance = money;
    const next = towerInfo.find(i => i.type.name === branch);
    const upgraded = upgradeTower(tower, branch);
    assert.equal(upgraded.constructor.name, branch);
    assert.equal(upgraded.kills, 4); assert.equal(upgraded.targetMode, 'strong');
    assert.equal(upgraded.invested, investment + next.cost);
    assert.equal(money, balance - next.cost);
    assert.equal(upgradeTower(upgraded, branch), false);
    const refund = sellValue(upgraded), before = money;
    assert.equal(sellTower(upgraded), true); assert.equal(money, before + refund);
    assert.equal(sellTower(upgraded), false);
  }
});
test('invalid and unaffordable branches cannot charge credits', () => {
  const tower = build(); globalThis.money = 1;
  assert.equal(upgradeTower(tower, 'Ranger'), false);
  assert.equal(upgradeTower(tower, 'Mortar'), false);
  assert.equal(upgradeTower(undefined, 'Ranger'), false);
  assert.equal(money, 1); assert.equal(towers[0], tower);
});
test('armor, shields, and piercing have distinct counters; exact lethal damage pays once', () => {
  const armored = enemy(Ball); armored.takeDamage(10); assert.equal(armored.damage, 4);
  armored.takeDamage(10, 'energy'); assert.equal(armored.damage, 14);
  const shield = enemy(Shieldbug), initial = shield.shield;
  shield.takeDamage(5, 'energy'); assert.equal(shield.shield, initial - 10); assert.equal(shield.damage, 0);
  shield.takeDamage(5, 'piercing'); assert.equal(shield.damage, 5);
  const creep = enemy(), balance = money;
  creep.takeDamage(creep.hitPoints); assert.equal(creep.dead, true);
  assert.equal(money, balance + scaleIncome(creep.value));
  creep.takeDamage(999); assert.equal(money, balance + scaleIncome(creep.value));
});
test('burn prevents regeneration, slow expires, and guardians resist slow', () => {
  const mender = enemy(Mender); mender.damage = 10; mender.move(); assert.ok(mender.damage < 10);
  mender.applyBurn(10, .2); const hp = mender.damage; mender.move(); assert.ok(mender.damage > hp);
  mender.applySlow(.5, 2); mender.move(); mender.move(); assert.equal(mender.slowTicks, 0);
  const boss = enemy(BigBall); boss.applySlow(.5, 20); assert.equal(boss.slowFactor, .75);
});
test('splitters release exactly two children at their current path position', () => {
  const c = enemy(Splitter); c.pathIndex = 5; c.takeDamage(c.hitPoints, 'piercing');
  assert.equal(backlog.length, 2); assert.equal(backlog[0].pathIndex, 5); assert.equal(backlog[0].x, c.x);
  c.takeDamage(1000); assert.equal(backlog.length, 2);
});
test('target priority ignores dead creeps and selects first, strong, or near', () => {
  const tower = build(); const a = enemy(Basic, 390, 240), b = enemy(Ball, 360, 240);
  a.pathIndex = 10; b.pathIndex = 5;
  assert.equal(tower.findTarget(), a);
  tower.targetMode = 'strong'; assert.equal(tower.findTarget(), b);
  tower.targetMode = 'near'; assert.equal(tower.findTarget(), b);
  b.dead = true; assert.equal(tower.findTarget(), a);
});
test('specialized weapons apply chaining, splash, burn, vulnerability, and focused damage', () => {
  for (const branch of ['Tesla', 'Mortar', 'Incinerator', 'Cryo', 'Quake', 'Prism']) {
    game.reset(); fund();
    const tower = buildTree(branch);
    const first = enemy(BigBall, 380, 240), second = enemy(BigBall, 400, 240);
    tower.target = first; tower.fire();
    assert.ok(first.damage > 0, branch);
    if (branch !== 'Prism') assert.ok(second.damage > 0, branch);
    if (branch === 'Incinerator') assert.ok(first.burnTicks > 0);
    if (branch === 'Cryo') assert.ok(first.slowTicks > 0);
    if (branch === 'Quake') assert.ok(first.vulnerableTicks > 0);
    if (branch === 'Prism') { const before = first.damage; tower.fire(); assert.ok(first.damage - before > before); }
  }
});
test('preparation, early launch, wave reward, pause, game over, and restart are consistent', () => {
  assert.equal(hopper.length, 0); const before = money;
  assert.equal(sendWave(), true); assert.equal(money, before + 15);
  assert.equal(sendWave(), false); assert.equal(hopper.length, wavePlan(1).count);
  globalThis.paused = true; game.tick(10); assert.equal(creeps.length, 0);
  globalThis.paused = false; game.tick(); assert.equal(creeps.length, 1);
  globalThis.creeps = []; globalThis.hopper = []; const balance = money;
  game.tick(); assert.equal(waveCounter, 2); assert.equal(money, balance + wavePlan(1).reward);
  assert.equal(betweenWaves, true);
  game.tick(sendCooldown);
  sendWave(); globalThis.lives = 0; game.tick(); assert.equal(gameMode, gameOver);
  const state = game.saveState(); game.tick(100); assert.equal(waveAge, state.waveAge);
  game.reset(); assert.equal(waveCounter, 1); assert.equal(waveAge, 0); assert.equal(selectedTower, null);
});
test('save/load preserves upgrade investment, targeting, statuses, and continued simulation', () => {
  fund(); const tower = upgradeTower(build(), 'Ranger'); tower.targetMode = 'strong';
  sendWave(); game.tick(100);
  creeps[0].applySlow(.5, 100);
  const state = game.saveState(); game.loadState(state);
  assert.equal(towers[0].constructor.name, 'Ranger');
  assert.equal(towers[0].invested, 520); assert.equal(towers[0].targetMode, 'strong');
  assert.equal(creeps[0].slowTicks, 100);
  const age = waveAge; game.tick(20); assert.equal(waveAge, age + 20);
});
test('wave introductions are predictable and difficulty grows without exponential runaway', () => {
  assert.ok(wavePlan(3).kinds.includes(Ball)); assert.ok(wavePlan(4).kinds.includes(Shieldbug));
  assert.ok(wavePlan(5).kinds.includes(BigBall)); assert.ok(wavePlan(6).kinds.includes(Mender));
  for (let i = 2; i <= 60; i++) { assert.ok(waveDifficulty(i) > waveDifficulty(i - 1)); assert.ok(wavePlan(i).count <= 61); }
  assert.ok(waveDifficulty(30) < 100);
});

test('upgrades retain credit for in-flight shots and saves retain split spawn positions', () => {
  fund(); const tower = build(); const creep = enemy(); tower.target = creep; tower.fire();
  const upgrade = upgradeTower(tower, 'Ranger'); assert.equal(bullets[0].source, upgrade);
  const splitter = enemy(Splitter, 450, 600); splitter.pathIndex = 8; splitter.takeDamage(999, 'piercing');
  const state = game.saveState(); game.loadState(state);
  assert.equal(backlog.length, 2); assert.equal(backlog[0].x, 450); assert.equal(backlog[0].pathIndex, 8);
});
