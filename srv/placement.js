"use strict";

// Drag is a single gesture. Tap mode has a separate, explicit confirmation cell.
var placement = {mode: 'idle', info: null, cell: null, blocked: false};
function cancelPlacement() {
  Object.assign(placement, {mode: 'idle', info: null, cell: null, blocked: false});
  globalThis.selectedBuild = null;
}
function beginPlacement(info, mode = 'tap') {
  cancelPlacement();
  if (globalThis.gameMode !== globalThis.mainGame || !info?.upgrades) return false;
  Object.assign(placement, {mode, info});
  globalThis.selectedBuild = info;
  globalThis.selectedTower = null;
  return true;
}
function validPlacementCell(cell) {
  return Number.isInteger(cell?.x) && Number.isInteger(cell?.y) && levelMap.canBuildHere(cell) &&
    !towers.some(t => vsame(t.cellPosition, cell));
}
function previewPlacement(cell) {
  placement.cell = {...cell};
  placement.blocked = money < placement.info.cost;
}
function tapPlacement(cell) {
  if (placement.mode !== 'tap') return false;
  if (placement.blocked || !validPlacementCell(cell)) { cancelPlacement(); return true; }
  if (placement.cell && vsame(cell, placement.cell)) {
    if (money < placement.info.cost) placement.blocked = true;
    else { buyTower(placement.info, cell.x, cell.y); cancelPlacement(); }
  } else previewPlacement(cell);
  return true;
}
function dragPlacement(cell) {
  if (placement.mode === 'drag') previewPlacement(cell);
}
function finishPlacementDrag(cell) {
  if (placement.mode !== 'drag') return false;
  const info = placement.info;
  const built = validPlacementCell(cell) && buyTower(info, cell.x, cell.y);
  cancelPlacement();
  return !!built;
}
function updatePlacement() {
  // Once shown, an insufficient-funds preview stays cancelled-on-next-tap even
  // if an enemy bounty arrives while the player is reading it.
  if (placement.mode === 'tap' && placement.cell && money < placement.info.cost) placement.blocked = true;
}
if (typeof module !== 'undefined' && module.exports) Object.assign(globalThis, {
  placement, cancelPlacement, beginPlacement, validPlacementCell, tapPlacement,
  dragPlacement, finishPlacementDrag, updatePlacement
});
