const assert = require('node:assert/strict');
const game = require('../../srv/nodemain.js');
game.reset();
// Record the actual specialist draw geometry after its rotation. This catches
// a sideways barrel even when aiming and projectile direction are correct.
for (const info of towerInfo.filter(i => i.type.prototype instanceof Specialist)) {
  const tower = new info.type(3, 2);
  for (const direction of [v2(1,0), v2(0,1), v2(-1,0), v2(0,-1)]) {
    const target = new Basic(); target.position = vadd(tower.position, vscale(direction, 100));
    globalThis.creeps = [target];
    tower.cooldown = 100;
    tower.move();
    let rotation = 0, barrel;
    globalThis.ctx = {
      drawSprite() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
      rotate(a) { rotation += a; },
      fillRect(x,y,w,h) {
        if (Math.max(w,h) / Math.min(w,h) < 3) return;
        const p = v2(x+w/2, y+h/2);
        barrel = v2(p.x*Math.cos(rotation)-p.y*Math.sin(rotation), p.x*Math.sin(rotation)+p.y*Math.cos(rotation));
      }
    };
    tower.draw();
    const forward = vnormalize(barrel);
    const alignment = forward.x*direction.x + forward.y*direction.y;
    assert.ok(alignment > .999, `${info.name}: barrel alignment ${alignment.toFixed(3)}, expected 1`);
    const muzzle = vnormalize(tower.bulletsComeOutHere);
    assert.ok(muzzle.x*direction.x + muzzle.y*direction.y > .999, 'Muzzle follows the same direction');
  }
}
globalThis.ctx = null;
console.log('PASS all specialist barrels and muzzles align in all four directions');
