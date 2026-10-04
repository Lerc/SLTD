const assert = require('node:assert/strict');
const {test, beforeEach} = require('node:test');
const game = require('../../srv/nodemain.js');
beforeEach(() => game.reset());
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
function flyer() {
  const c = new Flyer(); c.speed = 0; creeps.push(c); return c;
}
function advance(c, ticks) { for (let i = 0; i < ticks; i++) c.move(); }

test('Flyers enter empty, charge in fifteen seconds, and cap without accelerating', () => {
  const c = flyer();
  assert.equal(c.boostCharge, 0); assert.equal(c.boostTicks, 0);
  advance(c, 450); near(c.boostCharge, 0.5);
  advance(c, 450); assert.equal(c.boostCharge, 1);
  advance(c, 100); assert.equal(c.boostCharge, 1);
  c.speed = 2.5; c.move();
  near(vlength(c.motion), 2.5);
  assert.equal(c.speed, 2.5, 'Base speed stays unchanged');
});

test('a full bank gives three times speed and drains linearly over two seconds', () => {
  const c = flyer(); advance(c, 900); c.speed = 2.5;
  c.takeDamage(1);
  assert.equal(c.boostTicks, 120); near(c.movementSpeed, 7.5);
  c.move(); near(vlength(c.motion), 7.5); near(c.boostCharge, 119 / 120);
  // Stay on the initial route segment to isolate burst timing from routing.
  c.speed = 0; advance(c, 59);
  near(c.boostCharge, 0.5); assert.equal(c.boostTicks, 60);
  c.speed = 2.5; c.move(); near(vlength(c.motion), 5);
  c.speed = 0; advance(c, 59);
  assert.equal(c.boostCharge, 0); assert.equal(c.boostTicks, 0);
  c.speed = 2.5; c.move(); near(vlength(c.motion), 2.5);
  near(c.boostCharge, 1 / 900, 'Recharge begins after the burst');
});

test('partial banks last two seconds too; further hits cannot extend or strengthen a burst', () => {
  const c = flyer(); advance(c, 450); c.speed = 2.5;
  c.takeDamage(1, 'energy'); near(c.movementSpeed, 5);
  c.speed = 0; advance(c, 60);
  near(c.boostCharge, 0.25); assert.equal(c.boostTicks, 60);
  c.takeDamage(1, 'piercing');
  near(c.boostCharge, 0.25); assert.equal(c.boostTicks, 60);
  c.speed = 2.5; near(c.movementSpeed, 3.75);
  c.speed = 0; advance(c, 60);
  assert.equal(c.boostCharge, 0); assert.equal(c.boostTicks, 0);
  advance(c, 450); c.takeDamage(1);
  assert.equal(c.boostTicks, 120); near(c.boostCharge, 0.5);
});

test('empty banks, zero damage, blocked damage, lethal hits and dead Flyers do not boost', () => {
  const empty = flyer(); empty.takeDamage(1); assert.equal(empty.boostTicks, 0);
  const c = flyer(); advance(c, 900);
  c.takeDamage(0); c.takeDamage(-1); assert.equal(c.boostTicks, 0);
  c.armor = 1; c.takeDamage(1); assert.equal(c.boostTicks, 0);
  c.takeDamage(100, 'piercing'); assert.equal(c.dead, true);
  assert.equal(c.boostTicks, 0); advance(c, 300); assert.equal(c.boostCharge, 1);
});

test('ongoing burns trigger boosts before moving, while slows multiply boosted speed', () => {
  const c = flyer(); advance(c, 900); c.speed = 2.5;
  c.applySlow(0.5, 120); c.applyBurn(120, 0.01);
  c.move(); near(vlength(c.motion), 3.75);
  assert.equal(c.boostTicks, 119); near(c.boostCharge, 119 / 120);
  c.speed = 0; advance(c, 119);
  assert.equal(c.boostTicks, 0); assert.equal(c.boostCharge, 0);
  near(c.damage, 1.2); assert.equal(c.slowTicks, 0);
});

test('pause freezes recharge and discharge; double speed follows simulation time', () => {
  sendWave(); hopper.length = 0;
  const c = flyer();
  paused = true; game.tick(100); assert.equal(c.boostCharge, 0);
  paused = false; gameAccelerated = true; game.tick(225); near(c.boostCharge, 0.5);
  c.takeDamage(1);
  paused = true; game.tick(100);
  assert.equal(c.boostTicks, 120); near(c.boostCharge, 0.5);
  paused = false; game.tick(30);
  assert.equal(c.boostTicks, 60); near(c.boostCharge, 0.25);
});

test('save/load preserves charging, active bursts, queued banks and legacy defaults', () => {
  const charging = flyer(); advance(charging, 450);
  const boosting = flyer(); advance(boosting, 900); boosting.takeDamage(1); advance(boosting, 37);
  const queued = new Flyer(); queued.boostCharge = 0.25; hopper.push(queued);
  const state = JSON.parse(JSON.stringify(game.saveState()));
  game.loadState(state);
  near(creeps[0].boostCharge, 0.5); assert.equal(creeps[0].boostTicks, 0);
  near(creeps[1].boostCharge, 83 / 120); assert.equal(creeps[1].boostTicks, 83);
  near(hopper[0].boostCharge, 0.25);
  charging.move(); boosting.move();
  for (const [loaded, original] of [[creeps[0], charging], [creeps[1], boosting]]) {
    loaded.speed = 0; loaded.move();
    near(loaded.boostCharge, original.boostCharge); assert.equal(loaded.boostTicks, original.boostTicks);
  }
  for (const c of [...state.creeps, ...state.hopper]) { delete c.boostCharge; delete c.boostTicks; }
  game.loadState(state);
  for (const c of [...creeps, ...hopper]) {
    assert.equal(c.boostCharge, 0); assert.equal(c.boostTicks, 0);
  }
});
