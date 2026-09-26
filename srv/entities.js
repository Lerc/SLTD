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

  constructor () {
    let {x,y} = mapToWorld(levelMap.startPoint);
    super(x,y);
    this.angle=0;
    this.speed=2;
    this.turn=0.03;
    this.motion= v2(0,0);
    this.pathIndex = 0;
    this.image = Assets.Creep1;
    this.radius = 20;
    this.destination = mapToWorld(levelMap.path[0])
    this.findNextStep();

    this.damage = 0;
    this.travel=0;
    this.value = this.constructor.value;
    this.hitPoints = scaleHitPoints(this.constructor.hitPoints);

    this.timeout=0;
    this.slowTicks = 0;
    this.slowFactor = 1;
    this.burnTicks = 0;
    this.burnPower = 0;
    this.vulnerableTicks = 0;
    this.armor = 0;
    this.regeneration = 0;
    this.shield = 0;
    this.hitFlash = 0;
  }

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
    }
  }

  move () {
    if (this.dead) return;
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.vulnerableTicks > 0) this.vulnerableTicks--;
    if (this.burnTicks > 0) {
      this.burnTicks--;
      this.takeDamage(this.burnPower, 'fire', this.burnSource);
    } else if (this.regeneration) this.damage = Math.max(0, this.damage - this.regeneration * this.hitPoints);
    if (this.dead) return;
    const speedFactor = this.slowTicks > 0 ? this.slowFactor : 1;
    if (this.slowTicks > 0) this.slowTicks--;

    if (this.timeout++ >100) { //in case we're orbiting try a slightly different destination
      this.destination = vadd(mapToWorld(levelMap.path[this.pathIndex]),vrandom(8));
      this.timeout=0;
    }

    let delta = vdiff(this.destination,v2(this.x,this.y));

    this.travel = 1 - (vlength(delta)/1000);

    let turn = this.turn + (this.timeout/2000) // get tighter turning over time.
    this.motion= vnormalize(vadd(vnormalize(delta,turn),this.motion),this.speed * speedFactor);

    this.x+=this.motion.x;
    this.y+=this.motion.y;

    this.angle=vangle(this.motion);
    if ( vdistance(v2(this.x,this.y),this.destination) < vdistance(v2(this.x,this.y),this.source)) {
      this.findNextStep();
    }
  }

  applySlow(factor, ticks) {
    if (this.slowResistance) factor = 1 - (1 - factor) * 0.5;
    if (!this.slowTicks || factor < this.slowFactor) this.slowFactor = factor;
    this.slowTicks = Math.max(this.slowTicks, ticks);
  }

  applyBurn(ticks, power, source) {
    this.burnTicks = Math.max(this.burnTicks, ticks);
    this.burnPower = Math.max(this.burnPower, power);
    this.burnSource = source;
  }

  takeDamage(amount, kind = 'physical', source = null) {
    if (this.dead) return 0;
    if (kind === 'physical') amount *= 1 - this.armor;
    if (this.vulnerableTicks > 0) amount *= 1.35;
    // Shields absorb energy less efficiently; piercing bypasses them entirely.
    if (this.shield > 0 && kind !== 'piercing') {
      const multiplier = kind === 'energy' ? 2 : 1;
      const absorbed = Math.min(this.shield, amount * multiplier);
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
      combatEffect(this.position, '#403018');
    }
    return dealt;
  }

  die () {
    this.dead=true;
  }

  draw () {
    if (this.shield > 0 || this.slowTicks > 0 || this.burnTicks > 0 || this.armor > 0 || this.regeneration) {
      ctx.strokeStyle = this.burnTicks > 0 ? '#602008' : this.slowTicks > 0 ? '#185060' : this.shield > 0 ? '#303060' : this.armor ? '#403020' : '#105020';
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (this.armor) ctx.rect(-32, -32, 64, 64);
      else ctx.arc(0, 0, this.radius + 9, 0, TWOPI);
      ctx.stroke();
      if (this.regeneration) {
        ctx.fillStyle = '#105020';
        ctx.fillRect(-5, -20, 10, 40);
        ctx.fillRect(-20, -5, 40, 10);
      }
    }
    if (this.brood) {
      ctx.fillStyle = '#402838';
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * 44, 0, 8, 0, TWOPI); ctx.fill(); }
    }
    if (this.hitFlash > 0) {
      ctx.fillStyle = '#302018';
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, TWOPI); ctx.fill();
    }
    ctx.rotate(this.angle);
    ctx.drawSprite(this.image,0,0)

  }

  drawHealthBar () {
    if (this.damage > 0) {
      ctx.save();
      ctx.translate(this.x,this.y);
      ctx.scale(this.scale,this.scale);

      ctx.fillStyle="#080";
      let r=this.radius;
      ctx.fillRect(-r,-r,2*r,4);

      let p = this.damage/this.hitPoints;
      if (p > 1) p=1;
      ctx.fillStyle="#800";

      ctx.fillRect(r,-r,-2*r*p,4);


      ctx.restore();
    }
  }
}

