"use strict";

// All geometry is in game coordinates. UI state never changes the viewport.
var uiOverlay = '';
var uiMapChoice = 'foundry';
var uiGuidePage = 0;
var uiSlide = 0;
var uiPanelTower = null;
var uiGesture = null;
var sellConfirmTower = null;
var uiToastMessage = '';
var uiToastUntil = 0;
var uiLastFrame = 0;
var uiDrawSignature = '';
const uiColors = {surface: '#0b171b', card: '#13272b', edge: '#29484b', text: '#deeee9', muted: '#99b4af', mint: '#81e4bd', gold: '#efd298'};
const uiGlyphs = [
  'M6 22h20v7H6zM10 13h12v9H10zM16 3v13M12 5h8',
  'M5 23h22v6H5zM9 15h14v8H9zM16 4v14M10 4h12v7H10z',
  'M18 2 9 18h7l-2 12 10-17h-8z',
  'M16 2 20 12 30 16 20 20 16 30 12 20 2 16 12 12z',
  'M16 1v5M16 26v5M1 16h5M26 16h5',
  'M17 2c5 10-4 10 3 17 2-5 5-6 5-6 7 12-1 17-9 17S3 23 7 16c0 5 4 5 4 5-2-9 8-10 6-19z'
];

function uiGeometry() {
  return {width: 1080, height: 1848, hud: 156, dock: 1692, strip: 156};
}
function initUI() {
  uiOverlay = '';
  uiSlide = 0;
  uiPanelTower = null;
  uiGesture = null;
  sellConfirmTower = null;
  uiToastMessage = '';
  uiDrawSignature = '';
}
function updateUI() {
  if (selectedTower && !towers.includes(selectedTower)) selectedTower = null;
}
function uiToast(message) {
  uiToastMessage = message;
  uiToastUntil = performance.now() + 1800;
}
function uiRectContains(r, p) {
  return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;
}
function uiButton(id, x, y, w, h, label, sub = '', extra = {}) {
  return {id, x, y, w, h, label, sub, ...extra};
}
function uiModal() {
  if (uiOverlay === 'maps') return 'maps';
  if (gameMode === gameOver) return 'gameOver';
  if (gameMode !== mainGame) return 'welcome';
  return uiOverlay;
}

