const check = (condition, message) => { if (!condition) throw new Error(message); };
const button = id => document.getElementById(id);
startGame(); paused = true; updateUI(true);
button('build-deck').querySelector('[data-build="Tower"]').click();
await gameControl.tapCell(3, 2);
check(towers.length === 1 && towers[0].cellPosition.x === 3, 'Tap builds at the intended tile');
check(money === 220, 'Only one purchase for a tap');
await gameControl.tapTower(towers[0]);
check(selectedTower === towers[0], 'Tap selects tower');
check(!button('tower-deck').hidden && button('build-deck').hidden, 'Management replaces build deck');
check(button('tower-deck').querySelectorAll('[data-upgrade]').length === 2, 'Two upgrade choices');
button('target-mode').click();
check(selectedTower.targetMode === 'strong', 'Target priority changes while paused');
button('tower-deck').querySelector('[data-upgrade="Ranger"]').click();
check(towers[0].constructor.name === 'Ranger' && money === 80, 'Upgrade charges incremental price');
check(selectedTower.targetMode === 'strong', 'Upgrade preserves priority');
check(button('tower-deck').querySelectorAll('[data-upgrade]').length === 0, 'Branch choice is permanent');
button('sell-tower').click(); check(towers.length === 1, 'First sell tap asks confirmation');
button('sell-tower').click(); check(towers.length === 0 && money === 248, 'Second tap refunds 70%');
// Touch identifier 0 and centered canvas offsets must both work.
const pos = gameControl.cellToCanvas(5, 4), client = gameControl.canvasToClient(pos.x, pos.y);
button('build-deck').querySelector('[data-build="Tower"]').click();
const touchData = {identifier: 0, target: outputCanvas, clientX: client.clientX, clientY: client.clientY};
const touch = typeof Touch === 'function' ? new Touch(touchData) : touchData;
for (const type of ['touchstart', 'touchend']) {
  const touches = type === 'touchstart' ? [touch] : [];
  const event = new Event(type, {bubbles:true, cancelable:true});
  Object.defineProperties(event, {touches:{value:touches}, changedTouches:{value:[touch]}});
  outputCanvas.dispatchEvent(event);
}
check(towers.length === 1 && towers[0].cellPosition.x === 5 && towers[0].cellPosition.y === 4, 'Touch builds in correct cell');
await gameControl.tapTower(towers[0]);
button('close-tower').click();
check(selectedTower === null && !button('build-deck').hidden, 'Close returns to build menu');
button('help').click(); check(button('field-guide').open, 'Field guide opens');
button('close-guide').click(); await new Promise(r => setTimeout(r,50));
check(paused, 'Guide restores previous pause state');
button('pause').click(); check(!paused, 'Pause control resumes');
button('send-wave').click();
await gameControl.advanceTicks(240);
check(!betweenWaves && creeps.length > 0, 'Wave launches and advances');
check(running, 'Rendering remains active');
paused = true; updateUI(true);
const shell = button('game-shell').getBoundingClientRect(), canvas = outputCanvas.getBoundingClientRect();
check(document.documentElement.scrollWidth <= innerWidth, 'No horizontal overflow');
check(shell.bottom <= innerHeight + 1, 'Controls fit in viewport');
check(canvas.height > 100 && canvas.width > 60, 'Battlefield remains visible');
for (const el of document.querySelectorAll('button')) {
  if (el.offsetParent === null) continue;
  const rect = el.getBoundingClientRect();
  check(rect.height >= 43, 'Touch height: ' + (el.id || el.textContent));
  check(rect.left >= -1 && rect.right <= innerWidth + 1, 'Button fits horizontally: ' + el.textContent);
}
wslog({result:'PASS', viewport:[innerWidth,innerHeight], canvas:[Math.round(canvas.width),Math.round(canvas.height)], towers:towers.length, wave:waveCounter});
