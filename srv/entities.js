"use strict"

function scaleHitPoints(amount) {
  return amount*difficulty;// probably want a curve later
}

let economy = 0.8;
function scaleIncome(amount) {
  return Math.floor(amount * economy);
}


function buyTower(info, cellX, cellY) {
  const pos = v2(cellX, cellY);
  if (globalThis.gameMode !== globalThis.mainGame || !info?.buildable || !Number.isInteger(cellX) || !Number.isInteger(cellY) || !levelMap.canBuildHere(pos) || towers.some(t => vsame(t.cellPosition, pos)) || money < info.cost) return false;
  money = globalThis.money = money - info.cost;
  const tower = new info.type(cellX, cellY);
  applyTowerLevel(tower, 1);
  globalThis.towers.push(tower);
  towers = globalThis.towers;
  combatEffect(tower.position, '#184038', null, 75);
  return tower;
}

class Entity {
  constructor (x,y) {
    this.x=x;
    this.y=y;
    this.scale=1.0;
    this.dead=false;
  }

  get position() {
    return (v2(this.x,this.y))
  };

  set position(v) {
    this.x=v.x;
    this.y=v.y;
  }

  distanceTo(other) {
    if (other===this) return 0;
    let dx = this.x-other.x;
    let dy = this.y-other.y;
    return Math.sqrt(dx*dx+dy*dy);
  }

  move () {

  }

  drawMain () {
    ctx.save();
    ctx.translate(this.x,this.y);
    ctx.scale(this.scale,this.scale);

    this.draw();

    ctx.restore();
  }

  draw () {

  }
}

class Creep extends Entity {
  static value = 5;
  static hitPoints = 10;

  constructor ({preview=false} = {}) {
    const {x,y} = preview ? v2(0,0) : mapToWorld(levelMap.startPoint);
    super(x,y);
    this.angle=0;
    this.speed=2;
    this.turn=0.03;
    this.motion= v2(0,0);
    this.pathIndex = 0;
    this.image = Assets.Creep1;
    this.radius = 20;
    // Display specimens need their real stats and art, without joining a route.
    this.destination = preview ? v2(0,0) : mapToWorld(levelMap.path[0]);
    if (!preview) this.findNextStep();

    this.damage = 0;
    this.travel=0;
    this.value = this.constructor.value;
    this.waveNumber = preview ? 1 : globalThis.waveCounter || 1;
    this.hitPoints = preview ? this.constructor.hitPoints : scaleHitPoints(this.constructor.hitPoints);

    this.timeout=0;
    this.slowTicks = 0;
    this.slowFactor = 1;
    this.burnTicks = 0;
    this.burnPower = 0;
    this.vulnerableTicks = 0;
    this.armor = 0;
    this.regeneration = 0;
    this.shield = 0;
    this.shieldRatio = 0;
    this.shieldRechargeDelay = 180;
    this.shieldRechargeRate = 0.0015;
    this.shieldRechargeTicks = 0;
    this.shieldFlash = 0;
    this.shieldHitPoints = 0;
    this.hitFlash = 0;
  }

  // Capacity follows restored/scaled health, including queued overlapping waves.
  get maxShield() { return this.hitPoints * this.shieldRatio; }

  get movementSpeed() { return this.speed; }

  canReceiveDebuff() { return !this.dead && this.shield <= 0; }

  distanceTraveled() {
    return this.pathIndex * 1000 + this.travel;
  }



  findNextStep () {
    this.timeout=0;
    this.pathIndex+=1;
    if (this.pathIndex<levelMap.path.length) {
      this.source=this.destination;
      this.destination = vadd(mapToWorld(levelMap.path[this.pathIndex]),vrandom(16));
    } else {
      this.dead=true;
      lives = globalThis.lives = Math.max(0, lives - (this.leakDamage || 1));
      waveClearBase = globalThis.waveClearBase = 0;
    }
  }

  move () {
    if (this.dead) return;
    if (this.hitFlash > 0) this.hitFlash--;
    this.shieldFlash = Math.max(0, this.shieldFlash - 1 / 30);
    if (this.vulnerableTicks > 0) this.vulnerableTicks--;
    if (this.burnTicks > 0) {
      this.burnTicks--;
      this.takeDamage(this.burnPower, 'fire', this.burnSource);
    } else if (this.regeneration) this.damage = Math.max(0, this.damage - this.regeneration * this.hitPoints);
    if (this.dead) return;
    if (this.shieldRechargeTicks > 0) this.shieldRechargeTicks--;
    else if (this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + this.maxShield * this.shieldRechargeRate);
    }
    const speedFactor = this.slowTicks > 0 ? this.slowFactor : 1;
    if (this.slowTicks > 0) this.slowTicks--;