class Basic extends Creep {
  static hitPoints = 10;

  constructor () {
    super();
    this.speed = 2;
    this.turn = 0.1;
    this.image = Assets.Creep1;
  }
}

class Zipper extends Creep {
  static value = 2;
  static hitPoints = 3;
  constructor () {
    super();
    this.speed = 4;
    this.turn = 0.3;
    this.scale = 0.5;
    this.image = Assets.Creep1;
  }
}

class Flyer extends Creep {
  static value=2;
  static hitPoints=15;
  constructor () {
    super();
    this.speed = 2.5;
    this.turn = 0.1;
    this.scale = 0.5;
    this.radius = 60;
    this.image = Assets.Creep4;
  }
}

class Ball extends Creep {
  static hitPoints=30;
  static value = 13;

  constructor () {
    super();
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
  constructor () {
    super();
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

    constructor () {
      super();
      this.speed = 1.1;
      this.turn = 0.0001;
      this.scale = 0.75;
      this.radius=55;
      this.image = Assets.Creep2;
    }
}



class Mender extends Creep {
  static hitPoints = 32;
  static value = 14;
  constructor() {
    super(); this.speed = 1.5; this.regeneration = 0.0008;
    this.image = Assets.Creep2; this.scale = 0.55;
  }
}
class Shieldbug extends Creep {
  static hitPoints = 24;
  static value = 12;
  constructor() {
    super(); this.speed = 1.7; this.shield = this.hitPoints * 0.8;
    this.image = Assets.Creep4; this.scale = 0.65;
  }
}
class Splitter extends Creep {
  static hitPoints = 42;
  static value = 10;
  constructor() { super(); this.speed = 1.3; this.image = Assets.Creep2; this.scale = 0.6; this.brood = true; }
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
      this.kills = 0;
      this.damageDealt = 0;
      this.invested = typeof towerInfo !== 'undefined' ? (getTowerInfo(this)?.cost || 100) : 100;

    }

    get bulletsComeOutHere() {
      return vnormalize(vFromAngle(this.angle),50);
    }

    move() {
      this.cooldown = max(this.cooldown-1,0);

      //if (!this.target?.dead) {
        this.target = this.findTarget();
      //}
      if (this.target) {
        this.angle = vangle( vdiff( this.target.position,this.position ))

        if (this.cooldown===0) {
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

  move() {
    if (this.dead || this.moveDissipation()) return;
    if (this.age++ > 400) { this.dissipate(); return; }
    if (!this.target || this.target.dead) {
      this.target = null;
      for (const creep of creeps) {
        if (!creep.dead && (!this.target || this.distanceTo(creep) < this.distanceTo(this.target))) this.target = creep;
      }
    }
    if (this.target) this.orphanTicks = 0;
    else if (++this.orphanTicks >= 45) { this.dissipate(); return; }

    if (this.target && this.homingStrength > 0) {
      const desired = vangle(vdiff(this.target.position, this.position));
      const heading = vangle(this.motion);
      const error = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
      this.motion = vFromAngle(heading + error * this.homingStrength, this.speed);
    }
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
    this.launchDuration = 36 + Math.floor(Math.random() * 25);
    this.launchTicks = this.launchDuration;
  }

  get homingStrength() {
    const progress = 1 - this.launchTicks / this.launchDuration;
    // Smoothly pick up directional steering as the radial launch finishes.
    return 0.12 * progress * progress * (3 - 2 * progress);
  }

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
  Object.assign(globalThis, {Mender, Shieldbug, Splitter});
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
  globalThis.Spiral = Spiral;
  globalThis.Pea = Pea;
  globalThis.Laser = Laser;
  globalThis.Rock = Rock;
  globalThis.OrbitalFragment = OrbitalFragment;
}
