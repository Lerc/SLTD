// wsb run tests/browser/energy-shields.test.js --app sltd --wait
const check = (condition, message) => { if (!condition) { wslog('FAIL: ' + message); throw new Error(message); } };
startGame('foundry'); paused = true;
const types = [Shieldbug, Skimmer, Capacitor, Bulwark];
// Exercise real creep drawing through the normal game canvas and glow pipeline.
for (let i = 0; i < types.length; i++) {
  for (let stage = 0; stage < 3; stage++) {
    const creep = new types[i]();
    creep.x = 210 + stage * 300; creep.y = 340 + i * 250; creep.speed = 0;
    creep.angle = 0;
    creep.shield = 0;
    if (stage === 2) { creep.applySlow(.5, 300); creep.applyVulnerability(300); }
    creep.shield = creep.maxShield * [1, 0.35, 0][stage];
    creeps.push(creep);
  }
}
await gameControl.screenshot('energy-shield-roster');
for (const creep of creeps) if (creep.shield > 0) creep.takeDamage(creep.shield * 0.15, 'energy');
await gameControl.screenshot('energy-shield-impact');
for (const creep of creeps) for (let tick = 0; tick < 31; tick++) creep.move();
check(creeps.every(creep => creep.shieldFlash === 0), 'Shield impact brightness fades to normal');
await gameControl.screenshot('energy-shield-faded');
const capacitor = new Capacitor(); capacitor.speed = 0;
capacitor.applySlow(.5, capacitor.shieldRechargeDelay + 120);
for (let i = 0; i <= capacitor.shieldRechargeDelay; i++) capacitor.move();
check(capacitor.shield > 0 && capacitor.slowTicks > 0, 'Returning shields preserve existing debuffs');
check(capacitor.applyBurn(100, 1) === false, 'Returning shields reject new debuffs');
creeps.push(capacitor);
uiActivate({id:'guide'});
const rendered = [];
const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1848;
const context = canvas.getContext('2d');
const recording = new Proxy(context, {
  get(object, key) {
    if (key === 'fillText') return (text, x, y) => { rendered.push({text, x, y}); object.fillText(text, x, y); };
    const value = object[key]; return typeof value === 'function' ? value.bind(object) : value;
  },
  set(object, key, value) { object[key] = value; return true; }
});
for (const Type of types) {
  uiGuidePage = guideEntries().findIndex(entry => entry.info?.type === Type);
  check(uiGuidePage > 0, 'Shield creep has a dossier: ' + Type.name);
  rendered.length = 0;
  uiDrawGuide(recording);
  check(rendered.some(line => line.text.includes(Type.name)), 'Dossier names ' + Type.name);
  check(rendered.some(line => line.text === 'WEAKNESSES / COUNTERS'), 'Dossier explains counters');
  check(Math.max(...rendered.map(line => line.y)) < 1616, 'Dossier fits above navigation');
}
await gameControl.screenshot('energy-shield-guide');
startGame('foundry'); paused = true;
wslog({result:'PASS',types:types.map(Type => Type.name),shieldDebuffs:true,guidePages:guideEntries().length,guideFits:true});
