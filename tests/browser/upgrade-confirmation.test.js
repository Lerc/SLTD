const check = (condition, message) => { if (!condition) throw new Error(message); };
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
async function settle() {
  for (let i = 0; i < 30 && Math.abs(uiSlide - (selectedTower ? 1 : 0)) > .001; i++) await frame();
}
function control(id) { return uiControls().find(b => b.id === id); }
async function tap(id) {
  const b = control(id); check(b, 'Control exists: ' + id);
  await gameControl.tapCanvas(b.x + b.w / 2, b.y + b.h / 2);
}
function pointer(type, x, y) {
  outputCanvas.dispatchEvent(new PointerEvent(type, {...gameControl.canvasToClient(x, y),
    pointerId: 7, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1,
    bubbles: true, cancelable: true}));
}
startGame('foundry'); paused = true; money = 10000;
check(buyTower(towerInfo.find(info => info.type === Stubby), 3, 2), 'Build test tower');
await gameControl.tapTower(towers[0]); await settle();
const tower = selectedTower, funds = money, oldRange = tower.range;
const levelButton = control('level-up');
pointer('pointerdown', levelButton.x + 40, levelButton.y + 40);
pointer('pointerup', levelButton.x + 40, levelButton.y + 40);
check(tower.level === 2 && money === funds - 55 && tower.range > oldRange, 'One touch immediately buys a level');
check(!uiUpgrade && !control('confirm-upgrade'), 'Level-number upgrades never arm confirmation');

await tap('upgrade-Star');
const expected = applyTowerLevel(new Star(3, 2), 2);
check(uiUpgrade.stats.range === expected.range && uiUpgrade.stats.minimumRange === expected.minimumRange,
  'Branch previews inherited level and inner blind spot');
const preview = document.createElement('canvas'); preview.width = 1080; preview.height = 1848;
const c = preview.getContext('2d');
uiDrawUpgrade(c);
const button = control('confirm-upgrade'), branchButton = control('upgrade-Star');
check(button.x === branchButton.x && button.w === branchButton.w && button.y + button.h === branchButton.y,
  'Confirm sits directly above the specialization');
check(selectedTower === tower && money === funds - 55, 'Specialization preview does not spend money');
pointer('pointermove', button.x + 40, button.y + 40);
check(control('confirm-upgrade'), 'Hover preserves specialization confirmation');
const border = c.getImageData(button.x + 3, button.y + 20, 1, 1).data;
const inside = c.getImageData(button.x + 20, button.y + 20, 1, 1).data;
check(border[2] > border[0] && border[3] > 0 && inside[3] === 0, 'Confirm has a blue border and unfilled interior');
await gameControl.screenshot('upgrade-range-preview');
const branchFunds = money;
pointer('pointerdown', button.x + 40, button.y + 40);
pointer('pointerup', button.x + 40, button.y + 40);
check(selectedTower instanceof Star && selectedTower.level === 2 && money === branchFunds - 900,
  'Confirm builds the specialized tower at the inherited level');
check(selectedTower.range === expected.range && selectedTower.minimumRange === expected.minimumRange,
  'Built ranges match the preview');

await tap('upgrade-Railgun');
const levelCost = levelUpCost(selectedTower), beforeLevel = money;
await tap('level-up');
check(selectedTower instanceof Star && selectedTower.level === 3 && money === beforeLevel - levelCost,
  'Level-number upgrade still buys immediately during a specialization preview');
check(!uiUpgrade && !control('confirm-upgrade'), 'Level-up dismisses the old specialization confirmation');

for (const cancel of [
  async () => tap('upgrade-Railgun'),
  async () => tap('target'),
  async () => gameControl.tapTower(selectedTower),
  async () => document.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyA', bubbles: true})),
  async () => document.dispatchEvent(new WheelEvent('wheel', {bubbles: true})),
  async () => window.dispatchEvent(new Event('blur')),
  async () => {
    const b = control('confirm-upgrade');
    pointer('pointerdown', b.x + 20, b.y + 20);
    pointer('pointermove', b.x + b.w + 30, b.y + 20);
    pointer('pointermove', b.x + 20, b.y + 20);
    pointer('pointerup', b.x + 20, b.y + 20);
  },
  async () => {
    const b = control('confirm-upgrade');
    pointer('pointerdown', b.x + 20, b.y + 20);
    pointer('pointercancel', b.x + 20, b.y + 20);
    pointer('pointerup', b.x + 20, b.y + 20);
  }
]) {
  const before = money, level = selectedTower.level;
  await tap('upgrade-Railgun'); check(control('confirm-upgrade'), 'Arms a new preview');
  await cancel(); await frame();
  check(!control('confirm-upgrade') && !uiUpgrade, 'Other interaction cancels the preview');
  check(money === before && selectedTower.level === level, 'Cancellation never buys an upgrade');
}
await tap('upgrade-Railgun'); await gameControl.tapCell(6, 4); await settle();
check(!selectedTower && !uiUpgrade && !control('confirm-upgrade'), 'Empty ground cancels and closes selection');
await gameControl.tapTower(towers[0]); await settle();
await tap('upgrade-Railgun');
money = 0; await frame();
check(!uiUpgrade && !control('confirm-upgrade'), 'Lost funds invalidate pending confirmation');
await tap('level-up'); await tap('upgrade-Railgun');
check(!uiUpgrade && !control('confirm-upgrade'), 'Unaffordable upgrades cannot arm confirmation');
check(selectedTower.level === 3 && money === 0, 'Unaffordable level-up does not spend or level');
money = 10000;
await tap('upgrade-Railgun');
const stale = control('confirm-upgrade');
sellTower(selectedTower); uiActivate(stale);
check(!uiUpgrade && towers.length === 0, 'Stale confirmation cannot upgrade a sold tower');
wslog({result: 'PASS', instantLevelUp: true, branchPreview: true, blindSpot: true, cancellation: true, touchConfirm: true});