    if (this.timeout++ >100) { //in case we're orbiting try a slightly different destination
      this.destination = vadd(mapToWorld(levelMap.path[this.pathIndex]),vrandom(8));
      this.timeout=0;
    }

    let delta = vdiff(this.destination,v2(this.x,this.y));

    this.travel = 1 - (vlength(delta)/1000);

    let turn = this.turn + (this.timeout/2000) // get tighter turning over time.
    this.motion= vnormalize(vadd(vnormalize(delta,turn),this.motion),this.movementSpeed * speedFactor);

    this.x+=this.motion.x;
    this.y+=this.motion.y;

    if (this.burnTicks > 0 && typeof emitBurnEmber === 'function') {
      emitBurnEmber(this.x, this.y, this.motion.x, this.motion.y, this.burnPower * 60, this.radius + 6);
    }

    this.angle=vangle(this.motion);
    if ( vdistance(v2(this.x,this.y),this.destination) < vdistance(v2(this.x,this.y),this.source)) {
      this.findNextStep();
    }
  }

  applySlow(factor, ticks) {
    if (!this.canReceiveDebuff()) return false;
    if (this.slowResistance) factor = 1 - (1 - factor) * 0.5;
    if (!this.slowTicks || factor < this.slowFactor) this.slowFactor = factor;
    this.slowTicks = Math.max(this.slowTicks, ticks);
    return true;
  }

  applyBurn(ticks, power, source) {
    if (!this.canReceiveDebuff()) return false;
    this.burnTicks = Math.max(this.burnTicks, ticks);
    this.burnPower = Math.max(this.burnPower, power);
    this.burnSource = source;
    return true;
  }

  applyVulnerability(ticks) {
    if (!this.canReceiveDebuff()) return false;
    this.vulnerableTicks = Math.max(this.vulnerableTicks, ticks);
    return true;
  }

  takeDamage(amount, kind = 'physical', source = null) {
    if (this.dead) return 0;
    if (kind === 'physical') amount *= 1 - this.armor;
    if (this.vulnerableTicks > 0) amount *= 1.35;
    if (!(amount > 0)) return 0;
    // Shield hits, health hits, piercing and ongoing burns all interrupt recharge.
    this.shieldRechargeTicks = this.shieldRechargeDelay;
    // Shields absorb energy less efficiently; piercing bypasses them entirely.
    if (this.shield > 0 && kind !== 'piercing') {
      const multiplier = kind === 'energy' ? 2 : 1;
      const absorbed = Math.min(this.shield, amount * multiplier);
      this.shieldHitPoints = this.shield;
      this.shieldFlash = 1;
      this.shield -= absorbed;
      amount -= absorbed / multiplier;
    }
    const dealt = Math.min(amount, this.hitPoints - this.damage);
    this.damage += amount;
    this.hitFlash = 5;
    if (source) source.damageDealt += dealt;
    if (this.damage >= this.hitPoints) {
      this.die();
      if (source) source.kills++;
      money = globalThis.money = money + scaleIncome(this.value);
      awardKillScore(this);
      combatEffect(this.position, '#403018');
    }
    return dealt;
  }

  die () {
    this.dead=true;
  }

  draw () {
    if (this.slowTicks > 0 || this.burnTicks > 0 || (this.regeneration && !(this instanceof Mender)) || this.vulnerableTicks > 0) {
      ctx.strokeStyle = this.burnTicks > 0 ? '#602008' : this.slowTicks > 0 ? '#185060' : this.vulnerableTicks > 0 ? '#502840' : this.armor ? '#403020' : '#105020';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 9, 0, TWOPI);
      ctx.stroke();
      if (this.regeneration && !(this instanceof Mender)) {
        ctx.fillStyle = '#105020';
        ctx.fillRect(-5, -20, 10, 40);
        ctx.fillRect(-20, -5, 40, 10);
      }
    }
    if (this.brood && !(this instanceof Splitter)) {
      ctx.fillStyle = '#402838';
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * 44, 0, 8, 0, TWOPI); ctx.fill(); }
    }
    if (this.hitFlash > 0) {
      ctx.fillStyle = '#302018';
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, TWOPI); ctx.fill();
    }
    ctx.rotate(this.angle);
    ctx.drawSprite(this.image,0,0)

    this.drawShield(ctx);
  }

  drawShield(c) {
    if (this.shield <= 0) return;
    const r = Math.max(58, this.radius + 21);
    const charge = Math.min(1, this.shield / (this.maxShield || this.shield));
    const flash = this.shieldFlash * this.shieldFlash;
    c.save();
    c.rotate(-this.angle); // Keep the bubble's reflection fixed as the creep turns.
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.30 + charge * 0.25 + flash * 0.45;
    const bubble = Assets.ShieldBubble;
    c.drawSprite(bubble, 0, 0, 0, (r * 2 / 0.9) / bubble.width);
    c.restore();
  }

  get healthBarY() {
    const body = Math.max(this.image?.width || 0, this.image?.height || 0) / 2;
    const shield = this.maxShield > 0 ? Math.max(58, this.radius + 21) + 24 : 0;
    return -Math.max(this.radius, body, shield) - 10;
  }

  drawHealthBar () {
    if (this.damage > 0 || this.maxShield > 0) {
      ctx.save();
      ctx.translate(this.x,this.y);
      ctx.scale(this.scale,this.scale);

      const r = Math.max(this.radius, 32);
      const y = this.healthBarY;
      if (this.damage > 0) {
        ctx.fillStyle="#080";
        ctx.fillRect(-r,y,2*r,5);
        let p = Math.min(1, this.damage/this.hitPoints);
        ctx.fillStyle="#800";
        ctx.fillRect(r,y,-2*r*p,5);
      }
      if (this.maxShield > 0) {
        const flash = this.shieldFlash * this.shieldFlash;
        const remaining = Math.min(1, this.shield / this.maxShield);
        ctx.fillStyle = '#0c1822'; ctx.fillRect(-r, y - 10, 2 * r, 4);
        if (flash > 0) {
          // Keep a fading trace of the points just lost, even on a shield break.
          const previous = Math.min(1, this.shieldHitPoints / this.maxShield);
          ctx.globalAlpha = flash;
          ctx.fillStyle = '#507888';
          ctx.fillRect(-r + 2 * r * remaining, y - 10, 2 * r * Math.max(0, previous - remaining), 4 + flash * 2);
          ctx.strokeStyle = '#285878'; ctx.lineWidth = 2;
          ctx.strokeRect(-r - 1, y - 11, 2 * r + 2, 10);
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = `rgb(${32 + flash * 100},${80 + flash * 88},${112 + flash * 78})`;
        ctx.fillRect(-r, y - 10, 2 * r * remaining, 4 + flash * 4);
      }


      ctx.restore();
    }
  }
}

