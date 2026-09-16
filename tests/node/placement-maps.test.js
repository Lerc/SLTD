const assert = require('node:assert/strict');
const game = require('../../srv/nodemain.js');
const foundation = towerInfo[0];
function reset() { startGame('foundry'); }
reset();
beginPlacement(foundation);
tapPlacement(v2(3,2));
assert.equal(towers.length,0,'Preview does not spend or build');
assert.equal(money,320);
assert.deepEqual(placement.cell,v2(3,2));
tapPlacement(v2(3,2));
assert.equal(towers.length,1); assert.equal(money,220);
assert.equal(placement.mode,'idle'); assert.equal(selectedBuild,null);
beginPlacement(foundation); tapPlacement(v2(2,2));
assert.equal(placement.mode,'idle','Road cancels placement');
beginPlacement(foundation); tapPlacement(v2(3,2));
assert.equal(placement.mode,'idle','Occupied tile cancels placement');
beginPlacement(foundation); tapPlacement(v2(5,4)); tapPlacement(v2(6,4));
assert.deepEqual(placement.cell,v2(6,4)); assert.equal(towers.length,1);
cancelPlacement();
for (const cell of [v2(5,4),v2(2,2),v2(-1,4),v2(3,2)]) {
  const count=towers.length;
  beginPlacement(foundation,'drag'); dragPlacement(cell); finishPlacementDrag(cell);
  assert.equal(placement.mode,'idle','Every drag release ends the operation');
  assert.equal(selectedBuild,null);
  assert.equal(towers.length,count+(cell.x===5?1:0));
}
reset(); globalThis.money=50;
beginPlacement(foundation); tapPlacement(v2(3,2));
assert.equal(placement.blocked,true);
globalThis.money=500; tapPlacement(v2(3,2));
assert.equal(placement.mode,'idle','A bounty cannot turn an insufficient-funds dismissal into a purchase');
assert.equal(towers.length,0);
beginPlacement(foundation); tapPlacement(v2(3,2)); globalThis.money=0; updatePlacement();
assert.equal(placement.blocked,true); tapPlacement(v2(5,4)); assert.equal(placement.mode,'idle');
beginPlacement(foundation,'drag'); dragPlacement(v2(3,2)); finishPlacementDrag(v2(3,2));
assert.equal(placement.mode,'idle'); assert.equal(towers.length,0);
console.log('PASS tap confirmation, invalid/occupied tiles, drag completion and insufficient-funds cancellation');

for (const map of mapCatalog) {
  startGame(map.id);
  assert.equal(selectedMapId,map.id);
  assert.equal(map.cells.length,16); assert.ok(map.cells.every(row=>row.length===11));
  const dots=map.cells.join('').split('').filter(c=>c==='.').length;
  assert.equal(levelMap.path.length,dots+2,'Route visits every road tile exactly once: '+map.id);
  assert.equal(new Set(levelMap.path.map(p=>p.x+','+p.y)).size,levelMap.path.length);
  assert.equal(levelMap.path.at(-1).y,16,'Route exits the bottom');
  const cell=map.cells.flatMap((row,y)=>[...row].flatMap((c,x)=>c==='#'?[v2(x,y)]:[]))[0];
  buyTower(foundation,cell.x,cell.y);
  const state=game.saveState(); startGame('foundry'); game.loadState(state);
  assert.equal(selectedMapId,map.id);
  assert.deepEqual(activeMapCells,map.cells,'Save retains selected map');
  assert.ok(levelMap.canBuildHere(towers[0].cellPosition));
  startGame(map.id); sendWave(); game.tick(10000);
  assert.ok(waveCounter>1 || lives===0,'Enemies can traverse '+map.id);
  console.log(`PASS map ${map.id}: ${dots} route tiles, save/load and traversal`);
}
reset();
