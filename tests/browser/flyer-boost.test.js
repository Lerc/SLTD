// wsb run tests/browser/flyer-boost.test.js --app sltd --wait
const check = (condition, message) => { if (!condition) throw new Error(message); };
const near = (a, b) => check(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
startGame('foundry'); paused = true;
const flyer = new Flyer(); flyer.speed = 0;
for (let i = 0; i < 900; i++) flyer.move();
check(flyer.boostCharge === 1 && flyer.boostTicks === 0, 'Full bank after fifteen seconds');
flyer.speed = 2.5;
flyer.takeDamage(0.1);
flyer.move(); near(vlength(flyer.motion), 7.5);
flyer.speed = 0;
for (let i = 0; i < 59; i++) flyer.move();
near(flyer.boostCharge, 0.5);
flyer.speed = 2.5; flyer.move(); near(vlength(flyer.motion), 5);
flyer.speed = 0;
for (let i = 0; i < 59; i++) flyer.move();
check(flyer.boostCharge === 0 && flyer.boostTicks === 0, 'Burst spends the entire bank');
flyer.speed = 2.5; flyer.move(); near(vlength(flyer.motion), 2.5);

const canvas = document.createElement('canvas'); canvas.width = canvas.height = 240;
const context = canvas.getContext('2d');
const specimen = new Flyer({preview:true});
function picture(base = false, bars = false) {
  const previous = ctx;
  context.clearRect(0, 0, 240, 240);
  context.save(); context.translate(120, 120);
  try {
    ctx = context;
    if (bars) specimen.drawHealthBar();
    else if (base) Creep.prototype.draw.call(specimen);
    else specimen.draw();
  } finally { ctx = previous; context.restore(); }
  return canvas.toDataURL();
}
const emptyBar = picture(false, true);
specimen.boostCharge = 1;
check(picture(false, true) !== emptyBar, 'Energy bar shows the charged bank');
check(picture() === picture(true), 'A full idle bank does not show boost exhaust');
specimen.takeDamage(0.1);
check(picture() !== picture(true), 'Active boost draws exhaust');
specimen.boostCharge = 0.5; specimen.boostTicks = 60;
const fullTrail = picture();
specimen.boostCharge = 0.25;
check(picture() !== fullTrail, 'Exhaust shortens as the boost drains');
specimen.boostTicks = 0;
check(picture() === picture(true), 'Exhaust stops when the boost ends');

// Show empty, half charged, full idle, full boost and half boost at game scale.
for (let i = 0; i < 5; i++) {
  const creep = new Flyer(); creep.speed = 0;
  const chargeTicks = [0, 450, 900, 900, 900][i];
  for (let tick = 0; tick < chargeTicks; tick++) creep.move();
  if (i >= 3) creep.takeDamage(0.1);
  if (i === 4) for (let tick = 0; tick < 60; tick++) creep.move();
  creep.x = 180 + i * 180; creep.y = 620; creep.angle = 0; creep.hitFlash = 0;
  creeps.push(creep);
}
await gameControl.screenshot('flyer-boost-stages');
wslog({result:'PASS', rechargeSeconds:15, burstSeconds:2, initialSpeed:7.5, midpointSpeed:5, baseSpeed:2.5, energyBar:true, exhaust:true});