class Basic extends Creep {
  static hitPoints = 10;

  constructor (options) {
    super(options);
    this.speed = 2;
    this.turn = 0.1;
    this.image = Assets.Creep1;
  }
}

class Zipper extends Creep {
  static value = 2;
  static hitPoints = 3;
  constructor (options) {
    super(options);
    this.speed = 4;
    this.turn = 0.3;
    this.scale = 0.5;
    this.image = Assets.Creep1;
  }
}

class Flyer extends Creep {
  static value=2;
  static hitPoints=15;
  static boostRechargeDuration = 900;
  static boostDuration = 120;
  constructor (options) {
    super(options);
    this.speed = 2.5;
    this.turn = 0.1;
    this.scale = 0.5;
    this.radius = 60;
    this.image = Assets.Creep4;
    this.boostCharge = 0;
    this.boostTicks = 0;
  }

  get movementSpeed() {
    return this.speed * (1 + (this.boostTicks > 0 ? 2 * this.boostCharge : 0));
  }

  takeDamage(amount, kind = 'physical', source = null) {
    const dealt = super.takeDamage(amount, kind, source);
    if (dealt > 0 && !this.dead && this.boostTicks === 0 && this.boostCharge > 0) {
      this.boostTicks = Flyer.boostDuration;
    }
    return dealt;
  }

  move() {
    if (this.dead) return;
    // Burn damage in super.move() can trigger a boost for this same movement.
    super.move();
    if (this.dead) return;
    if (this.boostTicks > 0) {
      // Spend the charge present at impact evenly over the remaining burst.
      this.boostCharge -= this.boostCharge / this.boostTicks;
      if (--this.boostTicks === 0) this.boostCharge = 0;
    } else {
      this.boostCharge = Math.min(1, this.boostCharge + 1 / Flyer.boostRechargeDuration);
      if (this.boostCharge > 1 - 1e-12) this.boostCharge = 1;
    }
  }

  draw() {
    super.draw();
    if (this.boostTicks <= 0) return;
    ctx.save();
    ctx.strokeStyle = '#805030';
    ctx.lineWidth = 4;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 22, 30);
      ctx.lineTo(side * 28, 40 + 45 * this.boostCharge);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHealthBar() {
    super.drawHealthBar();
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    const r = Math.max(this.radius, 32);
    const y = this.healthBarY - 10;
    ctx.fillStyle = '#181008';
    ctx.fillRect(-r, y, r * 2, 4);
    ctx.fillStyle = this.boostTicks > 0 ? '#a06830' : '#806030';
    ctx.fillRect(-r, y, r * 2 * this.boostCharge, 4);
    ctx.restore();
  }
}

