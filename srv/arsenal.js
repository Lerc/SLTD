"use strict";

// Upgrade prices are incremental; buildability is independent of upgrade branches.
class Specialist extends Tower {
  constructor(x, y) {
    super(x, y);
    const info = towerInfo.find(i => i.type === this.constructor);
    Object.assign(this, {burnPower:0.18, burnDuration:180, slowDuration:150,
      slowFactor:info.combat.behavior === 'slow' ? 0.48 : 0.7, chainCount:4, chainRange:160}, info.combat);
    this.tint = info.tint;
    this.icon = info.icon;
    if (this.behavior === 'burn') this.firingMode = info.combat.firingMode || 'directional';
    if (this.behavior === 'slow' || this.behavior === 'quake') this.firingMode = 'area';
  }

  fire() {
    if (this.behavior === 'burn' && this.firingMode === 'directional') {
      globalThis.bullets.push(new Flame(this));
      bullets = globalThis.bullets;
      this.cooldown = 1000 / (this.rate * Flame.packetsPerShot);
      return;
    }
    const targets = creeps.filter(c => !c.dead && this.distanceTo(c) < this.range);
    const hit = (c, amount, kind) => c.takeDamage(amount, kind, this);
    // Effects are browser-only; damage and status timing also run headlessly.
    const effect = (target = this.target, origin = this) => {
      if (typeof towerFiringEffect === 'function') towerFiringEffect(this, target, origin);
    };
    if (this.behavior === 'chain') {
      let current = this.target;
      const visited = new Set();
      for (let n = 0; current && n < this.chainCount; n++) {
        visited.add(current);
        hit(current, this.power * Math.pow(0.78, n), 'energy');
        effect(current, n === 0 ? this : this.lastLink);
        this.lastLink = current;
        current = creeps.find(c => !c.dead && !visited.has(c) && c.distanceTo(current) < this.chainRange);
      }
      this.lastLink = null;
    } else if (this.behavior === 'splash' || this.behavior === 'burn') {
      for (const c of creeps) {
        if (c.dead || c.distanceTo(this.target) > this.splash) continue;
        hit(c, this.power, this.behavior === 'burn' ? 'fire' : 'explosive');
        if (this.behavior === 'burn') c.applyBurn(this.burnDuration, this.burnPower, this);
      }
      effect();
    } else if (this.behavior === 'slow' || this.behavior === 'quake') {
      for (const c of targets) {
        hit(c, this.power, 'energy');
        c.applySlow(this.slowFactor, this.slowDuration);
        if (this.behavior === 'quake') c.applyVulnerability(180);
      }
      effect();
    } else {
      let power = this.power;
      if (this.behavior === 'focus') {
        this.focus = this.focusTarget === this.target ? Math.min(4, (this.focus || 1) + 0.35) : 1;
        this.focusTarget = this.target;
        power *= this.focus;
      }
      if (this.behavior === 'execute' && this.target.damage / this.target.hitPoints > 0.65) power *= 2;
      effect();
      hit(this.target, power, this.damageKind || 'physical');
    }
    this.cooldown = 1000 / this.rate;
  }

  get bulletsComeOutHere() {
    if (this.firingMode === 'area') return v2(0, 0);
    return vnormalize(vFromAngle(this.angle), this.constructor.muzzleDistance || 50);
  }

  draw() {
    const name = this.constructor.name;
    ctx.drawSprite(Assets[name + 'Body'] || null);
    ctx.save();
    // Directional weapons face north in the atlas. Area emitters stay centered.
    if (this.firingMode !== 'area') ctx.rotate(this.angle);
    ctx.drawSprite(Assets[name + 'Turret'] || null);
    ctx.restore();
  }
}
class Ranger extends Specialist {}
class Repeater extends Specialist {}
class Mortar extends Specialist { static muzzleDistance = 26; }
class Incinerator extends Specialist {}
class Inferno extends Specialist {}
class Firestorm extends Specialist {}
class Tesla extends Specialist {}
class Prism extends Specialist {}
class Railgun extends Specialist {}
class Executioner extends Specialist {}
class Cryo extends Specialist {}
class Quake extends Specialist {}

