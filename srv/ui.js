"use strict";

var uiSignature = '';
var sellConfirmTower = null;
var toastUntil = 0;
var guideWasPaused = false;
var guidePausePending = false;
var lastUiUpdate = 0;
var buildDrag = null;
var suppressBuildClick = false;
const towerGlyphs = [
  '<path d="M6 22h20v7H6zM10 13h12v9H10zM16 3v13M12 5h8"/>',
  '<path d="M5 23h22v6H5zM9 15h14v8H9zM16 4v14M10 4h12v7H10z"/>',
  '<path d="m18 2-9 16h7l-2 12 10-17h-8z"/>',
  '<path d="m16 2 4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/>',
  '<circle cx="16" cy="16" r="5"/><circle cx="16" cy="16" r="12"/><path d="M16 1v5M16 26v5M1 16h5M26 16h5"/>'
];
function iconMarkup(index) { return '<svg class="tower-symbol" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + towerGlyphs[index] + '</svg>'; }
function uiToast(message) {
  const el = document.getElementById('toast');
  el.textContent = message; el.classList.add('visible'); toastUntil = performance.now() + 2200;
}
function initUI() {
  uiSignature = '';
  sellConfirmTower = null;
  document.getElementById('welcome').hidden = true;
  document.getElementById('game-over').hidden = true;
  document.getElementById('build-deck').innerHTML = towerInfo.filter(i => i.upgrades).map(i =>
    `<button class="build-card" data-build="${i.type.name}" aria-label="Build ${i.name}, ${i.cost} credits">${iconMarkup(i.icon)}<b>${i.name}</b><span class="price">${i.cost}</span></button>`).join('');
}
function bindUI() {
  const byId = id => document.getElementById(id);
  byId('start').onclick = byId('restart').onclick = () => { if (assetsPending.length === 0) startGame(); };
  byId('pause').onclick = () => { if (gameMode === mainGame) paused = !paused; updateUI(true); };
  byId('speed').onclick = () => { gameAccelerated = !gameAccelerated; gameAcceleration = 2; updateUI(true); };
  byId('send-wave').onclick = () => { if (sendWave()) uiToast('Wave incoming'); updateUI(true); };
  byId('build-deck').onclick = event => {
    const button = event.target.closest('[data-build]');
    if (suppressBuildClick) { suppressBuildClick = false; return; }
    if (!button || button.disabled || gameMode !== mainGame) return;
    const info = towerInfo.find(i => i.type.name === button.dataset.build);
    selectedBuild = selectedBuild === info ? null : info;
    selectedTower = null; sellConfirmTower = null; updateUI(true);
  };
  byId('build-deck').addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-build]');
    if (!button || button.disabled || gameMode !== mainGame) return;
    buildDrag = {id: event.pointerId, x: event.clientX, y: event.clientY,
      info: towerInfo.find(i => i.type.name === button.dataset.build), moved: false};
    button.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove', event => {
    if (!buildDrag || event.pointerId !== buildDrag.id) return;
    if (Math.hypot(event.clientX - buildDrag.x, event.clientY - buildDrag.y) > 8) buildDrag.moved = true;
    if (buildDrag.moved) {
      selectedBuild = buildDrag.info; selectedTower = null;
      setMousePos(screenToCanvas(v2(event.clientX, event.clientY)));
      updateUI(true);
    }
  });
  document.addEventListener('pointerup', event => {
    if (!buildDrag || event.pointerId !== buildDrag.id) return;
    if (buildDrag.moved) {
      const rect = outputCanvas.getBoundingClientRect();
      if (event.clientX >= rect.left && event.clientX < rect.right && event.clientY >= rect.top && event.clientY < rect.bottom) {
        setMousePos(screenToCanvas(v2(event.clientX, event.clientY)));
        const built = buyTower(buildDrag.info, mouseCell.x, mouseCell.y);
        uiToast(built ? buildDrag.info.name + ' deployed' : 'Choose an empty tile and check your credits');
      }
      suppressBuildClick = true;
      setTimeout(() => { suppressBuildClick = false; }, 0);
    }
    buildDrag = null; updateUI(true);
  });
  document.addEventListener('pointercancel', () => { buildDrag = null; });
  byId('tower-deck').onclick = event => {
    const button = event.target.closest('button');
    if (!button || button.disabled || !selectedTower) return;
    if (button.dataset.upgrade) {
      const result = upgradeTower(selectedTower, button.dataset.upgrade);
      if (result) uiToast(getTowerInfo(result).name + ' online');
      sellConfirmTower = null;
    } else if (button.id === 'target-mode') {
      const modes = ['first', 'strong', 'near'];
      selectedTower.targetMode = modes[(modes.indexOf(selectedTower.targetMode) + 1) % modes.length];
    } else if (button.id === 'sell-tower') {
      if (sellConfirmTower === selectedTower) { sellTower(selectedTower); sellConfirmTower = null; uiToast('Tower sold · 70% refunded'); }
      else sellConfirmTower = selectedTower;
    } else if (button.id === 'close-tower') { selectedTower = null; sellConfirmTower = null; }
    uiSignature = ''; updateUI(true);
  };
  byId('help').onclick = () => {
    guideWasPaused = paused; guidePausePending = true; paused = true;
    byId('wave-intel').textContent = 'Wave ' + waveCounter + ' · ' + wavePlan(waveCounter).hint;
    byId('field-guide').showModal(); updateUI(true);
  };
  const restoreGuidePause = () => {
    if (!guidePausePending) return;
    guidePausePending = false; paused = guideWasPaused; updateUI(true);
  };
  byId('close-guide').onclick = () => { restoreGuidePause(); byId('field-guide').close(); };
  byId('field-guide').addEventListener('cancel', restoreGuidePause);
  byId('field-guide').addEventListener('close', restoreGuidePause);
  byId('goFullScreen').onclick = () => toggleFullScreen('#game-shell');
  document.addEventListener('visibilitychange', () => { if (document.hidden && gameMode === mainGame) { paused = true; updateUI(true); } });
}
function updateUI(force = false) {
  const now = performance.now();
  if (!force && now - lastUiUpdate < 100) return;
  lastUiUpdate = now;
  const byId = id => document.getElementById(id);
  if (!byId('credits')) return;
  byId('credits').textContent = money;
  byId('lives').innerHTML = lives + ' <small>/ 20</small>';
  byId('pause').textContent = paused ? '▶' : 'Ⅱ';
  byId('pause').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  byId('pause').setAttribute('aria-pressed', String(paused));
  byId('speed').textContent = gameAccelerated ? '2×' : '1×';
  byId('pause-banner').hidden = !paused || gameMode !== mainGame;
  const plan = wavePlan(waveCounter);
  byId('wave-label').textContent = 'WAVE ' + String(waveCounter).padStart(2, '0') + (betweenWaves ? ' · PREPARE' : ' · ACTIVE');
  byId('wave-name').textContent = betweenWaves ? plan.name : plan.name + ' · ' + (creeps.length + hopper.length + backlog.length) + ' left';
  byId('send-wave').disabled = !betweenWaves || paused || gameMode !== mainGame;
  byId('send-wave').innerHTML = betweenWaves ? `Send wave <span>+${Math.ceil(buildTicks / 60)}</span>` : 'In progress';
  byId('wave-progress').style.width = (betweenWaves ? Math.max(0, buildTicks / (waveCounter === 1 ? 900 : 600)) * 100 : Math.max(0, 1 - (hopper.length + creeps.length + backlog.length) / plan.count) * 100) + '%';
  if (performance.now() > toastUntil) byId('toast').classList.remove('visible');
  byId('game-over').hidden = gameMode !== gameOver;
  if (gameMode === gameOver) byId('run-result').textContent = 'Reached wave ' + waveCounter + ' · ' + towers.reduce((sum, t) => sum + t.kills, 0) + ' enemies defeated by your standing towers.';
  byId('build-deck').hidden = !!selectedTower;
  byId('tower-deck').hidden = !selectedTower;
  if (!selectedTower) {
    byId('deck-title').textContent = selectedBuild ? 'DEPLOY ' + selectedBuild.name.toUpperCase() : 'BUILD YOUR DEFENSE';
    byId('deck-note').textContent = selectedBuild ? selectedBuild.desc + ' · Tap again to cancel' : betweenWaves ? plan.hint : 'Tap a tower to specialize, retarget, or sell.';
    for (const button of byId('build-deck').children) {
      const info = towerInfo.find(i => i.type.name === button.dataset.build);
      button.disabled = (money < info.cost && selectedBuild !== info) || gameMode !== mainGame;
      button.classList.toggle('selected', selectedBuild === info);
      button.setAttribute('aria-pressed', String(selectedBuild === info));
    }
    uiSignature = '';
    return;
  }
  const tower = selectedTower, info = getTowerInfo(tower);
  byId('deck-title').textContent = info.upgrades ? 'CHOOSE A SPECIALIZATION' : 'SPECIALIZATION ONLINE';
  byId('deck-note').textContent = info.upgrades ? 'Choose one permanent branch. Your tower keeps its position.' : 'Combine specialties to cover each other’s weaknesses.';
  const signature = [towers.indexOf(tower), info.name, tower.targetMode, sellConfirmTower === tower].join('|');
  if (byId('tower-stats')) byId('tower-stats').textContent = `${tower.kills} kills · ${Math.floor(tower.damageDealt)} damage · ${tower.range} range`;
  for (const button of byId('tower-deck').querySelectorAll('[data-upgrade]')) button.disabled = money < towerInfo.find(i => i.type.name === button.dataset.upgrade).cost;
  if (signature === uiSignature) return;
  uiSignature = signature;
  byId('tower-deck').innerHTML = `<div class="tower-summary"><div><strong>${info.name}</strong><small id="tower-stats">${tower.kills} kills · ${Math.floor(tower.damageDealt)} damage · ${tower.range} range</small></div><div class="tower-actions"><button id="target-mode" aria-label="Target priority: ${tower.targetMode}. Tap to change.">${{first: 'First', strong: 'Strong', near: 'Near'}[tower.targetMode]} ↻</button><button id="sell-tower" class="${sellConfirmTower === tower ? 'sell-confirm' : ''}">${sellConfirmTower === tower ? 'Confirm' : 'Sell'} ${sellValue(tower)}</button><button id="close-tower" aria-label="Close tower management">×</button></div></div>` +
    (info.upgrades ? '<div class="upgrade-options">' + info.upgrades.map(name => {
      const branch = towerInfo.find(i => i.type.name === name);
      return `<button class="upgrade-card" data-upgrade="${name}" ${money < branch.cost ? 'disabled' : ''}><span class="price">${branch.cost}</span><strong>${branch.name} ↗</strong><small>${branch.desc}</small></button>`;
    }).join('') + '</div>' : `<div class="specialty-detail">${info.desc}</div>`);
}
// Rendering stays entirely on the DOM; these names remain for old callers.
function drawUI() {}
function showTowerSelectionPanel() { updateUI(true); }
function hideTowerSelectionPanel() { selectedTower = null; updateUI(true); }
