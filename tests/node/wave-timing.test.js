const assert = require('node:assert/strict');
const {test, beforeEach} = require('node:test');
const game = require('../../srv/nodemain.js');
beforeEach(() => startGame('foundry'));

test('duration uses ordered route distance, release offsets and each creep speed', () => {
  const path = [{x:0,y:0}, {x:3,y:0}, {x:3,y:4}];
  assert.equal(waveDuration([{speed:2}, {speed:4}], 1000, path), 1169);
  assert.equal(waveDuration([{speed:1}, {speed:4}], 10, path), 673, 'An earlier slow creep can leave last');
  assert.equal(waveDuration([{speed:2}], 100, [...path, path[0]]), 577, 'Repeated/crossing path segments still count');
  for (const map of mapCatalog) {
    startGame(map.id); sendWave();
    const duration = waveDuration(hopper, activeWaves[0].interval);
    assert.equal(activeWaves[0].duration, duration);
    assert.equal(buildTicks, duration + 600, 'Next launch includes ten seconds grace');
    assert.equal(waveCountdownTotal, buildTicks);
  }
});

test('kills never accelerate scheduled releases or clear a still-queued formation', () => {
  sendWave(); game.tick();
  const first = creeps[0]; first.takeDamage(1e9, 'piercing');
  game.tick(67);
  assert.equal(creeps.length, 0);
  assert.equal(waveClearBase, wavePlan(1).reward);
  assert.equal(waveClearPayout, null);
  game.tick();
  assert.equal(creeps.length, 1, 'Second creep releases at tick 69');
});

test('next wave launches automatically at duration plus ten seconds even with survivors', () => {
  sendWave();
  for (const creep of hopper) creep.move = () => {};
  const deadline = buildTicks, balance = money;
  game.tick(deadline - 1);
  assert.equal(waveCounter, 1);
  assert.equal(buildTicks, 1);
  game.tick();
  assert.equal(waveCounter, 2);
  assert.equal(money, balance, 'Automatic sends pay no early bonus');
  assert.ok(creeps.some(c => c.waveNumber === 1));
  assert.equal(waveClearBase, wavePlan(1).reward + wavePlan(2).reward);
});

test('pause freezes timers and double speed advances the same simulation clock', () => {
  sendWave(); const remaining = buildTicks;
  paused = true; game.tick(100);
  assert.equal(buildTicks, remaining);
  assert.equal(activeWaves[0].age, 0);
  paused = false; gameAccelerated = true; game.tick(10);
  assert.equal(buildTicks, remaining - 20);
  assert.equal(activeWaves[0].age, 20);
});

test('clear bonus drains proportionally, awards once, then launches after the four-second presentation', () => {
  sendWave(); game.tick(180);
  creeps = []; hopper = []; backlog = [];
  const base = waveClearBase;
  const timeBonus = waveSendBonus();
  const balance = money;
  rewardClearedWaves();
  assert.equal(money, balance + base + timeBonus);
  assert.equal(waveClearPayout.timeBonus, timeBonus, 'Clear and manual-send time rewards are identical');
  const fraction = waveProgress();
  game.tick(15);
  assert.ok(Math.abs(waveProgress() - fraction * 2 / 3) < 1e-12);
  assert.equal(sendWave(), false, 'Cannot claim the countdown again during conversion');
  const saved = game.saveState();
  game.reset(); game.loadState(saved);
  assert.deepEqual(waveClearPayout, saved.waveClearPayout);
  assert.equal(waveClearBase, 0);
  game.tick(waveBonusDrainTicks - 15);
  assert.equal(waveProgress(), 0, 'Animation reaches zero before the next countdown');
  paused = true; game.tick(120);
  assert.equal(waveClearPayout.age, waveBonusDrainTicks, 'Pause freezes the payout presentation');
  paused = false;
  game.tick(waveBonusPauseTicks - waveBonusDrainTicks - 1);
  assert.equal(waveBonusPauseTicks, 240);
  assert.equal(waveCounter, 1, 'The full award remains visible until the presentation ends');
  assert.equal(waveProgress(), 0);
  assert.equal(buildTicks, 0, 'There is no extra preparation countdown');
  assert.equal(canSendWave(), false);
  game.tick();
  assert.equal(betweenWaves, false);
  assert.equal(waveClearPayout, null);
  assert.ok(hopper.length + creeps.length > 0);
  assert.equal(money, balance + base + timeBonus, 'Reload and animation never duplicate rewards');
  assert.equal(waveCounter, 2);
  game.tick(); assert.equal(waveCounter, 2, 'The presentation launches exactly once');
});

