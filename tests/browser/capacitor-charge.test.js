// wsb run tests/browser/capacitor-charge.test.js --app sltd --wait
const check = (condition, message) => { if (!condition) throw new Error(message); };
startGame('foundry'); paused = true;
const canvas = document.createElement('canvas');
canvas.width = canvas.height = 240;
const context = canvas.getContext('2d');
function picture(creep, base = false) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(120, 120);
  if (base) Creep.prototype.drawShield.call(creep, context);
  else creep.drawShield(context);
  context.restore();
  return canvas.toDataURL();
}
function advance(creep, ticks) { for (let i = 0; i < ticks; i++) creep.move(); }
const capacitor = new Capacitor(); capacitor.speed = 0;
check(capacitor.shieldRechargeDelay === 600, 'Capacitor waits ten seconds before charging');
advance(capacitor, capacitor.shieldRechargeDelay - 1);
check(capacitor.shield === 0, 'Capacitor stays unshielded during the delay');
check(picture(capacitor) === picture(capacitor, true), 'Waiting has no charging arcs');
advance(capacitor, 2);
check(capacitor.shield > 0, 'Shield starts filling after the delay');
check(picture(capacitor) !== picture(capacitor, true), 'Charging adds visible pixels');
const charging = picture(capacitor);
advance(capacitor, 7);
check(picture(capacitor) !== charging, 'Charging effect animates');
const frozen = picture(capacitor);
await new Promise(resolve => setTimeout(resolve, 100));
check(picture(capacitor) === frozen, 'Charging animation stays still when simulation is paused');
capacitor.takeDamage(0.1, 'piercing');
check(picture(capacitor) === picture(capacitor, true), 'Damage immediately stops charging arcs');
advance(capacitor, capacitor.shieldRechargeDelay + 1);
check(picture(capacitor) !== picture(capacitor, true), 'Charging arcs return after the full delay');
advance(capacitor, 400);
check(capacitor.shield === capacitor.maxShield, 'Shield reaches full capacity');
check(picture(capacitor) === picture(capacitor, true), 'Full shields have no charging arcs');
capacitor.shield = capacitor.maxShield / 2; capacitor.dead = true;
check(picture(capacitor) === picture(capacitor, true), 'Dead Capacitors have no charging arcs');

// Compare waiting, starting, half full, interrupted and full through game glow.
const delay = capacitor.shieldRechargeDelay;
const halfCharge = Math.ceil(0.5 / capacitor.shieldRechargeRate);
const fullCharge = Math.ceil(1 / capacitor.shieldRechargeRate);
const stages = [delay - 1, delay + 1, delay + halfCharge, delay + halfCharge, delay + fullCharge];
for (let i = 0; i < stages.length; i++) {
  const creep = new Capacitor(); creep.speed = 0;
  advance(creep, stages[i]);
  if (i === 3) creep.takeDamage(0.1, 'piercing');
  creep.x = 180 + i * 180; creep.y = 620; creep.angle = 0;
  creeps.push(creep);
}
await gameControl.screenshot('capacitor-charge-stages');
wslog({result:'PASS', delaySeconds:delay / 60, chargingVisible:true, animated:true, interruption:true, fullShield:true});