class Ball extends Creep {
  static hitPoints=30;
  static value = 13;

  constructor (options) {
    super(options);
    this.speed = 1.1;
    this.turn = 0.09;
    this.radius=45;
    this.scale = 0.5;
    this.image = Assets.Creep3;
    this.armor = 0.6;
  }

  move() {
    super.move();
    this.angle=0;
  }
}

class BigBall extends Ball {
  static value = 50;
  static hitPoints = 180;
  constructor (options) {
    super(options);
    this.speed = 0.85;
    this.turn = 0.09;
    this.radius=45;
    this.scale = 1;
    this.image = Assets.Creep3;
    this.armor = 0.35;
    this.leakDamage = 3;
    this.slowResistance = true;
  }
}

class Spikey extends Creep {
    static value = 8;
    static hitPoints = 50;

    constructor (options) {
      super(options);
      this.speed = 1.1;
      this.turn = 0.0001;
      this.scale = 0.75;
      this.radius=55;
      this.image = Assets.Spikey;
    }
}



class Mender extends Creep {
  static hitPoints = 32;
  static value = 14;
  constructor(options) {
    super(options); this.speed = 1.5; this.regeneration = 0.0008;
    this.image = Assets.Mender; this.scale = 1.1;
  }
}
class Shieldbug extends Creep {
  static hitPoints = 24;
  static value = 12;
  constructor(options) {
    super(options); this.speed = 1.7; this.shieldRatio = 0.8; this.shield = this.maxShield;
    this.image = Assets.Shieldbug; this.scale = 0.65;
  }
}
class Skimmer extends Creep {
  static hitPoints = 12;
  static value = 9;
  constructor(options) {
    super(options); this.speed = 3.1; this.turn = 0.2;
    this.shieldRatio = 0.75; this.shield = this.maxShield;
    this.shieldRechargeDelay = 120; this.shieldRechargeRate = 0.002;
    this.image = Assets.Skimmer; this.scale = 0.55; this.radius = 32;
  }
}
class Bulwark extends Creep {
  static hitPoints = 60;
  static value = 24;
  constructor(options) {
    super(options); this.speed = 0.95; this.turn = 0.09; this.armor = 0.45;
    this.shieldRatio = 0.4; this.shield = this.maxShield;
    this.shieldRechargeDelay = 240; this.shieldRechargeRate = 0.001;
    this.image = Assets.Bulwark; this.scale = 0.85; this.radius = 45;
  }
}
class Capacitor extends Creep {
  static hitPoints = 28;
  static value = 15;
  constructor(options) {
    super(options); this.speed = 1.65; this.turn = 0.1;
    this.shieldRatio = 1.2;
    this.shieldRechargeDelay = 600; this.shieldRechargeRate = 0.03;
    this.shieldRechargeTicks = this.shieldRechargeDelay;
    this.image = Assets.Capacitor; this.scale = 0.975; this.radius = 40;
  }

  drawShield(c) {
    super.drawShield(c);
    if (this.dead || this.shieldRechargeTicks > 0 || this.shield >= this.maxShield) return;
    // Derive animation from shield growth so it pauses and survives saves.
    const ticks = this.shield / this.maxShield / this.shieldRechargeRate;
    const phase = ticks * TWOPI / 60;
    const pulse = (1 + Math.sin(ticks * TWOPI / 20)) / 2;
    const r = Math.max(58, this.radius + 21) + 6;
    c.save();
    c.rotate(-this.angle);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.65 + pulse * 0.35;
    c.fillStyle = '#e8d8ff';
    c.lineWidth = 3;
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      c.save();
      c.rotate(phase + i * TWOPI / 3);
      const tail = -1.15;
      const trail = c.createLinearGradient(r * Math.cos(tail), r * Math.sin(tail), r, 0);
      trail.addColorStop(0, 'rgba(176,144,208,0)');
      trail.addColorStop(0.55, 'rgba(176,144,208,0.35)');
      trail.addColorStop(1, 'rgba(176,144,208,0.9)');
      c.strokeStyle = trail;
      c.beginPath();
      c.arc(0, 0, r, tail, 0);
      c.stroke();
      c.beginPath();
      c.arc(r, 0, 3 + pulse, 0, TWOPI);
      c.fill();
      c.restore();
    }
    c.restore();
  }
}
class Splitter extends Creep {
  static hitPoints = 42;
  static value = 10;
  constructor(options) { super(options); this.speed = 1.3; this.image = Assets.Splitter; this.scale = 0.6; this.brood = true; }
  die() {
    super.die();
    for (let i = 0; i < 2; i++) {
      const child = new Zipper();
      Object.assign(child, {x: this.x + i * 8, y: this.y, pathIndex: this.pathIndex,
        destination: {...this.destination}, source: {...this.source}, motion: {...this.motion},
        waveNumber: this.waveNumber, hitPoints: Zipper.hitPoints * this.hitPoints / this.constructor.hitPoints});
      backlog.push(child);
    }
  }
}

