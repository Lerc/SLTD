const check = (condition, message) => { if (!condition) throw new Error(message); };
startGame('foundry'); paused = true;
const random = emberSystem.random, burnRandom = burningEmberSystem.random;
emberSystem.random = burningEmberSystem.random = () => 0;
const tower = new Inferno(3, 6); tower.angle = Math.PI / 2; towers.push(tower);
const target = new BigBall(); target.hitPoints = 100000; target.position = vadd(tower.position, v2(170, 0));
creeps.push(target); tower.target = target;
const flame = new Flame(tower, target);
flame.move();
check(particleSystems.filter(p => p === emberSystem).length === 1, 'Flame registers the shared system once');
let active = emberSystem.particles.filter(p => p.active);
check(active.length === 1 && Math.abs(active[0].vx - flame.speed) < 1e-8 && Math.abs(active[0].vy) < 1e-8,
  'Flame ember inherits packet velocity');
const storm = new Firestorm(5, 9); storm.target = target; towers.push(storm); storm.fire();
const effect = particleSystems.find(p => p !== emberSystem); effect.move();
active = emberSystem.particles.filter(p => p.active);
check(active.length === 20, 'All sixteen firebrands and three vortex flames can emit');
check(active.some(p => p.vy > 7 && p.vx > 2), 'Falling firebrand embers inherit downward velocity');
check(particleSystems.filter(p => p === emberSystem).length === 1, 'Firestorm uses the same system');
target.applyBurn(180, 1, tower);
target.move();
check(emberSystem.particles.filter(p => p.active).length === 20, 'Burning creeps do not consume weapon slots');
check(burningEmberSystem.particles.filter(p => p.active).length === 1, 'Burning creeps emit into their own pool');
check(burningEmberSystem.particles.some(p => p.active && p.vx === target.motion.x && p.vy === target.motion.y),
  'Burning enemy ember inherits movement');
for (let i = 0; i < 500; i++) emitEmber(500, 500, 2, 0, 100);
check(emberSystem.particles.filter(p => p.active).length === 250, 'Weapon flames share the 250-ember cap');
check(particleSystems.filter(p => p === emberSystem).length === 1, 'Capacity pressure never creates another system');

target.move();
check(burningEmberSystem.particles.filter(p => p.active).length === 2, 'Burning creeps still emit when the weapon pool is full');
for (let i = 0; i < 600; i++) emitBurnEmber(500, 500, 2, 0, 100);
check(burningEmberSystem.particles.filter(p => p.active).length === 500, 'Burning pool has its own 500-particle cap');
check(particleSystems.filter(p => p === burningEmberSystem).length === 1, 'All burning creeps share one separate system');
emberSystem.reset();
emitEmber(500, 500, 2, 0, 100);
check(emberSystem.isActive(), 'Weapon flames still emit when the burning pool is full');
emberSystem.random = burningEmberSystem.random = () => .05;
check(!emitEmber(0, 0, 0, 0, 24), 'Weapon chance remains low');
burningEmberSystem.reset();
check(emitBurnEmber(500, 500, 0, 0, 24), 'Burning chance is higher for the same power');
emberSystem.random = burningEmberSystem.random = () => 0;

// Paint through a real canvas; check the fade and drawing state restoration.
const c = document.createElement('canvas').getContext('2d');
const alphas = [];
const recording = new Proxy(c, {get(object, key) {
  if (key === 'fill') return () => { alphas.push(object.globalAlpha); object.fill(); };
  const value = object[key]; return typeof value === 'function' ? value.bind(object) : value;
}, set(object, key, value) { object[key] = value; return true; }});
c.globalAlpha = .7; c.fillStyle = '#123456';
emberSystem.draw(recording);
check(Math.abs(c.globalAlpha - .7) < 1e-6 && c.fillStyle === '#123456', 'Ember drawing restores canvas state');
const bright = alphas[0]; alphas.length = 0;
for (let tick = 0; tick < 90; tick++) { emberSystem.move(); burningEmberSystem.move(); }
emberSystem.draw(recording);
check(alphas[0] < bright && alphas[0] > 0, 'Embers visibly fade before expiration');
const age = emberSystem.particles.find(p => p.active).age, burnAge = burningEmberSystem.particles.find(p => p.active).age;
mainGame();
check(emberSystem.particles.find(p => p.active).age === age && burningEmberSystem.particles.find(p => p.active).age === burnAge, 'Pause freezes both ember systems');
creeps.length = towers.length = bullets.length = 0;
particleSystems = globalThis.particleSystems = [emberSystem, burningEmberSystem];
betweenWaves = false;
mainGame_core(); check(!betweenWaves, 'Living embers keep the final combat effects active');
for (let tick = 0; tick < 200 && !betweenWaves; tick++) mainGame_core();
check(betweenWaves && !emberSystem.isActive() && !burningEmberSystem.isActive() && particleSystems.length === 0, 'Wave preparation resumes after embers finish');
emitEmber(200, 200, 0, 0, 100);
check(particleSystems[0] === emberSystem, 'Later flames reuse the same system after it drains');
emitBurnEmber(200, 200, 0, 0, 100);
check(particleSystems[1] === burningEmberSystem, 'Later burns reuse their drained system');
startGame('foundry'); paused = true;
check(!emberSystem.isActive() && emberSystem.available.length === 250, 'New game resets the entire pool');
check(!burningEmberSystem.isActive() && burningEmberSystem.available.length === 500, 'New game resets the burning pool too');
emberSystem.random = random; burningEmberSystem.random = burnRandom;

// Capture an actual stream and Firestorm after enough time for sparks to drift.
const source = new Inferno(3, 6); applyTowerLevel(source, 3); source.angle = Math.PI / 2;
const firestorm = new Firestorm(7, 10); applyTowerLevel(firestorm, 3);
const enemy = new BigBall(); enemy.position = vadd(source.position, v2(190, 0)); enemy.hitPoints = 100000; enemy.speed = .25;
towers.push(source, firestorm); creeps.push(enemy); source.target = firestorm.target = enemy;
for (let tick = 0; tick < 130; tick++) {
  if (tick % 5 === 0) source.fire();
  if (tick % 45 === 0) firestorm.fire();
  enemy.move();
  updateCombatActivity(); updatePersistenceCanvas();
  if (tick % 10 === 0) await new Promise(requestAnimationFrame);
}
check(emberSystem.isActive(), 'Live flame scene contains pooled embers');
await gameControl.screenshot('pooled-embers');
wslog({result: 'PASS', pools: [emberSystem.particles.length, burningEmberSystem.particles.length], active: emberSystem.particles.filter(p => p.active).length,
  sources: ['flame packets', 'firebrands', 'vortex flames', 'burning enemies'], fade: true, pause: true, reuse: true});