test('a splitter child delays the shared clear reward; losing never pays it', () => {
  waveCounter = 7; sendWave();
  const parent = hopper.find(c => c instanceof Splitter);
  parent.takeDamage(1e9, 'piercing');
  creeps = []; hopper = [];
  const balance = money;
  rewardClearedWaves();
  assert.equal(money, balance);
  assert.equal(waveClearBase, wavePlan(7).reward);
  backlog = []; lives = 0;
  rewardClearedWaves();
  assert.equal(money, balance);
  assert.equal(waveClearPayout, null);
});

test('a live countdown and unpaid base survive saves, while restart clears both', () => {
  sendWave(); game.tick(200); sendWave(); game.tick(50);
  const state = JSON.parse(JSON.stringify(game.saveState()));
  game.reset(); game.loadState(state);
  assert.equal(buildTicks, state.buildTicks);
  assert.equal(waveCountdownTotal, state.waveCountdownTotal);
  assert.equal(waveClearBase, state.waveClearBase);
  assert.equal(waveSendBonus(), Math.ceil(state.buildTicks / 60));
  game.reset();
  assert.equal(waveClearBase, 0);
  assert.equal(waveClearPayout, null);
  assert.equal(buildTicks, 900);
});

test('losing a life wipes the entire overlapping pot and disables time bonuses until another launch', () => {
  assert.equal(waveSendBonus(), 0, 'A zero initial pot earns no time bonus');
  sendWave(); game.tick(180); sendWave(); game.tick(180);
  assert.equal(waveClearBase, wavePlan(1).reward + wavePlan(2).reward);
  const leak = creeps[0];
  leak.pathIndex = levelMap.path.length - 1; leak.findNextStep();
  assert.equal(lives, 19);
  assert.equal(waveClearBase, 0);
  assert.ok(buildTicks > 0);
  assert.equal(waveSendBonus(), 0);
  const state = JSON.parse(JSON.stringify(game.saveState()));
  game.reset(); game.loadState(state);
  assert.equal(waveClearBase, 0, 'Saving cannot restore the forfeited pot');
  assert.equal(waveSendBonus(), 0);
  const balance = money;
  assert.equal(sendWave(), true);
  assert.equal(money, balance, 'Sending early cannot recover forfeited time credit');
  assert.equal(waveClearBase, wavePlan(3).reward, 'Only the new wave contributes to the new pot');
  assert.ok(waveSendBonus() > 0);
  const guardian = new BigBall(); guardian.pathIndex = levelMap.path.length - 1;
  guardian.findNextStep();
  assert.equal(lives, 16);
  assert.equal(waveClearBase, 0, 'A guardian escape also empties the pot');
});

test('a zero-base clear still shows its result and advances once without any reward', () => {
  sendWave(); game.tick();
  const leak = creeps[0];
  hopper = [];
  leak.move = () => { leak.pathIndex = levelMap.path.length - 1; leak.findNextStep(); };
  const balance = money;
  game.tick();
  assert.equal(lives, 19);
  assert.equal(waveClearPayout.base, 0);
  assert.equal(waveClearPayout.timeBonus, 0);
  assert.equal(money, balance);
  rewardClearedWaves(); game.tick(waveBonusPauseTicks - 1);
  assert.equal(waveCounter, 1);
  assert.equal(waveClearPayout.base, 0);
  game.tick();
  assert.equal(waveCounter, 2);
  assert.equal(waveClearPayout, null);
  assert.equal(money, balance, 'Zero-base results and their automatic launch pay nothing');
  assert.equal(waveClearBase, wavePlan(2).reward);
});