// Shared angle convention: 0 faces up; positive angles rotate clockwise.
// Sprite guns, specialist geometry and vFromAngle all use this frame.
class Tower extends Entity {
  static range = 250;
  static minimumRange = 0;
  static turnFraction = 0.15;
  static aimTolerance = Math.PI * 0.05; // 5% of a half-turn (9 degrees).
    constructor (cellX,cellY) {
      let cellPosition= v2(cellX,cellY);
      let {x,y}=mapToWorld(cellPosition)
      super (x,y);
      this.cellPosition=cellPosition;
      this.target = null;
      this.angle=2;
      this.cooldown=0;
      this.rate = 35;
      this.power = 4;
      this.level = 1;
      this.range =this.constructor.range || Tower.range ;
      this.minimumRange= this.constructor.minimumRange || Tower.minimumRange;

      this.bulletKind = Pea;
      this.targetMode = 'first';
      this.firingMode = 'point';
      this.kills = 0;
      this.damageDealt = 0;
      this.invested = typeof towerInfo !== 'undefined' ? (getTowerInfo(this)?.cost || 100) : 100;

    }

    get bulletsComeOutHere() {
      return vnormalize(vFromAngle(this.angle),50);
    }

    move() {
      this.cooldown = max(this.cooldown-1,0);

      this.target = this.findTarget();
      if (this.target) {
        const desired = vangle(vdiff(this.target.position, this.position));
        const error = Math.atan2(Math.sin(desired - this.angle), Math.cos(desired - this.angle));
        this.angle = (this.angle + error * Tower.turnFraction + TWOPI) % TWOPI;
        const remaining = Math.abs(error * (1 - Tower.turnFraction));

        if (this.cooldown===0 && (this.firingMode !== 'point' || remaining <= Tower.aimTolerance)) {
          this.fire()
        }

      }

    }

    fire () {
      globalThis.bullets.push(new this.bulletKind(this,this.target));
      bullets = globalThis.bullets;
      this.cooldown=1000/this.rate;
    }

    findTarget() {
      let best = null;
      for (const c of creeps) {
        const d = this.distanceTo(c);
        if (c.dead || d >= this.range || d < this.minimumRange) continue;
        if (!best || (this.targetMode === 'strong' ? c.hitPoints - c.damage > best.hitPoints - best.damage
          : this.targetMode === 'near' ? d < this.distanceTo(best) : c.distanceTraveled() > best.distanceTraveled())) best = c;
      }
      return best;
    }

    draw () {
      ctx.drawSprite(Assets.Tower1);

      ctx.rotate(this.angle);
      ctx.drawSprite(Assets.Gun1);
      //this.drawRange();
    }

    drawRange() {
      ctx.fillStyle="#08281c30";
      ctx.lineWidth=3;
      ctx.strokeStyle="#184038";
      let {x,y,range,minimumRange}=this;
      ctx.circle(x,y,range);

      ctx.moveTo(x+minimumRange,y);
      ctx.ellipse(x, y, minimumRange, minimumRange, 0, 0, Math.PI * 2,true);
      ctx.fill();
      ctx.stroke();
    }
}


class Star extends Tower  {
  static range = 600;
  static minimumRange = 250;

  constructor (cellX,cellY) {
    super(cellX,cellY);
    this.rate = 7;
    this.power = 100;
    this.bulletKind = Spiral;
    this.outAngle= 0;
  }

  get bulletsComeOutHere() {
    return v2(0,0);
  }

  fire() {
    super.fire();
    this.outAngle = (this.outAngle+0.5) % TWOPI;
  }

  draw () {
    ctx.drawSprite(Assets.Tower4);
  }
}

class Thumper extends Tower  {
  static range = 150;
  constructor (cellX,cellY) {
    super(cellX,cellY);
    this.rate = 10;
    this.power = 45;
    this.bulletKind = Woosh;
    this.firingMode = 'area';
  }

  get bulletsComeOutHere() {
    return v2(0,0);
  }

  draw () {
    ctx.drawSprite(Assets.Tower5);


    let p = 1-(this.cooldown / (1000/this.rate)) ;
    /*
    let angle = p * TWOPI/5;
    ctx.rotate(angle);
    ctx.drawSprite(Assets.Gun5)
    */
    ctx.fillStyle="#faa";

    ctx.circle(0,0,p*10);
    ctx.fill();
  }
}

class Stubby extends Tower {
  static range = 180;
  constructor (cellX,cellY) {
    super(cellX,cellY);
    this.rate = 20;
    this.power = 15;
    this.bulletKind = Rock;
  }

