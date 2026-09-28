const check = (condition, message) => { if (!condition) { wslog('FAIL: '+message); throw new Error(message); } };
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
async function tap(id) {
  const b=uiControls().find(b=>b.id===id);
  check(b&&!b.disabled,'Control available: '+id);
  await gameControl.tapCanvas(b.x+b.w/2,b.y+b.h/2);
}
function pointer(type, cell, id=0, pointerType='touch') {
  const p=gameControl.canvasToClient(cell.x,cell.y);
  outputCanvas.dispatchEvent(new PointerEvent(type,{...p,pointerId:id,pointerType,button:0,buttons:type==='pointerup'||pointerType==='mouse'?0:1,bubbles:true,cancelable:true}));
}
function dragList(fromY, toY, pointerType='touch', cancel=false) {
  pointer('pointerdown', {x:500,y:fromY}, 0, pointerType);
  pointer('pointermove', {x:500,y:toY}, 0, pointerType);
  pointer(cancel?'pointercancel':'pointerup', {x:500,y:toY}, 0, pointerType);
}
function wheel(y, deltaY, deltaMode=0) {
  const client=gameControl.canvasToClient(500,y);
  const event=new WheelEvent('wheel',{...client,deltaY,deltaMode,bubbles:true,cancelable:true});
  outputCanvas.dispatchEvent(event);
  return event.defaultPrevented;
}
startGame('foundry'); paused=true;
cancelPlacement(); initUI(); selectedTower=null; gameMode=titleScreen;
await tap('start');
check(uiModal()==='maps'&&gameMode===titleScreen,'Map picker precedes game start');
check(!uiControls().some(b=>b.id==='maps-prev'||b.id==='maps-next'),'List has no paging buttons');
check(uiMapScroll===0,'First map opens at the top');
const deployRect=JSON.stringify(uiControls().find(b=>b.id==='deploy'));
const seenMaps = new Set();
for (let drag=0; drag<8; drag++) {
  for (const card of uiControls().filter(b=>b.map)) seenMaps.add(card.map.id);
  check(JSON.stringify(uiControls().find(b=>b.id==='deploy'))===deployRect,'Deploy remains fixed while scrolling');
  if (uiMapScroll===uiMapScrollLimit()) break;
  dragList(1200,600,drag%2?'mouse':'touch');
  check(uiMapChoice==='foundry','Dragging does not select a card');
  await frame();
}
check(JSON.stringify([...seenMaps])===JSON.stringify(mapCatalog.map(m=>m.id)),'Dragging exposes every map');
check(uiMapScroll===uiMapScrollLimit(),'Dragging clamps at the last map');
dragList(1200,400);
check(uiMapScroll===uiMapScrollLimit(),'Cannot drag beyond the bottom');
await tap('map-interlace');
check(uiMapChoice==='interlace','Tap selects the last map');
await gameControl.screenshot('scroll-map-picker');
dragList(600,1000,'mouse',true);
check(!uiGesture && uiMapChoice==='interlace','Pointer cancellation keeps selection and ends the drag');
const beforeWheel=uiMapScroll;
check(!wheel(200,-100)&&uiMapScroll===beforeWheel,'Header wheel does not move the list');
check(wheel(700,-120)&&uiMapScroll<beforeWheel,'Wheel scrolls the list');
check(wheel(700,-1,2)&&uiMapScroll<beforeWheel,'Page-mode wheel scrolls the list');
check(wheel(700,-10000,1)&&uiMapScroll===0,'Line-mode wheel clamps at the top');
// Start in the gap between cards, then drag until the top card is clipped.
dragList(1005,905);
check(Math.abs(uiMapScroll-100)<.001 && uiMapChoice==='interlace','Gaps also support dragging');
const clipped=uiControls().find(b=>b.map);
check(!uiRectContains(clipped,{x:500,y:320}),'Hidden portion of a card cannot receive header taps');
check(!uiControls().some(b=>b.map&&uiRectContains(b,{x:500,y:1640})),'Cards cannot receive footer taps');
await gameControl.tapCanvas(500,320);
check(uiMapChoice==='interlace','Tapping above the clipped list does not select a map');
dragList(600,1600);
check(uiMapScroll===0,'Cannot drag beyond the top');
check(uiControls().find(b=>b.id==='deploy').sub==='Interlace','Deploy identifies an offscreen selection');
await tap('deploy'); paused=true;
check(selectedMapId==='interlace' && levelMap.path.length===85,'Deploy loads full crossing route');
const pngSave=gameControl.saveState();
startGame('foundry'); gameControl.loadState(pngSave); paused=true;
check(selectedMapId==='interlace' && JSON.stringify(levelMap.path)===JSON.stringify(mapCatalog.at(-1).path),'PNG map survives browser save/load');
await gameControl.screenshot('png-map-interlace');
abandonGame();
check(uiControls().some(b=>b.id==='map-interlace'&&b.selected&&b.y>=uiMapList.y&&b.y+b.h<=uiMapList.y+uiMapList.h),'Returning to selection reveals the current map');
wheel(700,-10000);
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
// Modal mouse movement uses the same preview cell as dragging, without a held button.
const elsewhere=gameControl.cellToCanvas(5,4);
pointer('pointermove',elsewhere,0,'mouse');
check(placement.cell.x===5&&placement.cell.y===4,'Modal preview follows mouse movement without a held button');
check(towers.length===0&&money===320,'Mouse movement only previews');
pointer('pointermove',gameControl.cellToCanvas(2,2),0,'mouse');
check(placement.mode==='tap'&&placement.cell.x===2&&!validPlacementCell(placement.cell),'Hovering a road previews invalid placement without cancelling');
const pauseControl=uiControls().find(b=>b.id==='pause');
pointer('pointermove',{x:pauseControl.x+pauseControl.w/2,y:pauseControl.y+pauseControl.h/2},0,'mouse');
check(placement.cell.x===2&&placement.cell.y===2,'HUD hover does not move the map preview');
uiOverlay='pause';
pointer('pointermove',elsewhere,0,'mouse');
check(placement.cell.x===2&&placement.cell.y===2,'An open overlay blocks preview movement');
uiOverlay=null;
pointer('pointermove',gameControl.cellToCanvas(3,2),0,'mouse');
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
pointer('pointermove',gameControl.cellToCanvas(6,4),0,'mouse');
check(placement.cell.x===6&&placement.blocked,'Mouse movement keeps insufficient-funds cancellation latched after income');
await gameControl.tapCell(6,4);
check(placement.mode==='idle'&&towers.length===1&&money===1000,'Income never changes cancellation into purchase');
await tap('build-Tower');
check(placement.cell===null,'Selecting a foundation starts without a preview');
pointer('pointermove',elsewhere,0,'mouse');
check(placement.cell.x===5&&placement.cell.y===4,'Mouse movement creates the initial modal preview');
cancelPlacement();
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
check(send.stamp==='SEND'&&send.label==='1'&&send.sub==='+$0','First launch previews no bonus while the reward pot is empty');
paused=false; sendWave();
send=uiHudControls().find(b=>b.id==='send');
check(send.label==='2'&&send.disabled,'During wave one Send previews wave two');
creeps=[]; hopper=[]; backlog=[]; mainGame_core(); paused=true;
send=uiHudControls().find(b=>b.id==='send');
check(send.label==='2'&&send.sub==='+$0'&&waveClearPayout,'Clear presentation previews the next wave without a second bonus');
check(JSON.stringify(outputCanvas.getBoundingClientRect().toJSON())===original,'Map, placement and HUD changes never resize view');
wslog({result:'PASS',maps:mapCatalog.map(m=>m.id),placement:'preview/confirm or one-shot drag',hud:'filled Wave/Send labels',viewport:[innerWidth,innerHeight]});
