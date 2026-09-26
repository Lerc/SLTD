// Run with browser-bridge on a freshly reloaded page.
const check = (condition, message) => { if (!condition) throw new Error(message); };
startGame('foundry'); paused = true;
const canvas = document.createElement('canvas'); canvas.width = canvas.height = 800;
const context = canvas.getContext('2d');

// Read the alpha actually used to paint, including drawMain's nested save/restore.
for (const [Type, TowerType] of [[Pea, Tower], [Laser, Zappy], [Rock, Stubby]]) {
  const tower = new TowerType(3, 2); tower.angle = Math.PI / 2;
  const target = new Basic(); target.position = vadd(tower.position, v2(220, 0));
  const shot = new Type(tower, target); shot.move(); target.dead = true;
  shot.move();
  check(!shot.dead, Type.name + ' survives target death');
  for (let tick = 0; tick < 100 && !shot.fadeTicks; tick++) shot.move();
  check(shot.fadeTicks > 0, Type.name + ' enters dissipation');
  const alpha = [];
  const recording = new Proxy(context, {get(object, key) {
    if (key === 'fill' || key === 'stroke') return (...args) => { alpha.push(object.globalAlpha); object[key](...args); };
    const value = object[key]; return typeof value === 'function' ? value.bind(object) : value;
  }, set(object, key, value) { object[key] = value; return true; }});
  const saved = ctx;
  try {
    ctx = recording; context.globalAlpha = .8;
    shot.drawMain(); shot.move(); shot.drawMain();
    check(Math.abs(context.globalAlpha - .8) < 1e-6, 'Restores drawing alpha');
  } finally { ctx = saved; }
  check(alpha.length === 2 && alpha[1] < alpha[0], Type.name + ' visibly fades');
}

// Last-target transformation must animate in the real game loop, with no creeps.
startGame('foundry'); paused = true; betweenWaves = false;
const tower = new Star(3, 6); applyTowerLevel(tower, 3); towers.push(tower);
const target = new Basic(); target.position = vadd(tower.position, v2(350, 0));
const shot = new Spiral(tower, target); shot.position = vadd(tower.position, v2(170, 0));
target.dead = true; bullets.push(shot);
mainGame_core();
check(bullets.length === 15 && bullets.every(b => b instanceof OrbitalFragment), 'Level three makes fifteen Orbital fragments');
check(!betweenWaves, 'Keeps combat active for the radial burst');
for (let tick = 0; tick < 11; tick++) { mainGame_core(); await new Promise(requestAnimationFrame); }
check(bullets.every(b => b.distanceTo(shot) > 30), 'Every fragment visibly travels radially');
await gameControl.screenshot('orbital-radial-burst');
for (let tick = 0; tick < 500 && !betweenWaves; tick++) mainGame_core();
check(bullets.length === 0 && betweenWaves, 'All fragments finish before preparation');

betweenWaves = false;
combatEffect(tower.position, '#204038');
mainGame_core();
check(!betweenWaves && particleSystems.length > 0, 'Finishing effects also keep running');
for (let tick = 0; tick < 200 && !betweenWaves; tick++) mainGame_core();
check(betweenWaves && particleSystems.length === 0, 'Returns to preparation once effects finish');
wslog({result:'PASS', fading:['Pea','Laser','Rock'], orbitalFragments:15, activityDrained:true});
