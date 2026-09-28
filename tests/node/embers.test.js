const assert = require('node:assert/strict');
const {test} = require('node:test');
const {EmberSystem} = require('../../srv/embers.js');

for (const capacity of [250, 500]) test(capacity + '-particle pool drops excess emissions and rescans inactive slots when exhausted', () => {
  const system = new EmberSystem({random: () => 0, capacity}), original = [...system.particles];
  for (let i = 0; i < capacity; i++) assert.ok(system.emit(i, 0, 1, 0, 100));
  assert.equal(system.available.length, 0);
  assert.equal(system.emit(999, 0, 1, 0, 100), false);
  assert.ok(system.particles.every(p => p.x !== 999), 'Full pool never overwrites a living ember');
  for (let tick = 0; tick < 120; tick++) system.move();
  assert.equal(system.isActive(), false);
  assert.equal(system.available.length, 0, 'Expiration marks inactive without rebuilding the free list');
  assert.ok(system.emit(999, 0, 1, 0, 100));
  assert.equal(system.available.length, capacity - 1, 'Next emission discovers reusable slots');
  assert.equal(system.particles.length, capacity);
  system.particles.forEach((p, i) => assert.equal(p, original[i]));
  system.reset();
  assert.equal(system.isActive(), false);
  assert.equal(system.available.length, capacity);
});

test('fresh random pushes change velocity while preserving inherited momentum', () => {
  const system = new EmberSystem({random: () => 0});
  system.emit(12, 34, 10, 0, 100);
  const p = system.particles.find(p => p.active);
  assert.equal(p.vx, 10); assert.equal(p.vy, 0);
  system.random = () => .25; // Push down, across the inherited motion.
  system.move();
  assert.ok(Math.abs(p.vx - 9.96) < 1e-10 && Math.abs(p.vy - .225) < 1e-10);
  assert.ok(p.x > 12 && p.y > 34);
  system.random = () => .75; // Next tick must pick up the opposite push.
  system.move();
  assert.ok(p.vx > 9 && p.vy < 0, 'New push changes direction without replacing forward momentum');
  system.random = () => .5;
  const vx = p.vx;
  system.move();
  assert.ok(p.vx > 0 && p.vx < vx - .225, 'Opposing push brakes motion rather than teleporting or reversing it');
});

test('random drift keeps moving and changing direction late in life', () => {
  const system = new EmberSystem();
  while (!system.isActive()) system.emit(0, 0, 0, 0, 100);
  const p = system.particles.find(p => p.active);
  p.life = 240;
  // Keep the motion sample independent of how many emission rolls were needed.
  let seed = 1;
  system.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let tick = 0; tick < 150; tick++) system.move();
  let distance = 0;
  const turns = new Set();
  for (let tick = 0; tick < 60; tick++) {
    const {x, y, vx, vy} = p;
    system.move();
    distance += Math.hypot(p.x - x, p.y - y);
    turns.add(Math.sign(vx * p.vy - vy * p.vx));
  }
  assert.ok(distance > 20, 'Late-life embers remain visibly in motion');
  assert.ok(turns.has(-1) && turns.has(1), 'Path meanders in both directions');
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});

test('stronger flames have a higher per-tick chance to emit', () => {
  const system = new EmberSystem({random: () => .01});
  assert.equal(system.emit(0, 0, 0, 0, 1), false);
  assert.equal(system.emit(0, 0, 0, 0, 24), true);
  assert.equal(system.emit(0, 0, 0, 0, 0), false);
});

test('lifetimes vary between two and four seconds and do not consume combat randomness', () => {
  const random = Math.random;
  Math.random = () => { throw new Error('Cosmetic effect consumed combat randomness'); };
  try {
    const system = new EmberSystem();
    for (let i = 0; i < 20000 && system.available.length; i++) system.emit(0, 0, 0, 0, 100);
    assert.equal(system.available.length, 0);
    assert.ok(system.particles.every(p => p.life >= 120 && p.life <= 240));
    assert.ok(new Set(system.particles.map(p => p.life)).size > 30);
    for (let i = 0; i < 119; i++) system.move();
    assert.ok(system.particles.every(p => p.active));
    for (let i = 119; i < 240; i++) system.move();
    assert.equal(system.isActive(), false);
  } finally { Math.random = random; }
});

test('burning creeps emit separately at a higher rate than the calibrated weapon flames', t => {
  const game = require('../../srv/nodemain.js');
  game.reset();
  const random = Math.random, oldEmit = globalThis.emitEmber, oldBurnEmit = globalThis.emitBurnEmber;
  let seed = 12345, tick = 0;
  const counts = Array(6).fill(0), burnCounts = Array(6).fill(0), system = new EmberSystem();
  const burning = new EmberSystem({capacity: 500, emissionRate: .14});
  try {
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    globalThis.emitEmber = (...args) => {
      const emitted = system.emit(...args);
      if (emitted && tick >= 90) counts[Math.floor((tick - 90) / 300)]++;
      return emitted;
    };
    globalThis.emitBurnEmber = (...args) => {
      const emitted = burning.emit(...args);
      if (emitted && tick >= 90) burnCounts[Math.floor((tick - 90) / 300)]++;
      return emitted;
    };
    for (let i = 0; i < 4; i++) {
      const tower = applyTowerLevel(new Inferno(3, 2 + i * 3), 6);
      tower.angle = Math.PI / 2; towers.push(tower);
      const target = new BigBall(); target.position = vadd(tower.position, v2(150, 0));
      target.hitPoints = 1e9; target.radius = 16; target.speed = 0; target.motion = v2(0, 0);
      creeps.push(target);
    }
    // Warm the streams, then sample six five-second windows. Real packets hit,
    // deflect, slow and expire; burning targets use their own pool.
    for (; tick < 90 + 300 * counts.length; tick++) {
      for (const target of creeps) target.move();
      for (const tower of towers) tower.move();
      for (const flame of bullets) flame.move();
      bullets = globalThis.bullets = bullets.filter(flame => !flame.dead);
      system.move(); burning.move();
    }
    const average = counts.reduce((sum, count) => sum + count, 0) / counts.length;
    const burnAverage = burnCounts.reduce((sum, count) => sum + count, 0) / burnCounts.length;
    assert.ok(average >= 50 && average <= 80, 'Weapon emission rate stays at its previous setting');
    assert.ok(burnAverage >= 120 && burnAverage <= 180, 'Burning creeps have a higher independent emission rate');
    t.diagnostic('Average births / 5s: weapon flames ' + average.toFixed(1) + ', burning creeps ' + burnAverage.toFixed(1));
  } finally {
    Math.random = random;
    if (oldEmit === undefined) delete globalThis.emitEmber;
    else globalThis.emitEmber = oldEmit;
    if (oldBurnEmit === undefined) delete globalThis.emitBurnEmber;
    else globalThis.emitBurnEmber = oldBurnEmit;
    game.reset();
  }
});
