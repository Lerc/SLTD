const assert = require('node:assert/strict');
const {test, beforeEach} = require('node:test');
const game = require('../../srv/nodemain.js');
beforeEach(() => game.reset());

function scene(Type = Tower) {
  const tower = new Type(3, 2); tower.angle = Math.PI / 2; towers.push(tower);
  const target = new BigBall(); target.hitPoints = 100000;
  target.position = vadd(tower.position, v2(220, 0)); creeps.push(target);
  return {tower, target};
}
function finish(shot, limit = 500) {
  for (let i = 0; i < limit && !shot.dead; i++) shot.move();
  assert.ok(shot.dead, 'Projectile eventually finishes');
}

test('selling a firing Sentry preserves its shot and combat result through a JSON reload', () => {
  assert.ok(game.placeTower('Tower', 3, 2).success);
  assert.ok(sendWave());
  for (let tick = 0; tick < 300 && !bullets.length; tick++) game.tick();
  assert.equal(bullets.length, 1);
  assert.ok(sellTower(towers[0]));
  const state = JSON.parse(JSON.stringify(game.saveState()));
  game.tick(120);
  const expected = {damage: creeps.map(c => c.damage), money, lives, score};
  game.loadState(state);
  assert.equal(towers.length, 0, 'Reload never places a sold tower back on the map');
  assert.equal(bullets.length, 1, 'The in-flight shot survives');
  game.tick(120);
  assert.deepEqual({damage: creeps.map(c => c.damage), money, lives, score}, expected);
});

test('all projectile types retain their sold source and next movement', () => {
  for (const [TowerType, Shot] of [[Tower, Pea], [Stubby, Rock], [Zappy, Laser], [Star, Spiral], [Star, OrbitalFragment], [Incinerator, Flame], [Thumper, Woosh]]) {
    game.reset();
    const {tower, target} = scene(TowerType);
    applyTowerLevel(tower, 3);
    const shot = new Shot(tower, target); bullets.push(shot);
    shot.move();
    assert.ok(sellTower(tower));
    towers.push(new Tower(5, 4));
    const state = JSON.parse(JSON.stringify(game.saveState()));
    shot.move();
    const expected = {position: shot.position, motion: shot.motion, age: shot.age, damage: shot.damage};
    game.loadState(state);
    assert.equal(bullets.length, 1, Shot.name);
    const restored = bullets[0];
    assert.ok(restored instanceof Shot);
    assert.ok(restored.source instanceof TowerType);
    assert.equal(restored.source.level, 3);
    assert.deepEqual(restored.source.position, tower.position);
    assert.ok(!towers.includes(restored.source), 'Sold sources stay detached');
    restored.move();
    assert.deepEqual({position: restored.position, motion: restored.motion, age: restored.age, damage: restored.damage}, expected, Shot.name);
  }
});

test('flames and ongoing burns share one detached source across repeated reloads', () => {
  const {tower, target} = scene(Incinerator);
  target.applyBurn(180, 0.25, tower);
  bullets.push(new Flame(tower));
  assert.ok(sellTower(tower));
  game.loadState(JSON.parse(JSON.stringify(game.saveState())));
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].source, creeps[0].burnSource);
  const source = bullets[0].source;
  creeps[0].takeDamage(2, 'fire', source);
  assert.ok(Number.isFinite(source.damageDealt) && source.damageDealt > 0);
  bullets.length = 0;
  game.loadState(JSON.parse(JSON.stringify(game.saveState())));
  assert.equal(towers.length, 0);
  assert.equal(creeps[0].burnSource.damageDealt, source.damageDealt, 'Burn credit survives after the last shot expires');
});

test('older saves still restore shots and burn credit from placed towers', () => {
  const {tower, target} = scene(Incinerator);
  target.applyBurn(180, 0.25, tower);
  bullets.push(new Flame(tower));
  const state = JSON.parse(JSON.stringify(game.saveState()));
  delete state.detachedSources;
  for (const bullet of state.bullets) delete bullet.sourceDetachedIndex;
  for (const creep of state.creeps) delete creep.burnSourceDetachedIndex;
  game.loadState(state);
  assert.equal(towers.length, 1);
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].source, towers[0]);
  assert.equal(creeps[0].burnSource, towers[0]);
});

test('Sentry shots finish at the lost target position, then visibly dissipate', () => {
  const {tower, target} = scene();
  const shot = new Pea(tower, target); shot.move();
  target.dead = true;
  shot.move();
  assert.ok(!shot.dead, 'Target death must not delete a shot');
  for (let i = 0; i < 80 && !shot.fadeTicks; i++) shot.move();
  assert.ok(shot.fadeTicks > 0 && !shot.dead);
  assert.ok(shot.distanceTo(target) < 1);
  assert.equal(target.damage, 0);
  finish(shot);
});

