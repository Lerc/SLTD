// Run on a fresh page: wsb run tests/browser/firing-effects.test.js --app sltd --wait
const check = (condition, message) => { if (!condition) throw new Error(message); };
startGame('foundry'); paused = true;
const canvas = document.createElement('canvas');
canvas.width = canvas.height = 800;
const context = canvas.getContext('2d');
const types = towerInfo.filter(info => info.type.prototype instanceof Specialist);
function setup(Type) {
  towers.length = creeps.length = bullets.length = particleSystems.length = 0;
  emberSystem.reset();
  burningEmberSystem.reset();
  const tower = new Type(3, 2);
  const enemy = new Basic();
  enemy.x = tower.x + 140; enemy.y = tower.y + 30; enemy.hitPoints = 100000;
  towers.push(tower); creeps.push(enemy); tower.target = enemy;
  tower.angle = vangle(vdiff(enemy.position, tower.position));
  return {tower, enemy};
}
for (const {type} of types) {
  const {tower, enemy} = setup(type);
  tower.fire();
  if (tower.firingMode === 'directional') {
    check(enemy.damage === 0, type.name + ' waits for flame contact');
    check(bullets.length === 1 && bullets[0] instanceof Flame, type.name + ' emits a flame');
    const flame = bullets[0];
    const savedContext = ctx;
    try {
      ctx = context;
      for (let tick = 0; tick < 120 && !flame.dead; tick++) {
        context.globalAlpha = 0.7; context.lineWidth = 11;
        flame.drawMain();
        check(Math.abs(context.globalAlpha - 0.7) < .00001 && context.lineWidth === 11, type.name + ' restores flame drawing state');
        flame.move();
      }
    } finally { ctx = savedContext; }
    check(enemy.damage > 0 && enemy.burnTicks > 0, type.name + ' burns on contact');
    check(flame.dead, type.name + ' flame expires');
    continue;
  }
  check(enemy.damage > 0, type.name + ' applies damage');
  check(particleSystems.length > 0, type.name + ' creates an effect');
  for (let tick = 0; tick < 300; tick++) {
    for (const effect of particleSystems) {
      context.globalAlpha = 0.7; context.lineWidth = 11;
      effect.draw(context);
      check(Math.abs(context.globalAlpha - 0.7) < 0.00001 && context.lineWidth === 11, type.name + ' restores drawing state');
      effect.move();
    }
    particleSystems = globalThis.particleSystems = particleSystems.filter(p => p.isActive());
  }
  check(particleSystems.length === 0, type.name + ' expires');
}
const {tower:prism, enemy} = setup(Prism);
for (let i = 0; i < 15; i++) {
  prism.fire();
  enemy.x += 2;
  for (const effect of particleSystems) effect.move();
}
check(prism.focus === 4, 'Prism reaches full focus');
check(particleSystems.length === 1, 'Prism refreshes one continuous effect');
// Observe the actual beam endpoint as a moving target is tracked.
const segments = [];
const recording = new Proxy(context, {get(object, key) {
  if (key === 'lineTo') return (x, y) => segments.push({x, y});
  const value = object[key]; return typeof value === 'function' ? value.bind(object) : value;
}, set(object, key, value) { object[key] = value; return true; }});
particleSystems[0].draw(recording);
check(segments.some(p => p.x === enemy.x && p.y === enemy.y), 'Prism tracks a moving target');
enemy.dead = true;
for (let i = 0; i < 6; i++) particleSystems[0].move();
check(!particleSystems[0].isActive(), 'Prism releases a dead target');
const {tower:repeater} = setup(Repeater);
for (let i = 0; i < 100; i++) repeater.fire();
check(particleSystems.length === 64, 'Effects obey the shared capacity bound');
startGame('foundry'); paused = true;
wslog({result:'PASS',types:types.map(i=>i.type.name),continuousPrism:true,boundedEffects:true});