  get bulletsComeOutHere() {
    return vnormalize(vFromAngle(this.angle),40);
  }

  draw () {
    ctx.drawSprite(Assets.Tower2);

    ctx.rotate(this.angle);
    ctx.drawSprite(Assets.Gun2);
  }

}


class Zappy extends Tower {
  static range = 350;
  constructor (cellX,cellY) {
    super(cellX,cellY);
    this.rate = 80;
    this.power = 2;
    this.bulletKind = Laser;
    this.side = 40;
  }

  get bulletsComeOutHere() {
    this.side=-this.side;

    let v = vFromAngle(this.angle);

    let forward = vnormalize(vFromAngle(this.angle),30);
    let side = v2(v.y*this.side,-v.x * this.side);
    return vadd(forward,side);
  }

  draw () {
    ctx.save();
    ctx.rotate(this.angle);
    ctx.drawSprite(Assets.Gun3);
    ctx.restore();
    ctx.drawSprite(Assets.Tower3);
  }

}

class Woosh extends Entity {
  constructor (source) {
    let {x,y} = vadd(source.position,source.bulletsComeOutHere);
    super(x,y)
    this.source=source;
    this.age = 0;
    this.damage = source.power;
    this.range = source.range;

  }

  move() {
    this.age+=1;
    if (this.age > 30) {

      let enemies = creeps.filter(a=>!a.dead && a.distanceTo(this)<this.range);
      for (let e of enemies) {
        e.takeDamage(this.damage, 'explosive', this.source);
      }
      this.dead=true;
    }
  }

  draw() {
    ctx.fillStyle="#faa";
    let outer = this.age*6;
    let inner = max(0,this.age*7-30)

    ctx.circle(0,0,outer);
    ctx.moveTo(inner,0);
    ctx.ellipse(0, 0, inner, inner, 0, 0, Math.PI * 2,true);

    ctx.fill();
  }
}

class Bullet extends Entity {
  constructor (source,target) {
    let {x,y} = vadd(source.position,source.bulletsComeOutHere);
    super(x,y)
    this.source = source;
    this.target = target;
    this.age = 0;
    this.damage = source.power;
    this.motion = v2(0, 0);
    this.fadeTicks = 0;
    this.fadeDuration = 12;
  }

  dissipate(ticks = 12) {
    if (this.fadeTicks || this.dead) return;
    this.target = null;
    this.fadeTicks = this.fadeDuration = ticks;
  }

  moveDissipation() {
    if (!this.fadeTicks) return false;
    this.position = vadd(this.position, this.motion);
    this.motion = vscale(this.motion, 0.85);
    if (--this.fadeTicks === 0) this.dead = true;
    return true;
  }

  drawMain() {
    ctx.save();
    if (this.fadeTicks) ctx.globalAlpha *= this.fadeTicks / this.fadeDuration;
    super.drawMain();
    ctx.restore();
  }

  hit() {
    this.target.takeDamage(this.damage, this instanceof Laser ? 'energy' : this instanceof Spiral ? 'piercing' : 'physical', this.source);
    this.dead=true;
    let pos= this.position;
    if (particleSystems.length < 64) globalThis.particleSystems.push(particleSystem(Math.min(8, this.damage),{pos}));
    particleSystems = globalThis.particleSystems;
  }
}

// A flame packet travels along the barrel direction, independently of its target.
// Six packets per nominal shot make a stream without multiplying direct damage.
class Flame extends Bullet {
  static packetsPerShot = 6;

  constructor(source) {
    super(source, null);
    this.damage = source.power / Flame.packetsPerShot;
    this.angle = source.angle;
    this.speed = 9;
    this.range = source.range;
    this.distance = 0;
    this.radius = source.splash / 6;
    this.burnPower = source.burnPower;
    this.burnDuration = source.burnDuration;
    this.hitEnemies = new Set();
  }

