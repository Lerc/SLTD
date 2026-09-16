const assert=require('node:assert/strict');
const game=require('../../srv/nodemain.js');
function reset(){startGame('foundry');money=100000;}
function buildType(type){
  const info=towerInfo.find(i=>i.type.name===type);
  if(info.buildable){assert.ok(game.placeTower(type,3,2).success);return towers[0];}
  return upgradeTower(buildType(towerInfo.find(i=>i.upgrades?.includes(type)).type.name),type);
}
for(const info of towerInfo){
  reset();const tower=buildType(info.type.name);
  const base={power:tower.power,rate:tower.rate,range:tower.range};
  const initialCost=levelUpCost(tower);
  if(info.upgrades)assert.ok(info.upgrades.every(name=>towerInfo.find(i=>i.type.name===name).cost>initialCost),'Level costs less than branching');
  for(let level=2;level<=8;level++){
    const price=levelUpCost(tower),balance=money,invested=tower.invested,oldStats=[tower.power,tower.rate,tower.range];
    assert.equal(levelUpTower(tower),tower,'Leveling keeps the same tower');
    assert.equal(tower.level,level);assert.equal(money,balance-price);assert.equal(tower.invested,invested+price);
    assert.ok(tower.power>oldStats[0]&&tower.rate>oldStats[1]&&tower.range>oldStats[2],'Every level improves all core stats');
    assert.ok(levelUpCost(tower)>price,'Prices rise every level');
  }
  assert.ok(tower.range<base.range*2&&tower.rate<base.rate*3,'Range and rate retain sensible limits');
  const stats=[tower.power,tower.rate,tower.range,tower.burnPower,tower.slowFactor];
  const state=game.saveState();game.loadState(state);
  assert.deepEqual([towers[0].power,towers[0].rate,towers[0].range,towers[0].burnPower,towers[0].slowFactor],stats,'Reload reconstructs levels without compounding');
  assert.equal(towers[0].level,8);assert.equal(towers[0].invested,tower.invested);
}
reset();let sentry=buildType('Tower');const price=levelUpCost(sentry);money=price-1;
assert.equal(levelUpTower(sentry),false);assert.equal(sentry.level,1);assert.equal(money,price-1);
assert.equal(levelUpTower(null),false);
money=10000;levelUpTower(sentry);levelUpTower(sentry);
const invested=sentry.invested;const upgraded=upgradeTower(sentry,'Ranger');
assert.equal(upgraded.level,3);assert.equal(upgraded.invested,invested+420);
assert.equal(levelUpTower(sentry),false,'Replaced towers cannot spend credits');
assert.equal(sellValue(upgraded),Math.floor(upgraded.invested*.7));
sellTower(upgraded);assert.equal(levelUpTower(upgraded),false);

// A projectile captures damage when fired; leveling cannot strengthen old shots.
reset();sentry=buildType('Tower');const target=new BigBall();target.position=vadd(sentry.position,v2(60,0));creeps.push(target);sentry.target=target;sentry.fire();
const oldDamage=bullets[0].damage;levelUpTower(sentry);sentry.fire();
assert.equal(bullets[0].damage,oldDamage);assert.ok(bullets[1].damage>oldDamage);
const shotState=game.saveState();game.loadState(shotState);assert.equal(bullets[0].damage,oldDamage,'Save preserves pre-level projectile damage');
reset();const nova=buildType('Thumper');nova.fire();const oldRange=bullets[0].range;
levelUpTower(nova);game.loadState(game.saveState());
assert.equal(bullets[0].range,oldRange,'Save preserves pre-level area-pulse range');

// Character-specific effects must reach the combat code, not just the panel.
for(const type of ['Incinerator','Inferno','Firestorm','Cryo','Tesla','Thumper']){
  reset();const tower=buildType(type);for(let i=0;i<5;i++)levelUpTower(tower);
  const targets=Array.from({length:8},(_,i)=>{const c=new BigBall();c.hitPoints=1e6;c.slowResistance=0;c.position=vadd(tower.position,v2(55+i*3,0));return c;});
  creeps=targets;tower.target=targets[0];tower.fire();
  if(tower.behavior==='burn'){assert.equal(targets[0].burnPower,tower.burnPower);assert.equal(targets[0].burnTicks,tower.burnDuration);}
  if(type==='Cryo')assert.equal(targets[0].slowFactor,tower.slowFactor);
  if(type==='Tesla')assert.equal(targets.filter(c=>c.damage>0).length,tower.chainCount);
  if(type==='Thumper'){for(let i=0;i<31;i++)bullets[0].move();assert.equal(targets[0].damage,tower.power);}
}
reset();assert.ok(game.placeTower('Incinerator',3,2).success);assert.equal(game.placeTower('Star',5,4).success,false);
assert.equal(towerInfo.filter(i=>i.buildable).length,5);
console.log('PASS all 17 growth profiles, rising costs, inherited levels, refunds, saves, live damage/effects and revised foundations');
