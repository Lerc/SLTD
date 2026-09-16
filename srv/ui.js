"use strict";

// All geometry is in game coordinates. UI state never changes the viewport.
var uiOverlay = '';
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
  'M16 1v5M16 26v5M1 16h5M26 16h5'
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
  if (gameMode === gameOver) return 'gameOver';
  if (gameMode !== mainGame) return 'welcome';
  return uiOverlay;
}

// The same button records drive drawing and hit testing, including animation.
function uiControls() {
  const modal = uiModal();
  if (modal === 'welcome' || modal === 'gameOver') {
    return [uiButton('start', 180, 1040, 720, 160, modal === 'welcome' ? 'Deploy defenses' : 'Deploy again', '', {disabled: assetsPending.length > 0})];
  }
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
    towerInfo.filter(info => info.upgrades).forEach((info, i) => buttons.push(
      uiButton('build-' + info.type.name, i * 216, g.dock, 216, g.strip, info.name, String(info.cost), {info, disabled: money < info.cost && selectedBuild !== info, selected: selectedBuild === info})
    ));
  }
  if (selectedTower && uiSlide > 0.99) buttons.push(...uiTowerControls(selectedTower, 0));
  return buttons;
}
function uiHudControls() {
  return [
    uiButton('pause', 570, 0, 156, 156, paused ? '▶' : 'Ⅱ'),
    uiButton('speed', 726, 0, 156, 156, gameAccelerated ? '2×' : '1×'),
    uiButton('send', 882, 0, 198, 156, betweenWaves ? 'Send' : '•••', betweenWaves ? '+' + Math.ceil(buildTicks / 60) : String(creeps.length + hopper.length + backlog.length), {disabled: !betweenWaves || paused})
  ];
}
function uiTowerControls(tower, offset) {
  const info = getTowerInfo(tower), y = uiGeometry().dock;
  const buttons = [];
  if (info.upgrades) info.upgrades.forEach((name, i) => {
    const branch = towerInfo.find(t => t.type.name === name);
    buttons.push(uiButton('upgrade-' + name, offset + i * 290, y, 290, 156, branch.name, '+' + branch.cost, {disabled: money < branch.cost, branch}));
  });
  buttons.push(
    uiButton('target', offset + 580, y, 160, 156, {first: 'First', strong: 'Strong', near: 'Near'}[tower.targetMode], '⌖'),
    uiButton('sell', offset + 740, y, 190, 156, sellConfirmTower === tower ? 'Confirm' : 'Sell', String(sellValue(tower)), {danger: sellConfirmTower === tower}),
    uiButton('close-tower', offset + 930, y, 150, 156, '×')
  );
  return buttons;
}
function uiActivate(button) {
  if (button.disabled) return;
  const id = button.id;
  if (id === 'start') startGame();
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
    selectedBuild = selectedBuild === button.info ? null : button.info;
    selectedTower = null;
  } else if (id.startsWith('upgrade-')) {
    upgradeTower(selectedTower, id.slice(8));
    sellConfirmTower = null;
  } else if (id === 'target') {
    const modes = ['first', 'strong', 'near'];
    selectedTower.targetMode = modes[(modes.indexOf(selectedTower.targetMode) + 1) % modes.length];
  } else if (id === 'sell') {
    if (sellConfirmTower === selectedTower) { sellTower(selectedTower); sellConfirmTower = null; }
    else sellConfirmTower = selectedTower;
  } else if (id === 'close-tower') { selectedTower = null; sellConfirmTower = null; }
}
function pressStartUI(pos) {
  const button = uiControls().find(b => uiRectContains(b, pos));
  const g = uiGeometry();
  const captured = !!uiModal() || pos.y < g.hud || pos.y >= g.dock;
  uiGesture = {button, start: pos, captured, dragging: false};
  return captured;
}
function pressMoveUI(pos) {
  if (!uiGesture?.captured) return false;
  if (uiGesture.button?.info && !uiGesture.button.disabled && vdistance(uiGesture.start, pos) > 24) {
    uiGesture.dragging = true;
    selectedBuild = uiGesture.button.info;
    selectedTower = null;
    setMousePos(pos);
  }
  return true;
}
function pressEndUI(pos) {
  const gesture = uiGesture;
  uiGesture = null;
  if (!gesture?.captured) return false;
  if (gesture.dragging) {
    if (pos.y >= mapTop && pos.y < uiGeometry().dock) {
      setMousePos(pos);
      if (!buyTower(gesture.button.info, mouseCell.x, mouseCell.y)) uiToast('Cannot build here');
    }
  } else if (gesture.button) {
    // Revalidate after the press: money, selection or game mode may have changed.
    const button = uiControls().find(b => b.id === gesture.button.id && uiRectContains(b, pos));
    if (button) uiActivate(button);
  }
  return true;
}
function cancelUIInput() { uiGesture = null; }
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
      else if (selectedTower || selectedBuild) { selectedTower = null; selectedBuild = null; }
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
  const pressed = uiGesture?.button?.id === b.id;
  c.fillStyle = b.selected ? '#204638' : pressed ? '#274448' : uiColors.card;
  c.fillRect(b.x + 3, b.y + 5, b.w - 6, b.h - 10);
  if (b.selected || b.danger) {
    c.fillStyle = b.danger ? '#ec9d8e' : uiColors.mint;
    c.fillRect(b.x + 3, b.y + b.h - 9, b.w - 6, 4);
  }
  const color = b.disabled ? '#6f8984' : b.danger ? '#ffb3a3' : uiColors.text;
  const center = b.x + b.w / 2;
  if (b.info) {
    uiDrawGlyph(c, b.info.icon, center, b.y + 42, 54, b.disabled ? '#627a73' : ['#81e4bd', '#e3b67b', '#94bde9', '#c4a1e4', '#eba69f'][b.info.icon]);
    uiText(c, b.label, center, b.y + 91, 31, color, 'center');
    uiText(c, b.sub, center, b.y + 130, 36, b.disabled ? color : uiColors.gold, 'center');
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
      'Tap a tower in the strip, then a tile to build. Or drag straight onto the map.',
      'Tap a placed tower to replace the build strip with its upgrades, targeting and selling controls.',
      'Choose one permanent branch. Sell twice to refund 70% of all credits invested.',
      'First targets enemies closest to the exit. Strong picks the most health. Near picks the closest enemy.',
      'Send waves early for extra credits. Pause lets you inspect and build without time advancing.'
    ]) y = uiWrap(c, text, 90, y, 900, 36, 50) + 38;
  } else if (uiGuidePage === 1) {
    // Selecting a tower before opening help puts its own branches first.
    const foundations = towerInfo.filter(i => i.upgrades);
    const selected = selectedTower && getTowerInfo(selectedTower);
    const focus = foundations.find(i => i === selected || i.upgrades.includes(selected?.type.name));
    const info = focus || foundations[0];
    const entries = selectedTower ? [info] : foundations;
    for (const foundation of entries) {
      if (!selectedTower) {
        uiText(c, foundation.name, 90, y, 39, uiColors.mint);
        y = uiWrap(c, foundation.upgrades.join(' / '), 90, y + 54, 900, 35, 48) + 38;
        continue;
      }
      uiText(c, foundation.name, 90, y, 39, uiColors.mint); y += 56;
      for (const name of foundation.upgrades) {
        const branch = towerInfo.find(i => i.type.name === name);
        y = uiWrap(c, branch.name + ' +' + branch.cost + ' · ' + branch.desc, 90, y, 900, selectedTower ? 38 : 29, selectedTower ? 55 : 40);
      }
      y += selectedTower ? 48 : 20;
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
  const signature = [interfaceCanvas.width, interfaceCanvas.height, gameMode.name, uiOverlay, uiGuidePage,
    paused, money, lives, waveCounter, betweenWaves, Math.ceil(buildTicks / 60),
    creeps.length + hopper.length + backlog.length, gameAccelerated, selectedBuild?.type.name,
    selectedTower?.cellPosition.x, selectedTower?.cellPosition.y, selectedTower?.constructor.name,
    selectedTower?.targetMode, selectedTower?.kills, Math.floor(selectedTower?.damageDealt || 0),
    uiSlide, sellConfirmTower === selectedTower, uiGesture?.button?.id,
    now < uiToastUntil ? uiToastMessage : '', assetsPending.length].join('|');
  if (signature === uiDrawSignature) return;
  uiDrawSignature = signature;
  c.clearRect(0, 0, g.width, g.height);

  c.fillStyle = uiColors.surface;
  c.fillRect(0, 0, g.width, g.hud);
  c.fillRect(0, g.dock, g.width, g.strip);
  if (gameMode === mainGame || gameMode === gameOver) {
    uiText(c, 'W' + waveCounter, 22, 51, 47, uiColors.mint);
    uiText(c, betweenWaves ? Math.ceil(buildTicks / 60) + 's' : String(creeps.length + hopper.length + backlog.length) + ' left', 22, 107, 33, uiColors.muted);
    uiText(c, '$' + money, 194, 78, money > 9999 ? 40 : 48, uiColors.gold);
    uiText(c, '♥ ' + lives, 416, 78, 44, uiColors.mint);
    for (const button of uiHudControls()) uiDrawButton(c, button);
    const bases = towerInfo.filter(i => i.upgrades);
    bases.forEach((info, i) => uiDrawButton(c, uiButton('build-' + info.type.name, i * 216, g.dock, 216, g.strip, info.name, String(info.cost), {info, selected: selectedBuild === info, disabled: money < info.cost})));
    if (uiPanelTower && uiSlide > 0) {
      c.save(); c.beginPath(); c.rect(0, g.dock, g.width, g.strip); c.clip();
      const offset = (1 - uiSlide) * g.width;
      c.fillStyle = uiColors.surface; c.fillRect(offset, g.dock, g.width, g.strip);
      const info = getTowerInfo(uiPanelTower);
      if (!info.upgrades) {
        uiText(c, info.name, offset + 24, g.dock + 50, 42, uiColors.mint);
        uiText(c, uiPanelTower.kills + ' kills · ' + Math.floor(uiPanelTower.damageDealt) + ' dmg', offset + 24, g.dock + 108, 30, uiColors.muted);
      }
      for (const button of uiTowerControls(uiPanelTower, offset)) uiDrawButton(c, button);
      c.restore();
    }
    c.fillStyle = uiColors.edge; c.fillRect(0, g.hud - 3, g.width, 3); c.fillRect(0, g.dock, g.width, 3);
  }
  const modal = uiModal();
  if (modal) {
    c.fillStyle = '#071114ed'; c.fillRect(0, 0, g.width, g.height);
    if (modal === 'guide') uiDrawGuide(c);
    else if (modal === 'pause') {
      uiText(c, 'Paused', 180, 420, 84, uiColors.mint);
      uiWrap(c, 'Wave ' + waveCounter + ' · ' + wavePlan(waveCounter).hint, 180, 525, 720, 36, 48);
    } else {
      uiText(c, modal === 'welcome' ? 'SLTD' : 'Defense breached', 180, 510, modal === 'welcome' ? 110 : 67, uiColors.mint);
      uiWrap(c, modal === 'welcome' ? 'Five foundations. Ten specializations.' : 'Reached wave ' + waveCounter + '.', 180, 660, 720, 43, 62);
      uiWrap(c, 'Tap to build. Tap a tower to upgrade. Pause for the field guide.', 180, 810, 720, 37, 56);
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
