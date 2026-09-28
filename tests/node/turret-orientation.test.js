const assert = require('node:assert/strict');
const game = require('../../srv/nodemain.js');
game.reset();
// Record each layer's transform: bases stay fixed, directional sprites point
// north locally, and radial emitters fire at the tower center without turning.
for (const info of towerInfo.filter(i => i.type.prototype instanceof Specialist)) {
  const tower = new info.type(3, 2);
  const body = Assets[info.type.name + 'Body'] = {};
  const turret = Assets[info.type.name + 'Turret'] = {};
  for (const direction of [v2(1,0), v2(0,1), v2(-1,0), v2(0,-1)]) {
    const target = new Basic(); target.position = vadd(tower.position, vscale(direction, 100));
    globalThis.creeps = [target];
    tower.cooldown = 100;
    for (let tick = 0; tick < 60; tick++) tower.move();
    let rotation = 0, barrel, stack = [], layers = [];
    globalThis.ctx = {
      save() { stack.push(rotation); },
      restore() { rotation = stack.pop(); },
      rotate(a) { rotation += a; },
      drawSprite(image) {
        layers.push(image);
        if (image === body) assert.equal(rotation, 0, 'Body stays fixed');
        if (image === turret) barrel = v2(Math.sin(rotation), -Math.cos(rotation));
      }
    };
    tower.draw();
    assert.deepEqual(layers, [body, turret], 'Both layers draw in order');
    assert.equal(rotation, 0, 'Draw restores the transform');
    if (tower.firingMode === 'area') {
      assert.deepEqual(barrel, v2(0, -1), 'Radial emitter stays fixed');
      assert.deepEqual(tower.bulletsComeOutHere, v2(0, 0), 'Area effect starts at center');
      continue;
    }
    const forward = vnormalize(barrel);
    const alignment = forward.x*direction.x + forward.y*direction.y;
    assert.ok(alignment > .999, `${info.name}: barrel alignment ${alignment.toFixed(3)}, expected 1`);
    const muzzle = vnormalize(tower.bulletsComeOutHere);
    assert.ok(muzzle.x*direction.x + muzzle.y*direction.y > .999, 'Muzzle follows the same direction');
  }
}
globalThis.ctx = null;
console.log('PASS all specialist barrels and muzzles align in all four directions');
