"use strict"

function scaleHitPoints(amount) {
  return amount*difficulty;// probably want a curve later
}

let economy = 0.8;
function scaleIncome(amount) {
  return Math.floor(amount*Math.sqrt(difficulty) * economy);
}


function buyTower(info,cellX,cellY) {
  if (money >= info.cost) {
    money = globalThis.money = money - info.cost;
    globalThis.towers.push(new info.type(cellX,cellY));
    towers = globalThis.towers;
  }

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
      lives = globalThis.lives = lives - 1;
    }
  }

  move () {

    if (this.timeout++ >100) { //in case we're orbiting try a slightly different destination
      this.destination = vadd(mapToWorld(levelMap.path[this.pathIndex]),vrandom(8));
      this.timeout=0;
    } 

    let delta = vdiff(this.destination,v2(this.x,this.y));

    this.travel = 1 - (vlength(delta)/1000);

    let turn = this.turn + (this.timeout/2000) // get tighter turning over time.
    this.motion= vnormalize(vadd(vnormalize(delta,turn),this.motion),this.speed);

    this.x+=this.motion.x;
    this.y+=this.motion.y;

    this.angle=vangle(this.motion);
    if ( vdistance(v2(this.x,this.y),this.destination) < vdistance(v2(this.x,this.y),this.source)) {
      this.findNextStep();
    }
  }

  takeDamage(amount) {
    this.damage += amount;
    if (!this.dead && this.damage > this.hitPoints) {
      this.die();
      money = globalThis.money = money + scaleIncome(this.value);
    }
  }

  die () {
    this.dead=true;
  }

  draw () {
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
    this.speed = 0.5;
    this.turn = 0.09;
    this.radius=45;
    this.scale = 0.5;
    this.image = Assets.Creep3;    
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
    this.speed = 0.5;
    this.turn = 0.09;
    this.radius=45;
    this.scale = 1;
    this.image = Assets.Creep3;    
  }
}

class Spikey extends Creep {
    static value = 8;
    static hitPoints = 50;

    constructor () {
      super();
      this.speed = 0.75;
      this.turn = 0.0001;
      this.scale = 0.75;
      this.radius=55;
      this.image = Assets.Creep2;    
    }
}



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
      this.rate = 20;
      this.range =this.constructor.range || Tower.range ;
      this.minimumRange= this.constructor.minimumRange || Tower.minimumRange;
      
      this.bulletKind = Pea;

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
      for (let c of creeps) {
        let d = this.distanceTo(c)
        if ( d < this.range && d > this.minimumRange) {
          return c;
        }
      }
    }

    draw () {
      ctx.drawSprite(Assets.Tower1);

      ctx.rotate(this.angle);
      ctx.drawSprite(Assets.Gun1);
      //this.drawRange();
    }

    drawRange() {
      ctx.fillStyle="#fff2";
      ctx.lineWidth=5;
      ctx.strokeStyle="#fff7";
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
    this.rate = 5;
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
    this.damage = 45; 
    
  }

  move() {
    this.age+=1;
    if (this.age > 30) {

      let enemies = creeps.filter(a=>a.distanceTo(this)<this.source.range);
      for (let e of enemies) {
        e.takeDamage(this.damage);
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
    this.damage = 2;
  }

  hit() {
    this.target.takeDamage(this.damage);
    this.dead=true;
    let pos= this.position;
    globalThis.particleSystems.push(particleSystem(this.damage,{pos}));
    particleSystems = globalThis.particleSystems;
  }
}

class Spiral extends Bullet {
  constructor (source,target)  {
    super(source,target);


    this.damage = 100;
    this.angle = source.outAngle;
    this.age = 0;
  }

  move() {
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


    this.damage = 4;
    this.speed = 5;
  }

  move() {
    let delta = vdiff(this.target.position,this.position)
    let motion = vnormalize(delta,this.speed);

    this.position=vadd(this.position,motion);
    
    if (this.distanceTo(this.target) < this.target.radius) this.hit(this.target);
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
    this.damage = 2;
    this.speed = 10;
  }


  move() {
    super.move();
    this.speed= min(this.speed*1.5,30);
  }

  draw() {
    let delta = vdiff(this.target.position,this.position)
    let motion = vnormalize(delta,10);
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
    this.damage = 15;
    this.speed = 3;
  }

  draw() {
    ctx.fillStyle="#afa";
    ctx.circle(0,0,5);
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
}