var towerInfo = [
  {type: Tower, name: 'Sentry', cost: 100, buildable: true, icon: 0, desc: 'Shoots one creep at a time. No frills, just gets on with it.', upgrades: ['Ranger', 'Repeater']},
  {type: Stubby, name: 'Cannon', cost: 180, buildable: true, icon: 1, desc: 'Hits hard, but likes its creeps close. Subtlety costs extra.', upgrades: ['Mortar', 'Star']},
  {type: Zappy, name: 'Pulse', cost: 220, buildable: true, icon: 2, desc: 'Fires quick bursts of energy. Armor won\'t save them from this.', upgrades: ['Tesla', 'Prism']},
  {type: Incinerator, name: 'Incinerator', cost: 190, buildable: true, icon: 5, tint: '#401008', desc: "Sets passing creeps on fire.  Good against healers because it's hard to heal when you're on fire ", upgrades: ['Inferno', 'Firestorm'], combat: {range: 230, rate: 30, power: 7, behavior: 'burn', splash: 95}},
  {type: Thumper, name: 'Nova', cost: 260, buildable: true, icon: 4, desc: 'Damages everything nearby. Handy if there\'s a lot of creeps coming at once.', upgrades: ['Cryo', 'Quake']},
  {type: Ranger, name: 'Ranger', cost: 420, icon: 0, tint: '#184060', desc: 'Targets creeps from afar, strikes straight through armor and shields.', combat: {range: 420, rate: 30, power: 15, damageKind: 'piercing'}},
  {type: Repeater, name: 'Repeater', cost: 480, icon: 0, tint: '#403008', desc: 'If you want quick fire, this is the tower for you.', combat: {range: 270, rate: 65, power: 10}},
  {type: Mortar, name: 'Mortar', cost: 630, icon: 1, tint: '#402008', desc: 'Lobs explosive shells into a crowd so nobody feels left out.', combat: {range: 330, rate: 16, power: 28, behavior: 'splash', splash: 120}},
  {type: Star, name: 'Orbital', cost: 900, icon: 3, tint: '#381840', desc: 'Sends big, slow shots a long way. Gets awkward when creeps come too close.', upgrades: ['Railgun', 'Executioner']},
  {type: Inferno, name: 'Inferno', cost: 570, icon: 5, tint: '#502008', desc: 'Really sets creeps on fire. Hot hot hot!', combat: {range: 245, rate: 35, power: 12, behavior: 'burn', splash: 100, burnPower:0.45, burnDuration:240}},
  {type: Firestorm, name: 'Firestorm', cost: 660, icon: 5, tint: '#482018', desc: 'Sets whole groups on fire at once. A warm welcome for everyone.', combat: {range: 320, rate: 22, power: 18, behavior: 'burn', firingMode: 'point', splash: 165, burnPower:0.22, burnDuration:210}},
  {type: Tesla, name: 'Tesla', cost: 720, icon: 2, tint: '#103840', desc: 'Lightning jumps from creep to creep. Sharing is caring, apparently.', combat: {range: 310, rate: 30, power: 16, behavior: 'chain'}},
  {type: Prism, name: 'Prism', cost: 720, icon: 2, tint: '#381040', desc: 'Keeps hitting the same creep harder. Might have ADHD hyperfocus.', combat: {range: 360, rate: 70, power: 4, behavior: 'focus', damageKind: 'energy'}},
  {type: Railgun, name: 'Railgun', cost: 1000, icon: 3, tint: '#204038', desc: 'Nothing beats the classics, Wham! straight through armor and shields.', combat: {range: 640, rate: 12, power: 85, damageKind: 'piercing'}},
  {type: Executioner, name: 'Executioner', cost: 900, icon: 3, tint: '#401820', desc: "Hits wounded creeps twice as hard. That'll show 'em", combat: {range: 540, rate: 24, power: 36, behavior: 'execute', damageKind: 'energy'}},
  {type: Cryo, name: 'Cryo', cost: 540, icon: 4, tint: '#103848', desc: 'Chills and slows nearby creeps. Gives everyone else time to shoot them.', combat: {range: 225, rate: 18, power: 5, behavior: 'slow'}},
  {type: Quake, name: 'Quake', cost: 660, icon: 4, tint: '#403018', desc: 'Slows nearby creeps and makes them take more damage. Much like a team building exercise', combat: {range: 200, rate: 14, power: 24, behavior: 'quake'}}
];
for (const info of towerInfo) {
  info.minRange = info.combat?.minimumRange || info.type.minimumRange || 0;
  info.maxRange = info.combat?.range || info.type.range;
}
function getTowerInfo(tower) { return towerInfo.find(i => i.type === tower?.constructor); }
function upgradeTower(tower, typeName) {
  const current = getTowerInfo(tower);
  const next = towerInfo.find(i => i.type.name === typeName);
  if (globalThis.gameMode !== globalThis.mainGame || !towers.includes(tower) || !current?.upgrades?.includes(typeName) || !next) return false;
  if (money < next.cost) return false;
  const replacement = new next.type(tower.cellPosition.x, tower.cellPosition.y);
  applyTowerLevel(replacement, tower.level);
  replacement.invested = tower.invested + next.cost;
  replacement.targetMode = tower.targetMode;
  replacement.kills = tower.kills;
  replacement.damageDealt = tower.damageDealt;
  replacement.angle = tower.angle;
  replacement.cooldown = Math.min(tower.cooldown, 1000 / replacement.rate);
  towers[towers.indexOf(tower)] = replacement;
  for (const bullet of bullets) if (bullet.source === tower) bullet.source = replacement;
  for (const creep of creeps) if (creep.burnSource === tower) creep.burnSource = replacement;
  money = globalThis.money = money - next.cost;
  selectedTower = globalThis.selectedTower = replacement;
  combatEffect(replacement.position, next.tint, null, 90);
  return replacement;
}
function sellValue(tower) { return Math.floor(tower.invested * 0.7); }
function sellTower(tower) {
  if (globalThis.gameMode !== globalThis.mainGame || !towers.includes(tower)) return false;
  money = globalThis.money = money + sellValue(tower);
  towers.splice(towers.indexOf(tower), 1);
  selectedTower = globalThis.selectedTower = null;
  return true;
}

// Bounded effects use the existing trail canvas and disappear after 20 ticks.
function combatEffect(position, tint, end = null, radius = 30) {
  if (typeof ctx === 'undefined' || !ctx || particleSystems.length >= 64) return;
  let age = 0;
  particleSystems.push({
    move() { age++; },
    isActive() { return age < 20; },
    draw(context) {
      context.save();
      context.globalAlpha = 1 - age / 20;
      context.strokeStyle = tint;
      context.lineWidth = end ? 5 : 3;
      context.beginPath();
      if (end) {
        context.moveTo(position.x, position.y);
        context.lineTo((position.x + end.x) / 2 + Math.sin(age * 2) * 9, (position.y + end.y) / 2);
        context.lineTo(end.x, end.y);
      } else context.arc(position.x, position.y, radius * (0.2 + age / 25), 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
  });
}
if (typeof module !== 'undefined' && module.exports) {
  Object.assign(globalThis, {towerInfo, getTowerInfo, upgradeTower, sellTower, sellValue, combatEffect,
    Ranger, Repeater, Mortar, Incinerator, Inferno, Firestorm, Specialist, Tesla, Prism, Railgun, Executioner, Cryo, Quake});
}
