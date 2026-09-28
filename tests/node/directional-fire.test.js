const assert = require('node:assert/strict');
const {test, beforeEach} = require('node:test');
const game = require('../../srv/nodemain.js');
beforeEach(() => game.reset());

function enemy(tower, angle, distance = 170) {
  const target = new Basic();
  target.position = vadd(tower.position, vFromAngle(angle, distance));
  target.hitPoints = 10000;
  target.radius = 12;
  creeps.push(target);
  return target;
}
function error(a, b) { return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))); }

test('point weapons turn progressively and hold fire until within nine degrees', () => {
  for (const info of towerInfo) {
    game.reset();
    const tower = new info.type(3, 2);
    if (tower.firingMode !== 'point') continue;
    const target = enemy(tower, Math.PI / 2, (tower.range + tower.minimumRange) / 2);
    tower.angle = 0;
    tower.move();
    assert.ok(tower.angle > 0 && tower.angle < Math.PI / 2, info.name);
    assert.equal(tower.cooldown, 0, info.name + ' waits to align');
    assert.equal(target.damage, 0);
    let previousError = error(tower.angle, Math.PI / 2);
    for (let tick = 0; tick < 60 && tower.cooldown === 0; tick++) {
      tower.move();
      const nextError = error(tower.angle, Math.PI / 2);
      assert.ok(nextError < previousError);
      if (nextError > Math.PI * .05) assert.equal(tower.cooldown, 0);
      previousError = nextError;
    }
    assert.ok(tower.cooldown > 0, info.name + ' eventually fires');
    assert.ok(error(tower.angle, Math.PI / 2) <= Math.PI * .05);
  }
});

test('turning crosses north by the shortest arc in either direction and retains idle heading', () => {
  for (const sign of [-1, 1]) {
    game.reset();
    const tower = new Tower(3, 2);
    tower.angle = sign * .1;
    enemy(tower, -sign * .1);
    tower.cooldown = 100;
    tower.move();
    assert.ok(error(tower.angle, sign * .07) < 1e-10);
    creeps.length = 0;
    const angle = tower.angle;
    tower.move();
    assert.equal(tower.angle, angle);
    assert.equal(tower.target, null);
  }
});

test('flame streams fire immediately along the turning barrel; area weapons need no alignment', () => {
  for (const Type of [Incinerator, Inferno, Thumper, Cryo, Quake]) {
    game.reset();
    const tower = new Type(3, 2);
    const target = enemy(tower, Math.PI / 2, 120);
    tower.angle = 0;
    tower.move();
    assert.ok(tower.cooldown > 0, Type.name);
    assert.ok(error(tower.angle, Math.PI / 2) > Math.PI * .05);
    if (tower.firingMode === 'directional') {
      const flame = bullets[0];
      assert.ok(flame instanceof Flame);
      assert.equal(flame.angle, tower.angle);
      assert.equal(target.damage, 0, 'No remote damage on launch');
      const initialAngle = flame.angle;
      for (let tick = 0; tick < 15; tick++) tower.move();
      assert.ok(bullets.length > 1, 'Stream continues while turning');
      assert.equal(flame.angle, initialAngle, 'Emitted flames do not follow the barrel');
    }
  }
});

test('flames continue beyond a hit, deflect and slow, and strike each enemy only once', () => {
  const tower = new Incinerator(3, 2);
  tower.angle = Math.PI / 2;
  const target = enemy(tower, tower.angle, 125);
  tower.target = target;
  tower.fire();
  const flame = bullets[0], speed = flame.speed, angle = flame.angle;
  for (let tick = 0; tick < 20 && target.damage === 0; tick++) flame.move();
  assert.ok(target.damage > 0);
  assert.ok(target.burnTicks > 0);
  assert.ok(flame.speed < speed);
  assert.ok(error(flame.angle, angle) >= .08 && error(flame.angle, angle) <= .26);
  assert.ok(!flame.dead);
  const damage = target.damage;
  const second = enemy(tower, 0);
  second.position = vadd(flame.position, vFromAngle(flame.angle, 85));
  for (let tick = 0; tick < 30 && second.damage === 0; tick++) flame.move();
  assert.ok(second.damage > 0, 'Hits another enemy beyond the first');
  assert.ok(flame.x > target.x, 'Travels beyond the selected enemy');
  assert.equal(target.damage, damage, 'One direct hit per packet per enemy');
  for (let tick = 0; tick < 200; tick++) flame.move();
  assert.equal(flame.dead, true, 'Packets have a bounded lifetime');
});

test('flames ignore target movement/death and do not tunnel through small enemies', () => {
  const tower = new Inferno(3, 2);
  tower.angle = Math.PI / 2;
  tower.target = enemy(tower, tower.angle);
  tower.fire();
  tower.target.dead = true;
  tower.target.y += 200;
  const flame = bullets[0], y = flame.y;
  const crossing = enemy(tower, tower.angle, 110);
  crossing.radius = 1;
  flame.speed = 100;
  flame.move();
  assert.ok(crossing.damage > 0);
  assert.ok(!flame.dead);
  assert.ok(flame.x > crossing.x);
  assert.ok(Math.abs(flame.y - y) < 30, 'Does not home toward the moved target');
});

test('save/load retains direction, slowdown, burn and hit history without a target', () => {
  const tower = new Inferno(3, 2);
  towers.push(tower);
  tower.angle = Math.PI / 2;
  const target = enemy(tower, tower.angle, 100);
  tower.target = target;
  tower.fire();
  const flame = bullets[0];
  while (target.damage === 0) flame.move();
  const state = JSON.parse(JSON.stringify(game.saveState()));
  game.loadState(state);
  const loaded = bullets[0];
  for (const key of ['x', 'y', 'age', 'angle', 'speed', 'distance', 'range', 'radius', 'damage', 'burnPower', 'burnDuration']) {
    assert.equal(loaded[key], flame[key], key);
  }
  assert.ok(loaded.hitEnemies.has(creeps[0]));
  const damage = creeps[0].damage;
  loaded.move();
  assert.equal(creeps[0].damage, damage);
  creeps.length = 0;
  game.loadState(JSON.parse(JSON.stringify(game.saveState())));
  assert.equal(bullets.length, 1);
  bullets[0].move();
  assert.ok(!bullets[0].dead);
});