// The same button records drive drawing and hit testing, including animation.
function uiControls() {
  const modal = uiModal();
  if (modal === 'welcome' || modal === 'gameOver') {
    return [uiButton('start', 180, 1040, 720, 160, 'Choose map', '', {disabled: assetsPending.length > 0})];
  }
  if (modal === 'maps') return [
    ...mapCatalog.map((map, i) => uiButton('map-' + map.id, 60, 430 + i * 350, 960, 320, map.name, '', {map, selected: uiMapChoice === map.id})),
    uiButton('map-back', 60, 1580, 156, 156, '‹'),
    uiButton('deploy', 240, 1580, 780, 156, 'Deploy defenses')
  ];
  if (modal === 'pause') return [
    uiButton('resume', 180, 650, 720, 156, 'Resume'),
    uiButton('plan', 180, 824, 720, 156, 'Inspect defenses', 'Keep time paused'),
    uiButton('guide', 180, 998, 720, 156, 'Field guide'),
    uiButton('fullscreen', 180, 1172, 720, 156, 'Fullscreen')
  ];
  if (modal === 'guide') return [
    uiButton('guide-prev', 90, 1380, 180, 156, '‹'),
    uiButton('guide-close', 294, 1380, 492, 156, 'Back'),
    uiButton('guide-next', 810, 1380, 180, 156, '›')
  ];
  const g = uiGeometry();
  const buttons = uiHudControls();
  if (!selectedTower && uiSlide < 0.01) {
    towerInfo.filter(info => info.buildable).forEach((info, i) => buttons.push(
      uiButton('build-' + info.type.name, i * 216, g.dock, 216, g.strip, info.name, String(info.cost), {info, unaffordable: money < info.cost, selected: selectedBuild === info})
    ));
  }
  if (selectedTower && uiSlide > 0.99) buttons.push(...uiTowerControls(selectedTower, 0));
  return buttons;
}
function uiHudControls() {
  return [
    uiButton('pause', 570, 0, 156, 156, paused ? '▶' : 'Ⅱ'),
    uiButton('speed', 726, 0, 156, 156, gameAccelerated ? '2×' : '1×'),
    uiButton('send', 882, 0, 198, 156, String(betweenWaves ? waveCounter : waveCounter + 1), '+$' + waveSendBonus(), {stamp:'SEND', disabled: !canSendWave()})
  ];
}
function uiTowerControls(tower, offset) {
  const info = getTowerInfo(tower), y = uiGeometry().dock;
  const buttons = [];
  if (info.upgrades) info.upgrades.forEach((name, i) => {
    const branch = towerInfo.find(t => t.type.name === name);
    buttons.push(uiButton('upgrade-' + name, offset + i * 235, y, 235, 156, branch.name, '+' + branch.cost, {disabled: money < branch.cost, branch}));
  });
  buttons.push(
    uiButton('level-up', offset + 470, y, 240, 156, 'L' + tower.level + ' → ' + (tower.level + 1), '$' + levelUpCost(tower), {levelUp:true, gain:levelUpHighlight(tower), disabled:money < levelUpCost(tower)}),
    uiButton('target', offset + 710, y, 170, 156, {first: 'First', strong: 'Strong', near: 'Near'}[tower.targetMode], '⌖'),
    uiButton('sell', offset + 880, y, 200, 156, sellConfirmTower === tower ? 'Confirm' : 'Sell', String(sellValue(tower)), {danger: sellConfirmTower === tower})
  );
  return buttons;
}
function uiActivate(button) {
  if (button.disabled) return;
  const id = button.id;
  if (id === 'start') { uiMapChoice = mapCatalog.some(m => m.id === selectedMapId) ? selectedMapId : mapCatalog[0].id; uiOverlay = 'maps'; cancelPlacement(); }
  else if (id === 'map-back') uiOverlay = '';
  else if (id === 'deploy') startGame(uiMapChoice);
  else if (id.startsWith('map-')) uiMapChoice = id.slice(4);
  else if (id === 'pause') {
    if (paused) { paused = false; uiOverlay = ''; }
    else { paused = true; uiOverlay = 'pause'; }
  } else if (id === 'resume') { paused = false; uiOverlay = ''; }
  else if (id === 'plan') uiOverlay = '';
  else if (id === 'guide') { paused = true; uiGuidePage = 0; uiOverlay = 'guide'; }
  else if (id === 'guide-close') uiOverlay = 'pause';
  else if (id === 'guide-prev') uiGuidePage = (uiGuidePage + 2) % 3;
  else if (id === 'guide-next') uiGuidePage = (uiGuidePage + 1) % 3;
  else if (id === 'fullscreen') {
    const action = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
    if (action?.catch) action.catch(() => uiToast('Fullscreen is unavailable'));
  } else if (id === 'speed') { gameAccelerated = !gameAccelerated; gameAcceleration = 2; }
  else if (id === 'send') sendWave();
  else if (id.startsWith('build-')) {
    if (selectedBuild === button.info) cancelPlacement();
    else beginPlacement(button.info);
  } else if (id.startsWith('upgrade-')) {
    upgradeTower(selectedTower, id.slice(8));
    sellConfirmTower = null;
  } else if (id === 'level-up') {
    levelUpTower(selectedTower); sellConfirmTower = null;
  } else if (id === 'target') {
    const modes = ['first', 'strong', 'near'];
    selectedTower.targetMode = modes[(modes.indexOf(selectedTower.targetMode) + 1) % modes.length];
  } else if (id === 'sell') {
    if (sellConfirmTower === selectedTower) { sellTower(selectedTower); sellConfirmTower = null; }
    else sellConfirmTower = selectedTower;
  }
}
function pressStartUI(pos) {
  const button = uiControls().find(b => uiRectContains(b, pos));
  const g = uiGeometry();
  const cancelOnly = placement.mode === 'tap' && placement.blocked;
  const captured = cancelOnly || !!uiModal() || pos.y < g.hud || pos.y >= g.dock;
  uiGesture = {button, start: pos, captured, dragging: false, cancelOnly};
  return captured;
}
function pressMoveUI(pos) {
  if (!uiGesture?.captured) return false;
  if (uiGesture.cancelOnly) return true;
  if (uiGesture.button?.info && !uiGesture.button.disabled && vdistance(uiGesture.start, pos) > 24) {
    if (!uiGesture.dragging) beginPlacement(uiGesture.button.info, 'drag');
    uiGesture.dragging = true;
    setMousePos(pos);
    dragPlacement(mouseCell);
  }
  return true;
}
function pressEndUI(pos) {
  const gesture = uiGesture;
  uiGesture = null;
  if (!gesture?.captured) return false;
  if (gesture.cancelOnly) { cancelPlacement(); return true; }
  if (gesture.dragging) {
    setMousePos(pos);
    finishPlacementDrag(mouseCell);
  } else if (gesture.button) {
    // Revalidate after the press: money, selection or game mode may have changed.
    const button = uiControls().find(b => b.id === gesture.button.id && uiRectContains(b, pos));
    if (button) uiActivate(button);
  }
  return true;
}
function cancelUIInput() {
  if (placement.mode === 'drag') cancelPlacement();
  uiGesture = null;
}
function bindUI() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameMode === mainGame) { paused = true; uiOverlay = 'pause'; cancelUIInput(); }
  });
  document.addEventListener('keydown', event => {
    if (event.repeat || gameMode !== mainGame) return;
    if (event.code === 'Space') { event.preventDefault(); uiActivate({id: paused ? 'resume' : 'pause'}); }
    if (event.code === 'Escape') {
      if (uiOverlay === 'guide') uiOverlay = 'pause';
      else if (uiOverlay === 'pause') uiActivate({id: 'resume'});
      else if (selectedTower || selectedBuild) { selectedTower = null; cancelPlacement(); }
      else uiActivate({id: 'pause'});
    }
  });
}

