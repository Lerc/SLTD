"use strict";

// Upgrade prices are incremental. Only the five foundations can be built.
class Specialist extends Tower {
  constructor(x, y) {
    super(x, y);
    const info = towerInfo.find(i => i.type === this.constructor);
    Object.assign(this, info.combat);
    this.tint = info.tint;
    this.icon = info.icon;
  }

  fire() {
    const targets = creeps.filter(c => !c.dead && this.distanceTo(c) < this.range);
    const hit = (c, amount, kind) => c.takeDamage(amount, kind, this);
    const beam = (a, b) => combatEffect(a.position, this.tint, b.position);
    if (this.behavior === 'chain') {
      let current = this.target;
      const visited = new Set();
      for (let n = 0; current && n < 4; n++) {
        visited.add(current);
        hit(current, this.power * Math.pow(0.78, n), 'energy');
        beam(n === 0 ? this : this.lastLink, current);
        this.lastLink = current;
        current = creeps.find(c => !c.dead && !visited.has(c) && c.distanceTo(current) < 160);
      }
      this.lastLink = null;
    } else if (this.behavior === 'splash' || this.behavior === 'burn') {
      for (const c of creeps) {
        if (c.dead || c.distanceTo(this.target) > this.splash) continue;
        hit(c, this.power, this.behavior === 'burn' ? 'fire' : 'explosive');
        if (this.behavior === 'burn') c.applyBurn(180, 0.18, this);
      }
      beam(this, this.target);
      combatEffect(this.target.position, this.tint, null, this.splash);
    } else if (this.behavior === 'slow' || this.behavior === 'quake') {
      for (const c of targets) {
        hit(c, this.power, 'energy');
        c.applySlow(this.behavior === 'slow' ? 0.48 : 0.7, 150);
        if (this.behavior === 'quake') c.vulnerableTicks = 180;
      }
      combatEffect(this.position, this.tint, null, this.range);
    } else {
      let power = this.power;
      if (this.behavior === 'focus') {
        this.focus = this.focusTarget === this.target ? Math.min(4, (this.focus || 1) + 0.35) : 1;
        this.focusTarget = this.target;
        power *= this.focus;
      }
      if (this.behavior === 'execute' && this.target.damage / this.target.hitPoints > 0.65) power *= 2;
      hit(this.target, power, this.damageKind || 'physical');
      beam(this, this.target);
    }
    this.cooldown = 1000 / this.rate;
  }

  draw() {
    ctx.drawSprite(Assets['Tower' + (this.icon + 1)]);
    ctx.strokeStyle = this.tint;
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = i * Math.PI / 3;
      const x = Math.cos(a) * 39, y = Math.sin(a) * 39;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.rotate(this.angle);
    ctx.fillStyle = this.tint;
    // All turret art faces up locally; angle zero is north, clockwise positive.
    ctx.fillRect(-6, -51, 12, 43);
    ctx.fillRect(-13, -10, 26, 18);
  }
}
class Ranger extends Specialist {}
class Repeater extends Specialist {}
class Mortar extends Specialist {}
class Incinerator extends Specialist {}
class Tesla extends Specialist {}
class Prism extends Specialist {}
class Railgun extends Specialist {}
class Executioner extends Specialist {}
class Cryo extends Specialist {}
class Quake extends Specialist {}

var towerInfo = [
  {type: Tower, name: 'Sentry', cost: 100, icon: 0, desc: 'Reliable single-target fire', upgrades: ['Ranger', 'Repeater']},
  {type: Stubby, name: 'Cannon', cost: 180, icon: 1, desc: 'Heavy hits at close range', upgrades: ['Mortar', 'Incinerator']},
  {type: Zappy, name: 'Pulse', cost: 220, icon: 2, desc: 'Rapid energy fire • breaks armor', upgrades: ['Tesla', 'Prism']},
  {type: Star, name: 'Orbital', cost: 360, icon: 3, desc: 'Long range • cannot fire up close', upgrades: ['Railgun', 'Executioner']},
  {type: Thumper, name: 'Nova', cost: 260, icon: 4, desc: 'Area pulse • handles swarms', upgrades: ['Cryo', 'Quake']},
  {type: Ranger, name: 'Ranger', cost: 140, icon: 0, tint: '#184060', desc: 'Long-range armor-piercing shots', combat: {range: 420, rate: 30, power: 15, damageKind: 'piercing'}},
  {type: Repeater, name: 'Repeater', cost: 160, icon: 0, tint: '#403008', desc: 'Rapid fire • shreds runners', combat: {range: 270, rate: 130, power: 5}},
  {type: Mortar, name: 'Mortar', cost: 210, icon: 1, tint: '#402008', desc: 'Explosive shells • 120 splash radius', combat: {range: 330, rate: 16, power: 28, behavior: 'splash', splash: 120}},
  {type: Incinerator, name: 'Incinerator', cost: 190, icon: 1, tint: '#401008', desc: 'Burning splash • stops regeneration', combat: {range: 230, rate: 30, power: 7, behavior: 'burn', splash: 95}},
  {type: Tesla, name: 'Tesla', cost: 240, icon: 2, tint: '#103840', desc: 'Lightning chains through 4 enemies', combat: {range: 310, rate: 30, power: 16, behavior: 'chain'}},
  {type: Prism, name: 'Prism', cost: 240, icon: 2, tint: '#381040', desc: 'Damage ramps to 4× on one target', combat: {range: 360, rate: 70, power: 4, behavior: 'focus', damageKind: 'energy'}},
  {type: Railgun, name: 'Railgun', cost: 280, icon: 3, tint: '#204038', desc: 'Huge armor-piercing hits • no blind spot', combat: {range: 640, rate: 12, power: 85, damageKind: 'piercing'}},
  {type: Executioner, name: 'Executioner', cost: 260, icon: 3, tint: '#401820', desc: 'Double damage below 35% health', combat: {range: 540, rate: 24, power: 36, behavior: 'execute', damageKind: 'energy'}},
  {type: Cryo, name: 'Cryo', cost: 180, icon: 4, tint: '#103848', desc: 'Frost field • slows groups by 52%', combat: {range: 225, rate: 18, power: 5, behavior: 'slow'}},
  {type: Quake, name: 'Quake', cost: 220, icon: 4, tint: '#403018', desc: 'Slows groups • makes them take +35% damage', combat: {range: 200, rate: 14, power: 24, behavior: 'quake'}}
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
    Ranger, Repeater, Mortar, Incinerator, Tesla, Prism, Railgun, Executioner, Cryo, Quake});
}