  move() {
    if (this.dead) return;
    if (++this.age > Math.ceil(this.range / 9) * 3) { this.dead = true; return; }
    let time = 1;
    while (time > 0 && !this.dead) {
      const direction = vFromAngle(this.angle);
      const travel = Math.min(this.speed * time, this.range - this.distance);
      let nearest = null, contact = travel;
      // Sweep the packet against enemy circles so fast packets cannot skip hits.
      for (const enemy of creeps) {
        if (enemy.dead || this.hitEnemies.has(enemy)) continue;
        const delta = vdiff(enemy.position, this.position);
        const along = delta.x * direction.x + delta.y * direction.y;
        const radius = enemy.radius + this.radius;
        const perpendicularSq = delta.x * delta.x + delta.y * delta.y - along * along;
        if (perpendicularSq > radius * radius) continue;
        const halfChord = Math.sqrt(Math.max(0, radius * radius - perpendicularSq));
        if (along + halfChord < 0) continue;
        const entry = Math.max(0, along - halfChord);
        if (entry <= contact) { nearest = enemy; contact = entry; }
      }
      this.position = vadd(this.position, vscale(direction, contact));
      this.distance += contact;
      time = Math.max(0, time - contact / this.speed);
      if (nearest) {
        this.hitEnemies.add(nearest);
        nearest.takeDamage(this.damage, 'fire', this.source);
        nearest.applyBurn(this.burnDuration, this.burnPower, this.source);
        this.angle += (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.18);
        this.speed *= 0.72;
      } else time = 0;
      if (this.distance >= this.range) this.dead = true;
    }
    if (!this.dead && typeof emitEmber === 'function') {
      const velocity = vFromAngle(this.angle, this.speed);
      emitEmber(this.x, this.y, velocity.x, velocity.y, this.damage, this.radius * 0.4);
    }
  }

  draw() {
    const life = Math.ceil(this.range / 9) * 3;
    const fade = Math.min(1, (life - this.age) / 12, (this.range - this.distance) / 35);
    const size = this.radius * (0.65 + 0.35 * Math.min(1, this.age / 12));
    ctx.save();
    ctx.globalAlpha *= Math.max(0, fade);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#400e02';
    ctx.beginPath(); ctx.ellipse(0, 0, size, size * 1.6, 0, 0, TWOPI); ctx.fill();
    ctx.fillStyle = '#602808';
    ctx.beginPath(); ctx.ellipse(0, -size * 0.3, size * 0.55, size, 0, 0, TWOPI); ctx.fill();
    ctx.fillStyle = '#703808';
    ctx.beginPath(); ctx.ellipse(0, -size * 0.6, size * 0.25, size * 0.5, 0, 0, TWOPI); ctx.fill();
    ctx.restore();
  }
}

class Spiral extends Bullet {
  constructor (source,target)  {
    super(source,target);


    this.damage = source.power;
    this.angle = source.outAngle;
    this.age = 0;
    this.level = source.level;
  }

  scatter() {
    const count = 6 + 3 * this.level;
    const targets = creeps.filter(c => !c.dead);
    for (let i = 0; i < count; i++) {
      const target = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null;
      const shot = new OrbitalFragment(this.source, target);
      shot.position = this.position;
      shot.motion = vFromAngle(this.angle + i * TWOPI / count, shot.speed);
      shot.damage = this.damage / count;
      globalThis.bullets.push(shot);
    }
    bullets = globalThis.bullets;
    this.dead = true;
  }

  move() {
    if (this.dead || this.moveDissipation()) return;
    if (!this.target || this.target.dead) { this.scatter(); return; }
    if (this.age > 400) { this.dissipate(); return; }
    this.age+=1;
    this.angle+=0.05;

    let t = min(1,this.age /300);
    let it = 1-t;

    let out = vadd(this.source.position,vFromAngle(this.angle, 300*t));

    this.position = vadd(vscale(out,it), vscale(this.target.position,t));

    if (this.distanceTo(this.target) < this.target.radius) this.hit(this.target);
  }


  draw() {
    ctx.fillStyle="#faa";
    ctx.circle(0,0,20);
    ctx.fill();
  }

}

class Pea extends Bullet {
  constructor (source,target)  {
    super(source,target);


    this.damage = source.power;
    this.speed = 5;
    this.motion = vFromAngle(source.angle, this.speed);
    this.lastTargetPosition = target ? target.position : vadd(this.position, vscale(this.motion, 30));
  }

  move() {
    if (this.dead || this.moveDissipation()) return;
    if (this.age++ > 400) { this.dissipate(); return; }
    if (this.target) {
      this.lastTargetPosition = this.target.position;
      if (this.target.dead) this.target = null;
    }
    const delta = vdiff(this.lastTargetPosition, this.position);
    const distance = Math.hypot(delta.x, delta.y);
    this.motion = distance > 0 ? vscale(delta, Math.min(this.speed, distance) / distance) : v2(0, 0);
    this.position = vadd(this.position, this.motion);
    if (this.target && this.distanceTo(this.target) <= this.target.radius) this.hit();
    else if (!this.target && distance <= this.speed) {
      this.motion = v2(0, 0);
      this.dissipate();
    }
  }

  draw() {
    ctx.fillStyle="#faa";
    ctx.circle(0,0,5);
    ctx.fill();
  }
}

class Laser extends Pea {
  constructor (source,target)  {
    super(source,target);
    this.damage = source.power;
    this.speed = 10;
    this.motion = vFromAngle(source.angle, this.speed);
  }


