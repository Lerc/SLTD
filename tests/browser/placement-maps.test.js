const check = (condition, message) => { if (!condition) throw new Error(message); };
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
async function tap(id) {
  const b=uiControls().find(b=>b.id===id);
  check(b&&!b.disabled,'Control available: '+id);
  await gameControl.tapCanvas(b.x+b.w/2,b.y+b.h/2);
}
function pointer(type, cell, id=0) {
  const p=gameControl.canvasToClient(cell.x,cell.y);
  outputCanvas.dispatchEvent(new PointerEvent(type,{...p,pointerId:id,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,bubbles:true,cancelable:true}));
}
cancelPlacement(); initUI(); selectedTower=null; gameMode=titleScreen;
await tap('start');
check(uiModal()==='maps'&&gameMode===titleScreen,'Map picker precedes game start');
check(uiControls().filter(b=>b.map).length===3,'Three selectable route previews');
await tap('map-switchback'); check(uiMapChoice==='switchback','Map card changes choice');
await tap('deploy'); paused=true;
check(selectedMapId==='switchback'&&levelMap.path[0].x===9&&levelMap.path[0].y===16,'Deploy uses bottom-right entrance');
const saved=gameControl.saveState();
startGame('crosswind'); gameControl.loadState(saved); paused=true;
check(selectedMapId==='switchback'&&JSON.stringify(levelMap.path)===JSON.stringify(mapCatalog[1].path),'Browser snapshot retains ordered map route');
startGame('foundry'); paused=true;
await frame();
const original=JSON.stringify(outputCanvas.getBoundingClientRect().toJSON());
await tap('build-Tower'); await gameControl.tapCell(3,2);
check(towers.length===0&&money===320&&placement.cell?.x===3,'Second tap positions the confirmation square');
// Moving the pointer cannot silently move a modal confirmation.
const elsewhere=gameControl.cellToCanvas(5,4);
pointer('pointermove',elsewhere);
check(placement.cell.x===3&&placement.cell.y===2,'Confirmation cell is fixed until another tap');
await gameControl.tapCell(3,2);
check(towers.length===1&&money===220&&placement.mode==='idle','Third tap confirms and finishes placement');
await gameControl.tapCell(5,4); check(towers.length===1,'No modal placement leaks after a completed build');
await tap('build-Tower'); await gameControl.tapCell(2,2);
check(placement.mode==='idle','Road tap cancels');
await tap('build-Tower'); await gameControl.tapCell(3,2);
check(placement.mode==='idle'&&selectedTower===null,'Occupied tile cancels without selecting its tower');
money=50; await tap('build-Incinerator'); await gameControl.tapCell(5,4);
check(placement.blocked&&placement.mode==='tap'&&towers.length===1,'Unaffordable foundation can be previewed');
const wasPaused=paused;
await tap('pause');
check(placement.mode==='idle'&&paused===wasPaused,'Next HUD tap only cancels insufficient-funds preview');
money=50; await tap('build-Incinerator'); await gameControl.tapCell(5,4);
money=1000;
await gameControl.tapCell(5,4);
check(placement.mode==='idle'&&towers.length===1&&money===1000,'Income never changes cancellation into purchase');
for (const [cell, succeeds] of [[{x:5,y:4},true],[{x:2,y:2},false],[{x:5,y:4},false]]) {
  const b=uiControls().find(b=>b.id==='build-Tower');
  const from={x:b.x+b.w/2,y:b.y+b.h/2};
  const to=gameControl.cellToCanvas(cell.x,cell.y), before=towers.length;
  pointer('pointerdown',from); pointer('pointermove',to); pointer('pointerup',to);
  check(towers.length===before+Number(succeeds),'Drag release validates destination');
  check(placement.mode==='idle'&&selectedBuild===null,'Every release ends drag mode');
}
const b=uiControls().find(b=>b.id==='build-Tower'), from={x:b.x+b.w/2,y:b.y+b.h/2};
pointer('pointerdown',from); pointer('pointermove',elsewhere); pointer('pointercancel',elsewhere);
check(placement.mode==='idle','Pointer cancellation ends drag mode');
let send=uiHudControls().find(b=>b.id==='send');
check(send.stamp==='SEND'&&send.label==='1'&&send.sub==='+$15','Send stamp previews first launch and early bonus');
paused=false; sendWave();
send=uiHudControls().find(b=>b.id==='send');
check(send.label==='2'&&send.disabled,'During wave one Send previews wave two');
creeps=[]; hopper=[]; backlog=[]; mainGame_core(); paused=true;
send=uiHudControls().find(b=>b.id==='send');
check(send.label==='2'&&send.sub==='+$10','Preparation shows correct pending wave and bonus');
check(JSON.stringify(outputCanvas.getBoundingClientRect().toJSON())===original,'Map, placement and HUD changes never resize view');
wslog({result:'PASS',maps:mapCatalog.map(m=>m.id),placement:'preview/confirm or one-shot drag',hud:'filled Wave/Send labels',viewport:[innerWidth,innerHeight]});
