const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the adapter against the actual shared game and browser UI handlers.
require('../../srv/nodemain.js');
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../../srv/ui.js'), 'utf8'));
const listeners = new Map();
document.addEventListener = (type, callback) => {
  if (!listeners.has(type)) listeners.set(type, []);
  listeners.get(type).push(callback);
};
document.dispatchEvent = event => {
  for (const callback of listeners.get(event.type) || []) callback(event);
};
window.dispatchEvent = () => {};
globalThis.KeyboardEvent = class {
  constructor(type, properties) { this.type = type; Object.assign(this, properties); }
  preventDefault() {}
};
bindUI();
vm.runInThisContext(fs.readFileSync(path.join(__dirname,
  '../app/src/main/assets/shell/host.js'), 'utf8'));

gameMode = titleScreen;
const menuIds = () => uiControls().map(b => b.id);
assert.ok(menuIds().includes('exit') && !menuIds().includes('fullscreen'),
  'The main menu offers Exit instead of Fullscreen');
assert.equal(uiControls().find(b => b.id === 'exit').label, 'Exit');
globalThis.location = {href: ''};
uiActivate({id: 'exit'});
assert.equal(location.href, 'https://appassets.androidplatform.net/exit');
assert.equal(sltdHost.back(), 'exit');
uiOpenMaps();
assert.equal(sltdHost.back(), 'handled');
assert.equal(uiOverlay, '');
uiOverlay = 'guide';
assert.equal(sltdHost.back(), 'handled');
assert.equal(uiOverlay, '');

startGame('foundry');
beginPlacement(towerInfo[0]);
assert.equal(sltdHost.back(), 'handled');
assert.equal(selectedBuild, null);
assert.equal(paused, false);
assert.equal(sltdHost.back(), 'handled');
assert.equal(paused, true);
assert.equal(uiOverlay, 'pause');
const pauseButtons = uiControls();
assert.ok(!pauseButtons.some(b => b.id === 'fullscreen'), 'The pause menu has no Fullscreen button');
assert.deepEqual(pauseButtons.map(b => b.y), [650, 824, 998, 1172, 1346],
  'Buttons below the removed one close the gap');
assert.equal(sltdHost.back(), 'confirm');
assert.equal(paused, true, 'Back from pause never resumes the simulation');

uiActivate({id: 'plan'});
assert.equal(sltdHost.back(), 'handled');
assert.equal(uiOverlay, 'pause', 'Back from planning returns to the pause menu');

uiActivate({id: 'resume'});
beginPlacement(towerInfo[0], 'drag');
sltdHost.pause();
assert.equal(paused, true);
assert.equal(uiOverlay, 'pause');
assert.equal(placement.mode, 'idle', 'Backgrounding cancels a drag without building');
assert.equal(towers.length, 0);
sltdHost.pause();
assert.equal(paused, true, 'Repeated lifecycle notifications keep the game paused');

uiOverlay = 'guide';
sltdHost.pause();
assert.equal(uiOverlay, 'guide', 'Backgrounding preserves the archive page');
assert.equal(sltdHost.back(), 'handled');
assert.equal(uiOverlay, 'pause');

console.log('PASS wrapper Back, menus, background pause, and cancelled placement with the real game UI');