  move() {
    if (!this.dead && !this.fadeTicks && (!this.target || this.target.dead)) this.dissipate(16);
    super.move();
    if (!this.fadeTicks && !this.dead) this.speed= min(this.speed*1.5,30);
  }

  draw() {
    const length = Math.hypot(this.motion.x, this.motion.y);
    const motion = length > 0 ? vscale(this.motion, 10 / length) : v2(0, -10);
    ctx.beginPath();
    ctx.moveTo(0,0);
    let {x,y} = vscale(motion,5);
    ctx.lineTo(x,y)
    ctx.strokeStyle="#aaF";
    ctx.lineWidth=5;
    ctx.stroke();
  }
}

class Rock extends Pea {
  constructor (source,target)  {
    super(source,target);
    this.damage = source.power;
    this.speed = 3;
    this.motion = vFromAngle(source.angle, this.speed);
    this.launchTicks = 0;
    this.orphanTicks = 0;
  }

  get homingStrength() {
    return this.launchTicks > 0 ? 0 : 0.12;
  }

  get directionOscillation() {
    // Two cycles per game-second (60 ticks), with a twenty-degree amplitude.
    return Math.sin(this.age * TWOPI / 30) * Math.PI / 9;
  }

  move() {
    if (this.dead || this.moveDissipation()) return;
    const previousOscillation = this.directionOscillation;
    if (this.age++ > 400) { this.dissipate(); return; }
    if (!this.target || this.target.dead) {
      this.target = null;
      for (const creep of creeps) {
        if (!creep.dead && (!this.target || this.distanceTo(creep) < this.distanceTo(this.target))) this.target = creep;
      }
    }
    if (this.target) this.orphanTicks = 0;
    else if (++this.orphanTicks >= 45) { this.dissipate(); return; }

    // Steer the underlying heading, so last tick's wobble cannot accumulate
    // into the homing turn. Age and motion already preserve this across saves.
    if (previousOscillation) this.motion = vFromAngle(vangle(this.motion) - previousOscillation, this.speed);
    if (this.target && this.homingStrength > 0) {
      const desired = vangle(vdiff(this.target.position, this.position));
      const heading = vangle(this.motion);
      const error = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
      this.motion = vFromAngle(heading + error * this.homingStrength, this.speed);
    }
    if (this.directionOscillation) this.motion = vFromAngle(vangle(this.motion) + this.directionOscillation, this.speed);
    if (this.launchTicks > 0) this.launchTicks--;
    this.position = vadd(this.position, this.motion);
    if (!this.launchTicks && this.target && this.distanceTo(this.target) <= this.target.radius) this.hit();
  }

  draw() {
    ctx.fillStyle="#afa";
    ctx.circle(0,0,5);
    ctx.fill();
  }
}

class OrbitalFragment extends Rock {
  constructor(source, target) {
    super(source, target);
    this.launchDuration = 50 + Math.floor(Math.random() * 25);
    this.launchTicks = this.launchDuration;
  }

  get homingStrength() {
    const progress = 1 - this.launchTicks / this.launchDuration;
    // Smoothly pick up directional steering as the radial launch finishes.
    return Math.min(0.12, 0.12 * progress * progress * (3 - 2 * progress));
  }

  get directionOscillation() { return 0; }

  draw() {
    ctx.fillStyle = '#301838';
    ctx.circle(0, 0, 3);
    ctx.fill();
    ctx.fillStyle = '#fff0ff';
    ctx.circle(0, 0, 1.5);
    ctx.fill();
  }
}

// Export to global environment (works in both browser and Node.js)
if (typeof module !== 'undefined' && module.exports) {
  globalThis.scaleHitPoints = scaleHitPoints;
  globalThis.scaleIncome = scaleIncome;
  globalThis.buyTower = buyTower;
  globalThis.Entity = Entity;
  globalThis.Creep = Creep;
  Object.assign(globalThis, {Mender, Shieldbug, Skimmer, Bulwark, Capacitor, Splitter});
  globalThis.Basic = Basic;
  globalThis.Zipper = Zipper;
  globalThis.Flyer = Flyer;
  globalThis.Ball = Ball;
  globalThis.BigBall = BigBall;
  globalThis.Spikey = Spikey;
  globalThis.Tower = Tower;
  globalThis.Star = Star;
  globalThis.Thumper = Thumper;
  globalThis.Stubby = Stubby;
  globalThis.Zappy = Zappy;
  globalThis.Woosh = Woosh;
  globalThis.Bullet = Bullet;
  globalThis.Flame = Flame;
  globalThis.Spiral = Spiral;
  globalThis.Pea = Pea;
  globalThis.Laser = Laser;
  globalThis.Rock = Rock;
  globalThis.OrbitalFragment = OrbitalFragment;
}