test('Cannon shots retarget living creeps and still deal physical damage', () => {
  const {tower, target} = scene(Stubby);
  const other = new BigBall(); other.hitPoints = 100000;
  other.position = vadd(target.position, v2(0, 80)); creeps.push(other);
  const shot = new Rock(tower, target);
  target.dead = true; shot.move();
  assert.equal(shot.target, other);
  finish(shot);
  assert.ok(other.damage > 0);
});

test('Cannon direction oscillates twice per second within twenty degrees without heading drift', () => {
  const {tower, target} = scene(Stubby);
  target.position = vadd(tower.position, v2(10000, 0));
  const shot = new Rock(tower, target);
  // Hold steering constant to measure the oscillation independently of homing.
  Object.defineProperty(shot, 'homingStrength', {value:0});
  const angles=[];
  for (let tick=0;tick<90;tick++) {
    shot.move();
    const delta=vangle(shot.motion)-tower.angle;
    angles.push(Math.atan2(Math.sin(delta),Math.cos(delta))*180/Math.PI);
    assert.ok(Math.abs(Math.hypot(shot.motion.x,shot.motion.y)-shot.speed)<1e-10,'Speed stays constant');
  }
  assert.ok(Math.max(...angles)>19.8 && Math.max(...angles)<=20);
  assert.ok(Math.min(...angles)<-19.8 && Math.min(...angles)>=-20);
  for (let i=0;i<60;i++) assert.ok(Math.abs(angles[i]-angles[i+30])<1e-10,'Heading repeats every 30 ticks');
  for (const tick of [15,30,45,60,75,90]) assert.ok(Math.abs(angles[tick-1])<1e-10,'Returns to the underlying heading each half-cycle');
});

test('Cannon save/load preserves oscillation phase and the next homing movement', () => {
  const {tower,target}=scene(Stubby);
  const shot=new Rock(tower,target); bullets.push(shot);
  for(let i=0;i<11;i++) shot.move();
  const state=game.saveState();
  shot.move();
  const expected={position:shot.position,motion:shot.motion,age:shot.age};
  game.loadState(state);
  const restored=bullets[0]; restored.move();
  assert.deepEqual({position:restored.position,motion:restored.motion,age:restored.age},expected);
});

test('Pulse shots drift and fade rather than snapping to another enemy', () => {
  const {tower, target} = scene(Zappy);
  const shot = new Laser(tower, target); shot.move();
  const x = shot.x; target.dead = true; shot.move();
  assert.ok(!shot.dead && shot.fadeTicks > 0);
  assert.ok(shot.x > x);
  finish(shot, 30);
});

test('Orbital loss produces a level-scaled radial fragment burst with random living targets', () => {
  for (const level of [1, 4]) {
    game.reset();
    const {tower, target} = scene(Star); tower.level = level;
    const enemies = [new Basic(), new Basic(), new Basic()];
    enemies.forEach((c, i) => { c.position = vadd(tower.position, v2(300, 100 * i)); creeps.push(c); });
    const shot = new Spiral(tower, target); shot.position = vadd(tower.position, v2(100, 50));
    bullets.push(shot); target.dead = true;
    const random = Math.random; let sample = 0;
    try { Math.random = () => ((sample++ % 3) + .5) / 3; shot.move(); }
    finally { Math.random = random; }
    const fragments = bullets.filter(b => b instanceof OrbitalFragment);
    assert.equal(fragments.length, 6 + 3 * level);
    assert.ok(shot.dead);
    assert.ok(fragments.every(b => b.launchTicks >= 50 && b.launchTicks <= 74));
    assert.ok(new Set(fragments.map(b => b.launchTicks)).size > 1);
    assert.equal(new Set(fragments.map(b => b.target)).size, 3);
    assert.ok(fragments.every(b => enemies.includes(b.target)));
    assert.ok(Math.abs(fragments.reduce((sum, b) => sum + b.damage, 0) - shot.damage) < 1e-9);
    const motions = fragments.map(b => {
      assert.deepEqual(b.position, shot.position); b.move(); return vdiff(b.position, shot.position);
    });
    assert.ok(Math.abs(motions.reduce((sum, v) => sum + v.x, 0)) < 1e-8);
    assert.ok(Math.abs(motions.reduce((sum, v) => sum + v.y, 0)) < 1e-8);
    shot.move();
    assert.equal(bullets.filter(b => b instanceof OrbitalFragment).length, fragments.length, 'Transforms only once');
  }
});

test('Orbital fragments gradually turn during launch, then hit their target', () => {
  const {tower, target} = scene(Star);
  const shot = new OrbitalFragment(tower, target);
  shot.motion = v2(0, -shot.speed);
  const turnFraction = () => {
    const heading = vangle(shot.motion);
    const desired = vangle(vdiff(target.position, shot.position));
    const error = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
    shot.move();
    const turn = vangle(shot.motion) - heading;
    return Math.atan2(Math.sin(turn), Math.cos(turn)) / error;
  };
  assert.equal(turnFraction(), 0, 'First step leaves the burst radially');
  const early = turnFraction();
  while (shot.launchTicks > shot.launchDuration / 2) shot.move();
  const middle = turnFraction();
  while (shot.launchTicks > 1) shot.move();
  const late = turnFraction();
  const full = turnFraction();
  assert.ok(early > 0 && early < middle && middle < late && late < full);
  assert.ok(Math.abs(full - 0.12) < 1e-10);
  finish(shot);
  assert.ok(target.damage > 0);
});

