const check = (condition, message) => { if (!condition) throw new Error(message); };
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
async function settle() {
  const limit = performance.now() + 10000;
  do { await frame(); } while (Math.abs(uiSlide - (selectedTower ? 1 : 0)) > 0.001 && performance.now() < limit);
  check(Math.abs(uiSlide - (selectedTower ? 1 : 0)) < 0.001, 'Panel animation settles');
}
async function tap(id) {
  await settle();
  const button = uiControls().find(b => b.id === id);
  check(button && !button.disabled, 'Control available: ' + id);
  await gameControl.tapCanvas(button.x + button.w / 2, button.y + button.h / 2);
  await settle();
}
function geometry() {
  const r = outputCanvas.getBoundingClientRect();
  const p = gameControl.canvasToClient(...Object.values(gameControl.cellToCanvas(5, 4)));
  return JSON.stringify({rect:[r.x,r.y,r.width,r.height], map:p, buffer:[outputCanvas.width,outputCanvas.height], transform:[gameViewTransform.a,gameViewTransform.d,gameViewTransform.e,gameViewTransform.f]});
}
startGame('foundry'); paused = true;
await settle();
const original = geometry();
const fixed = phase => check(geometry() === original, 'Map geometry unchanged: ' + phase);
check(document.querySelectorAll('button, dialog, header, footer, svg').length === 0, 'All controls are canvas-rendered');
await tap('build-Tower'); await gameControl.tapCell(3, 2);
check(towers.length === 0 && placement.cell?.x === 3, 'First map tap previews without building');
await gameControl.tapCell(3, 2);
check(towers.length === 1 && money === 220, 'Tap builds exactly one tower');
await gameControl.tapTower(towers[0]);
// Sample every frame through the slide, not just its endpoints.
for (let i = 0; i < 5; i++) { await frame(); fixed('sliding'); }
await settle();
fixed('management open');
check(uiControls().filter(b => b.id.startsWith('upgrade-')).length === 2, 'Two branches replace the build strip');
check(!uiControls().some(b => b.id.startsWith('build-')), 'Covered build controls cannot receive input');
await tap('target');
check(selectedTower.targetMode === 'strong', 'Target priority changes');
check(!uiControls().some(b=>b.id==='close-tower'),'No close button consumes panel space');
await tap('level-up'); check(selectedTower.level===2&&money===180,'Affordable level improves the existing tower'); fixed('leveled');
money+=500;
await tap('upgrade-Ranger');
check(towers[0].constructor.name === 'Ranger' && money === 260, 'Upgrade charges the increased cost');
check(selectedTower.level===2,'Branch retains level investment');
check(selectedTower.targetMode === 'strong', 'Upgrade retains priority'); fixed('upgraded');
await tap('sell'); check(towers.length === 1, 'First sell tap arms confirmation'); fixed('sell confirmation');
await tap('sell'); check(towers.length === 0 && money === 652, 'Second sell tap refunds 70%'); fixed('sold');

function pointer(type, pos, id = 0) {
  const client = gameControl.canvasToClient(pos.x, pos.y);
  outputCanvas.dispatchEvent(new PointerEvent(type, {...client, pointerId:id, pointerType:'touch', button:0, buttons:type === 'pointerup' ? 0 : 1, bubbles:true, cancelable:true}));
}
const build = uiControls().find(b => b.id === 'build-Tower');
const start = {x:build.x+build.w/2,y:build.y+build.h/2};
const end = gameControl.cellToCanvas(5,4);
pointer('pointerdown',start); pointer('pointermove',end); pointer('pointerup',end);
check(placement.mode === 'idle', 'Drag release clears modal placement');
check(towers.length === 1 && towers[0].cellPosition.x === 5 && towers[0].cellPosition.y === 4, 'Touch drag with identifier zero builds at correct coordinates');
const cancelEnd = gameControl.cellToCanvas(6,4);
pointer('pointerdown',start); pointer('pointermove',cancelEnd); pointer('pointercancel',cancelEnd); pointer('pointerup',cancelEnd);
check(towers.length === 1 && placement.mode === 'idle', 'Cancelled drag never builds or leaves placement active');
await gameControl.tapTower(towers[0]); await settle();
await gameControl.tapCell(3,2); await settle(); check(selectedTower===null,'Empty-ground tap dismisses management'); fixed('closed');
await tap('pause'); check(!paused, 'Resume from paused inspection');
await tap('pause'); check(paused && uiOverlay === 'pause', 'Pause opens canvas overlay'); fixed('paused overlay');
const count = towers.length;
await gameControl.tapCell(3, 2); check(towers.length === count && uiOverlay === 'pause', 'Modal captures map input');
await tap('guide'); check(uiOverlay === 'guide' && paused, 'Guide only appears while paused'); fixed('guide');
await tap('guide-next'); check(uiGuidePage === 1, 'Guide pages work');
await tap('guide-close'); await tap('plan'); check(paused && !uiOverlay, 'Inspection leaves time paused'); fixed('inspection');
await tap('pause'); await tap('send');
await gameControl.advanceTicks(240);
check(!betweenWaves && waveAge > 0 && running, 'Wave and rendering advance');
paused = true;
await gameControl.tapTower(towers[0]); await settle(); fixed('active-wave management');
const rect = outputCanvas.getBoundingClientRect();
check(Math.abs(rect.width / rect.height - 1080 / 1848) < 0.001, 'Fixed portrait aspect in every orientation');
check(rect.width <= innerWidth + 1 && rect.height <= innerHeight + 1, 'Canvas fits viewport');
check(Math.abs(rect.left - (innerWidth - rect.width) / 2) < 2, 'Portrait game centered with blank side space');
check(document.documentElement.scrollWidth <= innerWidth, 'No horizontal overflow');
if (innerWidth >= 320 && innerHeight >= 568 && innerWidth < innerHeight) {
  for (const b of uiControls()) {
    check(b.h * rect.height / 1848 >= 44, 'Phone hit height: ' + b.id);
    check(b.w * rect.width / 1080 >= 44, 'Phone hit width: ' + b.id);
  }
}
wslog({result:'PASS',viewport:[innerWidth,innerHeight],portrait:[Math.round(rect.width),Math.round(rect.height)],mapHeight:Math.round(1536*rect.height/1848),stable:true,renderer:'canvas'});
