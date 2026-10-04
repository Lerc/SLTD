const assert = require('node:assert/strict');
const {test, beforeEach} = require('node:test');
const game = require('../../srv/nodemain.js');
beforeEach(() => game.reset());
function enemy(Type = Shieldbug) {
  const c = new Type(); c.speed = 0; creeps.push(c); return c;
}
function advance(c, ticks) { for (let i = 0; i < ticks; i++) c.move(); }

test('shield impacts brighten the indicator, fade, retrigger, and exclude bypass damage', () => {
  const c = enemy();
  c.takeDamage(1, 'piercing'); assert.equal(c.shieldFlash, 0);
  c.takeDamage(0); assert.equal(c.shieldFlash, 0);
  const before = c.shield;
  c.takeDamage(1, 'energy');
  assert.equal(c.shieldFlash, 1); assert.equal(c.shieldHitPoints, before);
  advance(c, 15);
  assert.ok(c.shieldFlash > 0 && c.shieldFlash < 1);
  c.takeDamage(1); assert.equal(c.shieldFlash, 1);
  c.takeDamage(c.shield);
  assert.equal(c.shield, 0); assert.equal(c.shieldFlash, 1, 'Shield breaks still flash the indicator');
  const pointsLost = c.shieldHitPoints;
  c.takeDamage(1); assert.equal(c.shieldHitPoints, pointsLost, 'Unshielded health damage does not replace the shield impact');
  advance(c, 31); assert.equal(c.shieldFlash, 0);
});

test('shields wait after damage, recharge gradually, cap at capacity and pause with the game', () => {
  const c = enemy();
  c.takeDamage(5);
  const depleted = c.shield;
  assert.equal(c.damage, 0);
  assert.equal(c.shieldRechargeTicks, 180);
  advance(c, 180); assert.equal(c.shield, depleted);
  c.move(); assert.ok(c.shield > depleted && c.shield < c.maxShield);
  advance(c, 1000); assert.equal(c.shield, c.maxShield);
  c.takeDamage(2); advance(c, 70);
  c.takeDamage(1, 'piercing');
  assert.equal(c.shieldRechargeTicks, 180, 'Health damage also restarts recharge');
  advance(c, 40); const remaining = c.shieldRechargeTicks;
  c.takeDamage(0); assert.equal(c.shieldRechargeTicks, remaining, 'Zero damage is not a hit');
  globalThis.paused = true; game.tick(300);
  assert.equal(c.shieldRechargeTicks, remaining);
});

test('even a fractional shield blocks all new debuffs and their refreshes', () => {
  const c = enemy(); c.shield = 0.001;
  assert.equal(c.applySlow(.5, 100), false);
  assert.equal(c.applyBurn(100, .2), false);
  assert.equal(c.applyVulnerability(100), false);
  assert.equal(c.slowTicks + c.burnTicks + c.vulnerableTicks, 0);
  c.shield = 0;
  assert.equal(c.applySlow(.5, 100), true);
  assert.equal(c.applyBurn(100, .2), true);
  assert.equal(c.applyVulnerability(100), true);
  c.shield = c.maxShield;
  c.applySlow(.1, 500); c.applyBurn(500, 10); c.applyVulnerability(500);
  assert.equal(c.slowTicks, 100); assert.equal(c.slowFactor, .5);
  assert.equal(c.burnTicks, 100); assert.equal(c.burnPower, .2);
  assert.equal(c.vulnerableTicks, 100);
  const shield = c.shield;
  c.move();
  assert.equal(c.slowTicks, 99); assert.equal(c.burnTicks, 99); assert.equal(c.vulnerableTicks, 99);
  assert.ok(c.shield < shield, 'An existing burn continues damaging the returned shield');
  assert.equal(c.shieldRechargeTicks, c.shieldRechargeDelay - 1);
});

test('Capacitors wait ten seconds, restart the delay after hits, and charge to capacity', () => {
  const c = enemy(Capacitor);
  assert.equal(c.shield, 0);
  assert.equal(c.shieldRechargeDelay, 600);
  advance(c, c.shieldRechargeDelay);
  assert.equal(c.shield, 0, 'No shield during the full ten-second delay');
  c.move();
  assert.ok(c.shield > 0 && c.shield < c.maxShield);
  c.takeDamage(1);
  const shield = c.shield;
  advance(c, c.shieldRechargeDelay - 1);
  assert.equal(c.shield, shield);
  c.takeDamage(0.1, 'piercing');
  advance(c, c.shieldRechargeDelay);
  assert.equal(c.shield, shield, 'A later hit restarts the full delay');
  c.move();
  assert.ok(c.shield > shield);
  advance(c, 400);
  assert.equal(c.shield, c.maxShield);
});