test('save/load preserves a fragment\'s randomized homing phase and next movement', () => {
  const {tower, target} = scene(Star);
  const shot = new OrbitalFragment(tower, target);
  shot.motion = v2(0, -shot.speed);
  for (let i = 0; i < 15; i++) shot.move();
  bullets.push(shot);
  game.loadState(JSON.parse(JSON.stringify(game.saveState())));
  const restored = bullets[0];
  assert.ok(restored instanceof OrbitalFragment);
  assert.equal(restored.launchTicks, shot.launchTicks);
  assert.equal(restored.launchDuration, shot.launchDuration);
  shot.move(); restored.move();
  assert.deepEqual(restored.position, shot.position);
  assert.deepEqual(restored.motion, shot.motion);
});

test('older saves without active wave records drain Orbital bursts before preparation', () => {
  const {tower, target} = scene(Star);
  bullets.push(new Spiral(tower, target)); target.dead = true;
  creeps.length = 0; betweenWaves = false;
  game.tick();
  assert.equal(betweenWaves, false);
  assert.equal(bullets.length, 9);
  for (let i = 0; i < 500 && !betweenWaves; i++) game.tick();
  assert.equal(betweenWaves, true);
  assert.equal(bullets.length, 0);
  assert.equal(waveCounter, 2);
  game.tick(5); assert.equal(waveCounter, 2, 'Wave advances exactly once');
});

test('preparation updates projectiles from older saves, and pause still stops them', () => {
  const {tower} = scene(Thumper); creeps.length = 0;
  const shot = new Woosh(tower); bullets.push(shot);
  paused = true; game.tick(3); assert.equal(shot.age, 0);
  paused = false; game.tick(3); assert.equal(shot.age, 3);
  game.tick(40); assert.equal(bullets.length, 0);
});

test('older saves without active wave records drain visual effects before preparation', () => {
  betweenWaves = false;
  let remaining = 3;
  particleSystems.push({move() { remaining--; }, isActive() { return remaining > 0; }});
  game.tick(); assert.equal(betweenWaves, false);
  game.tick(3); assert.equal(betweenWaves, true);
  assert.equal(particleSystems.length, 0);
});

test('a launched wave pays out while its last Orbital burst finishes, then launches once', () => {
  assert.ok(sendWave());
  const {tower, target} = scene(Star);
  bullets.push(new Spiral(tower, target)); target.dead = true;
  creeps.length = hopper.length = backlog.length = 0;
  const balance = money, base = waveClearBase, timeBonus = Math.ceil((buildTicks - 1) / 60);
  game.tick();
  assert.equal(bullets.length, 9);
  assert.equal(waveClearPayout.age, 0, 'Clear presentation starts with fragments still alive');
  assert.equal(money, balance + base + timeBonus);
  const awarded = money;
  game.tick(waveBonusPauseTicks - 1);
  assert.equal(bullets.length, 0, 'Fragments continue moving and finish during the presentation');
  assert.equal(waveCounter, 1);
  assert.equal(waveClearPayout.age, waveBonusPauseTicks - 1);
  assert.equal(money, awarded);
  game.tick();
  assert.equal(waveCounter, 2);
  assert.equal(waveClearPayout, null);
  game.tick(); assert.equal(waveCounter, 2);
});

test('a launched wave pays once while visual effects finish during the clear presentation', () => {
  assert.ok(sendWave());
  creeps.length = hopper.length = backlog.length = 0;
  let remaining = 3;
  particleSystems.push({move() { remaining--; }, isActive() { return remaining > 0; }});
  game.tick();
  assert.ok(waveClearPayout && particleSystems.length === 1);
  const awarded = money;
  game.tick(2);
  assert.equal(particleSystems.length, 0);
  assert.equal(waveClearPayout.age, 2);
  assert.equal(money, awarded);
});

test('save/load preserves targetless flight, dissipation, and radial launch state', () => {
  const {tower, target} = scene();
  const pea = new Pea(tower, target), rock = new Rock(tower, target), laser = new Laser(tower, target);
  pea.move(); laser.move(); target.dead = true;
  pea.move(); laser.move(); rock.launchTicks = 8; rock.motion = v2(-3, 0);
  bullets.push(pea, rock, laser); creeps.length = 0;
  const state = JSON.parse(JSON.stringify(game.saveState())); game.loadState(state);
  assert.equal(bullets.length, 3);
  assert.deepEqual(bullets[0].lastTargetPosition, pea.lastTargetPosition);
  assert.equal(bullets[2].fadeTicks, laser.fadeTicks);
  assert.equal(bullets[1].launchTicks, 8);
  assert.deepEqual(bullets[1].motion, rock.motion);
  bullets.forEach(b => finish(b));
});