function uiText(c, text, x, y, size = 38, color = uiColors.text, align = 'left') {
  c.fillStyle = color;
  c.font = '500 ' + size + 'px system-ui, sans-serif';
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(text, x, y);
}
function uiWrap(c, text, x, y, width, size = 36, lineHeight = 52) {
  c.font = '500 ' + size + 'px system-ui, sans-serif';
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (line && c.measureText(next).width > width) { uiText(c, line, x, y, size, uiColors.muted); y += lineHeight; line = word; }
    else line = next;
  }
  uiText(c, line, x, y, size, uiColors.muted);
  return y + lineHeight;
}
function uiDrawGlyph(c, index, x, y, size, color) {
  c.save(); c.translate(x - size / 2, y - size / 2); c.scale(size / 32, size / 32);
  c.strokeStyle = color; c.lineWidth = 2; c.lineJoin = 'round'; c.lineCap = 'round';
  c.stroke(new Path2D(uiGlyphs[index]));
  if (index === 4) { c.beginPath(); c.arc(16, 16, 5, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(16, 16, 12, 0, Math.PI * 2); c.stroke(); }
  c.restore();
}
function uiDrawButton(c, b) {
  if (b.map) { uiDrawMapCard(c, b); return; }
  const pressed = uiGesture?.button?.id === b.id;
  c.fillStyle = b.selected ? '#204638' : pressed ? '#274448' : uiColors.card;
  c.fillRect(b.x + 3, b.y + 5, b.w - 6, b.h - 10);
  if (b.selected || b.danger) {
    c.fillStyle = b.danger ? '#ec9d8e' : uiColors.mint;
    c.fillRect(b.x + 3, b.y + b.h - 9, b.w - 6, 4);
  }
  const color = b.disabled || b.unaffordable ? '#6f8984' : b.danger ? '#ffb3a3' : uiColors.text;
  const center = b.x + b.w / 2;
  if (b.stamp) { uiDrawNumberStamp(c, b.stamp, b.label, b, b.sub, b.disabled); return; }
  if (b.levelUp) {
    uiText(c, b.label, center, b.y + 32, 35, color, 'center');
    uiText(c, b.sub, center, b.y + 79, 36, b.disabled ? color : uiColors.gold, 'center');
    uiText(c, b.gain, center, b.y + 126, 26, uiColors.muted, 'center');
  } else if (b.info) {
    uiDrawGlyph(c, b.info.icon, center, b.y + 42, 54, b.unaffordable ? '#627a73' : ['#81e4bd', '#e3b67b', '#94bde9', '#c4a1e4', '#eba69f', '#efa277'][b.info.icon]);
    uiText(c, b.label, center, b.y + 91, 31, color, 'center');
    uiText(c, b.sub, center, b.y + 130, 36, b.unaffordable ? color : uiColors.gold, 'center');
  } else {
    uiText(c, b.label, center, b.y + (b.sub ? 57 : b.h / 2), b.label.length > 14 ? 38 : b.label.length > 8 ? 33 : 41, color, 'center');
    if (b.sub) uiText(c, b.sub, center, b.y + 108, b.sub.length > 14 ? 30 : 38, b.disabled ? color : uiColors.gold, 'center');
  }
}
function uiDrawGuide(c) {
  const headings = ['Field controls', 'Tower branches', 'Enemy counters'];
  uiText(c, headings[uiGuidePage], 90, 350, 64, uiColors.mint);
  uiText(c, (uiGuidePage + 1) + ' / 3  ·  PAUSED', 90, 425, 32, uiColors.muted);
  let y = 540;
  if (uiGuidePage === 0) {
    for (const text of [
      'Tap a tower, tap an empty tile to preview, then tap that tile again to build. Or drag and release to place once.',
      'Tap a placed tower for branches, levels, targeting and selling. Tap empty ground to return to building.',
      'Invalid tiles cancel placement. Orange means insufficient funds; tap anywhere to cancel. Sell twice for a 70% refund.',
      'First targets enemies closest to the exit. Strong picks the most health. Near picks the closest enemy.',
      'Send unlocks three seconds after each launch. Call waves together for extra credits. Pause lets you inspect and build.'
    ]) y = uiWrap(c, text, 90, y, 900, 36, 50) + 38;
  } else if (uiGuidePage === 1) {
    // Selecting a tower before opening help puts its own branches first.
    const foundations = towerInfo.filter(i => i.buildable);
    const selected = selectedTower && getTowerInfo(selectedTower);
    const focus = selected?.upgrades ? selected : towerInfo.find(i => i.upgrades?.includes(selected?.type.name));
    const info = focus || foundations[0];
    const entries = selectedTower ? [info] : foundations;
    for (const foundation of entries) {
      if (!selectedTower) {
        uiText(c, foundation.name, 90, y, 39, uiColors.mint);
        y = uiWrap(c, foundation.upgrades.map(name => towerInfo.find(t => t.type.name === name).name).join(' / '), 90, y + 54, 900, 35, 48) + 38;
        continue;
      }
      uiText(c, foundation.name, 90, y, 39, uiColors.mint); y += 56;
      for (const name of foundation.upgrades) {
        const branch = towerInfo.find(i => i.type.name === name);
        y = uiWrap(c, branch.name + ' +' + branch.cost + ' · ' + branch.desc, 90, y, 900, selectedTower ? 38 : 29, selectedTower ? 55 : 40);
      }
      y += selectedTower ? 48 : 20;
      if (selectedTower) uiWrap(c, 'Levels improve damage, rate and range along curves unique to each weapon. Levels carry through branches; each new level costs more. ' + levelUpHighlight(selectedTower) + ' leads the next level.', 90, y, 900, 35, 48);
    }
  } else {
    for (const [name, description] of [
      ['Armor', 'Blocks 60% of physical hits. Energy and piercing bypass it.'],
      ['Shields', 'Energy strips shields twice as fast. Piercing ignores them.'],
      ['Menders', 'Regenerate while moving. Burning stops their recovery.'],
      ['Splitters', 'Release two runners on death. Use chains and splash.'],
      ['Guardians', 'Resist slowing. Cost three lives on escape.']
    ]) { uiText(c, name, 90, y, 39, uiColors.mint); y = uiWrap(c, description, 90, y + 52, 900, 34, 48) + 36; }
  }
}
function drawUI(now = performance.now()) {
  const c = interfaceCtx, g = uiGeometry();
  c.setTransform(interfaceCanvas.width / g.width, 0, 0, interfaceCanvas.height / g.height, 0, 0);
  const elapsed = Math.min(100, now - (uiLastFrame || now)); uiLastFrame = now;
  const destination = selectedTower ? 1 : 0;
  const step = elapsed / 180;
  uiSlide = destination ? Math.min(1, uiSlide + step) : Math.max(0, uiSlide - step);
  if (selectedTower) uiPanelTower = selectedTower;
  if (!uiSlide) uiPanelTower = null;
  const signature = [interfaceCanvas.width, interfaceCanvas.height, gameMode.name, uiOverlay, uiGuidePage, uiMapChoice, selectedMapId,
    paused, money, lives, waveCounter, betweenWaves, Math.ceil(buildTicks / 60), canSendWave(),
    creeps.length + hopper.length + backlog.length, gameAccelerated, selectedBuild?.type.name,
    selectedTower?.cellPosition.x, selectedTower?.cellPosition.y, selectedTower?.constructor.name,
    selectedTower?.level, selectedTower?.targetMode, selectedTower?.kills, Math.floor(selectedTower?.damageDealt || 0),
    uiSlide, sellConfirmTower === selectedTower, uiGesture?.button?.id,
    placement.mode, placement.cell?.x, placement.cell?.y, placement.blocked,
    now < uiToastUntil ? uiToastMessage : '', assetsPending.length].join('|');
  if (signature === uiDrawSignature) return;
  uiDrawSignature = signature;
  c.clearRect(0, 0, g.width, g.height);

  c.fillStyle = uiColors.surface;
  c.fillRect(0, 0, g.width, g.hud);
  c.fillRect(0, g.dock, g.width, g.strip);
  if (gameMode === mainGame || gameMode === gameOver) {
    uiDrawNumberStamp(c, 'WAVE', String(betweenWaves ? Math.max(0, waveCounter - 1) : waveCounter), {x:6,y:0,w:180,h:156}, betweenWaves ? Math.ceil(buildTicks / 60) + 's' : String(creeps.length + hopper.length + backlog.length) + ' left');
    uiText(c, '$' + money, 194, 78, money > 9999 ? 40 : 48, uiColors.gold);
    uiText(c, '♥ ' + lives, 416, 78, 44, uiColors.mint);
    for (const button of uiHudControls()) uiDrawButton(c, button);
    const bases = towerInfo.filter(i => i.buildable);
    bases.forEach((info, i) => uiDrawButton(c, uiButton('build-' + info.type.name, i * 216, g.dock, 216, g.strip, info.name, String(info.cost), {info, selected: selectedBuild === info, unaffordable: money < info.cost})));
    if (uiPanelTower && uiSlide > 0) {
      c.save(); c.beginPath(); c.rect(0, g.dock, g.width, g.strip); c.clip();
      const offset = (1 - uiSlide) * g.width;
      c.fillStyle = uiColors.surface; c.fillRect(offset, g.dock, g.width, g.strip);
      const info = getTowerInfo(uiPanelTower);
      if (!info.upgrades) {
        uiText(c, info.name + ' · L' + uiPanelTower.level, offset + 24, g.dock + 50, 37, uiColors.mint);
        uiText(c, Math.round(uiPanelTower.power) + ' dmg · ' + Math.round(uiPanelTower.range) + ' range', offset + 24, g.dock + 108, 30, uiColors.muted);
      }
      for (const button of uiTowerControls(uiPanelTower, offset)) uiDrawButton(c, button);
      c.restore();
    }
    c.fillStyle = uiColors.edge; c.fillRect(0, g.hud - 3, g.width, 3); c.fillRect(0, g.dock, g.width, 3);
  }
  uiDrawPlacement(c);
  const modal = uiModal();
  if (modal) {
    c.fillStyle = '#071114ed'; c.fillRect(0, 0, g.width, g.height);
    if (modal === 'maps') {
      uiText(c, 'Choose your ground', 90, 220, 70, uiColors.mint);
      uiText(c, 'Three routes. The same defenses.', 90, 315, 38, uiColors.muted);
    } else if (modal === 'guide') uiDrawGuide(c);
    else if (modal === 'pause') {
      uiText(c, 'Paused', 180, 420, 84, uiColors.mint);
      uiWrap(c, 'Wave ' + waveCounter + ' · ' + wavePlan(waveCounter).hint, 180, 525, 720, 36, 48);
    } else {
      uiText(c, modal === 'welcome' ? 'SLTD' : 'Defense breached', 180, 510, modal === 'welcome' ? 110 : 67, uiColors.mint);
      uiWrap(c, modal === 'welcome' ? 'Five foundations. Branches and levels.' : 'Reached wave ' + waveCounter + '.', 180, 660, 720, 43, 62);
      uiWrap(c, 'Choose a map, then build your defense. Pause for the field guide.', 180, 810, 720, 37, 56);
    }
    for (const button of uiControls()) uiDrawButton(c, button);
  }
  if (uiToastMessage && now < uiToastUntil) {
    c.font = '500 34px system-ui, sans-serif';
    const width = Math.min(1000, c.measureText(uiToastMessage).width + 48);
    c.fillStyle = '#152c2ff0'; c.fillRect((g.width - width) / 2, g.hud + 18, width, 64);
    uiText(c, uiToastMessage, g.width / 2, g.hud + 50, 34, uiColors.text, 'center');
  }
}

function uiDrawNumberStamp(c, word, number, bounds, sub, disabled = false) {
  const center = bounds.x + bounds.w / 2;
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '900 72px system-ui, sans-serif';
  c.fillStyle = disabled ? '#52655e' : uiColors.mint;
  c.globalAlpha = .3;
  c.save(); c.translate(center, bounds.y + 61); c.scale(1, 1.5);
  c.fillText(word, 0, 0, bounds.w - 12); c.restore();
  c.globalAlpha = 1;
  c.font = '900 54px system-ui, sans-serif'; // Keep numbers unchanged when stretching labels.
  c.fillStyle = disabled ? '#8b9e95' : uiColors.text;
  c.fillText(number, center, bounds.y + 61, bounds.w - 12);
  uiText(c, sub, center, bounds.y + 125, 32, disabled ? uiColors.muted : uiColors.gold, 'center');
  c.restore();
}
function uiDrawMapCard(c, button) {
  const {map, x, y, w, h} = button;
  c.fillStyle = button.selected ? '#1a3832' : uiColors.card;
  c.fillRect(x, y, w, h);
  c.strokeStyle = button.selected ? uiColors.mint : uiColors.edge;
  c.lineWidth = 3; c.strokeRect(x, y, w, h);
  const size = 16;
  for (let row = 0; row < 16; row++) for (let column = 0; column < 11; column++) {
    c.fillStyle = map.cells[row][column] === '.' ? uiColors.mint : '#09191b';
    c.fillRect(x + 24 + column * size, y + 30 + row * size, size - 1, size - 1);
  }
  const path = map.path || createWorld(map.cells).path;
  for (const [cell, color] of [[path[1], uiColors.mint], [path[path.length - 2], '#edaa79']]) {
    c.beginPath(); c.arc(x + 24 + (cell.x + .5) * size, y + 30 + (cell.y + .5) * size, 8, 0, TWOPI);
    c.fillStyle = color; c.fill(); c.strokeStyle = '#09191b'; c.lineWidth = 3; c.stroke();
  }
  uiText(c, map.name, x + 242, y + 70, 55, uiColors.text);
  uiWrap(c, map.description, x + 242, y + 150, w - 276, 34, 47);
  if (button.selected) uiText(c, '✓', x + w - 45, y + 38, 36, uiColors.mint, 'center');
}
function uiDrawPlacement(c) {
  if (!placement.info || !placement.cell || gameMode !== mainGame) return;
  const p = mapToWorld(placement.cell);
  const x = p.x + 12, y = p.y + mapTop;
  c.save(); c.beginPath(); c.rect(12, mapTop, 1056, 1536); c.clip();
  if (placement.blocked) {
    const centerX = Math.max(110, Math.min(970, x));
    const centerY = Math.max(mapTop + 42, Math.min(mapTop + 1494, y));
    uiText(c, 'Insufficient', centerX, centerY - 17, 30, '#ffc077', 'center');
    uiText(c, 'funds', centerX, centerY + 18, 30, '#ffc077', 'center');
  } else if (placement.mode === 'tap') {
    c.fillStyle = '#10332bdd'; c.fillRect(x - 44, y - 44, 88, 88);
    uiText(c, 'Tap to', x, y - 16, 26, uiColors.text, 'center');
    uiText(c, 'build', x, y + 16, 26, uiColors.text, 'center');
  }
  c.restore();
}