test('a naturally charging shield does not cleanse an existing chill or vulnerability', () => {
  const c = enemy(Capacitor);
  const duration = c.shieldRechargeDelay + 120;
  c.applySlow(.5, duration); c.applyVulnerability(duration);
  advance(c, c.shieldRechargeDelay + 1);
  assert.ok(c.shield > 0);
  assert.equal(c.slowTicks, duration - c.shieldRechargeDelay - 1);
  assert.equal(c.vulnerableTicks, duration - c.shieldRechargeDelay - 1);
  assert.equal(c.slowFactor, .5);
  assert.equal(c.applySlow(.1, 500), false);
  const burning = enemy(Capacitor); burning.applyBurn(120, .01);
  advance(burning, 120);
  assert.equal(burning.shield, 0, 'Burn damage prevents recharge until it stops');
  assert.ok(burning.damage > 1);
  advance(burning, burning.shieldRechargeDelay);
  assert.ok(burning.shield > 0);
});

test('actual burn, frost and quake attacks respect shields, including shield-breaking hits', () => {
  for (const Type of [Incinerator, Inferno, Firestorm, Cryo, Quake]) {
    game.reset();
    const tower = new Type(3, 2); towers.push(tower);
    const c = enemy(); c.position = vadd(tower.position, v2(60, 0)); c.hitPoints = 10000;
    tower.target = c;
    tower.angle = Math.PI / 2;
    const shieldDamage = tower.power * (tower.behavior === 'burn' ?
      (tower.firingMode === 'directional' ? 1 / Flame.packetsPerShot : 1) : 2);
    const fireAndHit = () => {
      tower.fire();
      if (tower.firingMode === 'directional') bullets.at(-1).move();
    };
    c.shield = shieldDamage + 1;
    fireAndHit();
    assert.ok(Math.abs(c.shield - 1) < 1e-10, Type.name);
    assert.equal(c.slowTicks + c.burnTicks + c.vulnerableTicks, 0, Type.name);
    c.shield = shieldDamage;
    fireAndHit();
    assert.equal(c.shield, 0, Type.name);
    if (tower.behavior === 'burn') assert.ok(c.burnTicks > 0, Type.name);
    else assert.ok(c.slowTicks > 0, Type.name);
    if (tower.behavior === 'quake') assert.ok(c.vulnerableTicks > 0);
  }
});

test('shield overflow, energy weakness, piercing, and death retain their combat rules', () => {
  const c = enemy(); c.shield = 3;
  c.takeDamage(5, 'energy');
  assert.equal(c.shield, 0); assert.equal(c.damage, 3.5);
  c.shield = 8; c.takeDamage(2, 'piercing');
  assert.equal(c.shield, 8); assert.equal(c.damage, 5.5);
  c.takeDamage(1000, 'piercing');
  const shield = c.shield, cooldown = c.shieldRechargeTicks;
  advance(c, 500);
  assert.equal(c.shield, shield); assert.equal(c.shieldRechargeTicks, cooldown);
  assert.equal(c.applyBurn(30, 1), false);
});

test('new types enter their advertised waves and retain scaled shield state across saves', () => {
  for (const [wave, Type] of [[4, Shieldbug], [8, Skimmer], [9, Capacitor], [11, Bulwark]]) {
    assert.ok(wavePlan(wave).kinds.includes(Type));
  }
  for (const Type of [Shieldbug, Skimmer, Capacitor, Bulwark]) {
    globalThis.difficulty = 2;
    const c = enemy(Type);
    c.shield = c.maxShield / 2; c.takeDamage(1); advance(c, 12);
  }
  generateWave(9); generateWave(11);
  const before = [...creeps, ...hopper].map(c => [c.constructor.name, c.hitPoints, c.maxShield, c.shield, c.shieldRechargeTicks]);
  const state = game.saveState(); game.loadState(state);
  assert.deepEqual([...creeps, ...hopper].map(c => [c.constructor.name, c.hitPoints, c.maxShield, c.shield, c.shieldRechargeTicks]), before);
  const c = creeps[0], shield = c.shield;
  advance(c, c.shieldRechargeTicks); assert.equal(c.shield, shield);
  c.move(); assert.ok(c.shield > shield);
});
