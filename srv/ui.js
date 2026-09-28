"use strict";

// All geometry is in game coordinates. UI state never changes the viewport.
var uiOverlay = '';
var uiMapChoice = 'foundry';
var uiMapScroll = 0;
const uiMapList = {x:60, y:350, w:960, h:1180, stride:330};
var uiGuidePage = 0;
var uiSlide = 0;
var uiPanelTower = null;
var uiGesture = null;
var sellConfirmTower = null;
var uiUpgrade = null;
var uiToastMessage = '';
var uiToastUntil = 0;
var uiLastFrame = 0;
var uiDrawSignature = '';
var uiScoreHeader = 0;
const uiColors = {surface: '#0b171b', card: '#13272b', edge: '#29484b', text: '#deeee9', muted: '#99b4af', mint: '#81e4bd', gold: '#efd298'};
const uiTowerImages = new Map();

function uiGeometry() {
  return {width: 1080, height: 1848, hud: 156, dock: 1692, strip: 156};
}
function initUI() {
  uiOverlay = '';
  uiSlide = 0;
  uiPanelTower = null;
  uiGesture = null;
  sellConfirmTower = null;
  uiUpgrade = null;
  uiToastMessage = '';
  uiDrawSignature = '';
}
function updateUI() {
  if (selectedTower && !towers.includes(selectedTower)) selectedTower = null;
  uiPendingUpgrade();
}
function uiPendingUpgrade() {
  if (uiUpgrade && (uiUpgrade.tower !== selectedTower || !towers.includes(uiUpgrade.tower) ||
      uiUpgrade.level !== selectedTower.level || money < uiUpgrade.cost || uiModal())) uiUpgrade = null;
  return uiUpgrade;
}
function uiPreviewUpgrade(button) {
  const tower = selectedTower;
  const branch = button.branch;
  if (!tower || !branch || !towers.includes(tower) || uiModal()) return;
  const cost = branch.cost;
  if (money < cost) return;
  const next = new branch.type(tower.cellPosition.x, tower.cellPosition.y);
  const stats = towerLevelStats(next, tower.level);
  uiUpgrade = {tower, level: tower.level, buttonId: button.id, branch, cost, stats};
  sellConfirmTower = null;
}
function uiToast(message) {
  uiToastMessage = message;
  uiToastUntil = performance.now() + 1800;
}
function uiRectContains(r, p) {
  if (r.map && !uiRectContains(uiMapList, p)) return false;
  if (r.guide && r.points) return guideContains(r.points, p);
  return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;
}
function uiButton(id, x, y, w, h, label, sub = '', extra = {}) {
  return {id, x, y, w, h, label, sub, ...extra};
}
function uiModal() {
  if (uiOverlay === 'guide') return 'guide';
  if (uiOverlay === 'maps') return 'maps';
  if (gameMode === gameOver) return 'gameOver';
  if (gameMode !== mainGame) return 'welcome';
  return uiOverlay;
}
function uiOpenMaps() {
  uiMapChoice = mapCatalog.some(m => m.id === selectedMapId) ? selectedMapId : mapCatalog[0].id;
  uiSetMapScroll(mapCatalog.findIndex(m => m.id === uiMapChoice) * uiMapList.stride - (uiMapList.h - 320) / 2);
  uiOverlay = 'maps';
  cancelPlacement();
}
function uiMapScrollLimit() {
  return Math.max(0, mapCatalog.length * uiMapList.stride - 10 - uiMapList.h);
}
function uiSetMapScroll(offset) {
  uiMapScroll = Math.max(0, Math.min(uiMapScrollLimit(), offset));
}
function uiScrollMaps(pos, delta) {
  if (uiModal() !== 'maps' || !uiRectContains(uiMapList, pos)) return false;
  uiSetMapScroll(uiMapScroll + delta);
  if (uiGesture) { uiGesture.button = null; uiGesture.scrolling = true; }
  return true;
}

// The same button records drive drawing and hit testing, including animation.
function uiControls() {
  const modal = uiModal();
  if (modal === 'welcome' || modal === 'gameOver') {
    return [uiButton('start', 180, 1040, 720, 160, 'Choose map', '', {disabled: assetsPending.length > 0}),
      ...(modal === 'welcome' ? [uiButton('guide', 180, 1220, 720, 156, 'Field guide', '', {disabled: assetsPending.length > 0})] : [])];
  }
  if (modal === 'maps') return [
    ...mapCatalog.map((map, i) => uiButton('map-' + map.id, uiMapList.x, uiMapList.y + i * uiMapList.stride - uiMapScroll, uiMapList.w, 320, map.name, '', {map, selected: uiMapChoice === map.id}))
      .filter(b => b.y + b.h > uiMapList.y && b.y < uiMapList.y + uiMapList.h),
    uiButton('map-back', 60, 1580, 156, 156, '‹'),
    uiButton('deploy', 240, 1580, 780, 156, 'Deploy defenses', mapCatalog.find(m => m.id === uiMapChoice).name)
  ];
  if (modal === 'pause') return [
    uiButton('resume', 180, 650, 720, 156, 'Resume'),
    uiButton('plan', 180, 824, 720, 156, 'Inspect defenses', 'Keep time paused'),
    uiButton('guide', 180, 998, 720, 156, 'Field guide'),
    uiButton('fullscreen', 180, 1172, 720, 156, 'Fullscreen'),
    uiButton('restart', 180, 1346, 720, 156, 'Restart'),
    uiButton('abandon', 180, 1520, 720, 156, 'Abandon game')
  ];
  if (modal === 'guide') return guideControls();
  const g = uiGeometry();
  const buttons = uiHudControls();
  if (!selectedTower && uiSlide < 0.01) {
    towerInfo.filter(info => info.buildable).forEach((info, i) => buttons.push(
      uiButton('build-' + info.type.name, i * 216, g.dock, 216, g.strip, info.name, String(info.cost), {info, unaffordable: money < info.cost, selected: selectedBuild === info})
    ));
  }
  if (selectedTower && uiSlide > 0.99) {
    buttons.push(...uiTowerControls(selectedTower, 0));
    const confirm = uiUpgradeControl();
    if (confirm) buttons.push(confirm);
  }
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
  const pending = uiPendingUpgrade();
  uiUpgrade = null;
  if (button.disabled) return;
  const id = button.id;
  if (id === 'confirm-upgrade') {
    if (pending) upgradeTower(pending.tower, pending.branch.type.name);
  } else if (id === 'start') uiOpenMaps();
  else if (id === 'map-back') uiOverlay = '';
  else if (id === 'deploy') startGame(uiMapChoice);
  else if (id === 'restart') startGame(selectedMapId);
  else if (id === 'abandon') abandonGame();
  else if (id.startsWith('map-')) uiMapChoice = id.slice(4);
  else if (id === 'pause') {
    if (paused) { paused = false; uiOverlay = ''; }
    else { paused = true; uiOverlay = 'pause'; }
  } else if (id === 'resume') { paused = false; uiOverlay = ''; }
  else if (id === 'plan') uiOverlay = '';
  else if (id === 'guide') { if(gameMode === mainGame) paused = true; guideOpen(); }
  else if (id === 'guide-close') uiOverlay = gameMode === mainGame ? 'pause' : '';
  else if (id.startsWith('guide-')) guideActivate(id);
  else if (id === 'fullscreen') {
    const action = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
    if (action?.catch) action.catch(() => uiToast('Fullscreen is unavailable'));
  } else if (id === 'speed') { gameAccelerated = !gameAccelerated; gameAcceleration = 2; }
  else if (id === 'send') sendWave();
  else if (id.startsWith('build-')) {
    if (selectedBuild === button.info) cancelPlacement();
    else beginPlacement(button.info);
  } else if (id === 'level-up') {
    levelUpTower(selectedTower);
    sellConfirmTower = null;
  } else if (id.startsWith('upgrade-')) {
    if (!pending) uiPreviewUpgrade(button);
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
  const cancelledUpgrade = !!uiPendingUpgrade() && button?.id !== 'confirm-upgrade';
  if (cancelledUpgrade) uiUpgrade = null;
  const g = uiGeometry();
  const cancelOnly = placement.mode === 'tap' && placement.blocked;
  const captured = cancelOnly || !!button || !!uiModal() || pos.y < g.hud || pos.y >= g.dock;
  uiGesture = {button, start: pos, captured, dragging: false, cancelOnly, cancelledUpgrade};
  if (uiModal() === 'maps' && uiRectContains(uiMapList, pos)) uiGesture.mapScrollStart = uiMapScroll;
  return captured;
}
function pressMoveUI(pos) {
  if (!uiGesture?.captured) return false;
  if (uiGesture.cancelOnly) return true;
  if (uiGesture.mapScrollStart !== undefined) {
    if (vdistance(uiGesture.start, pos) > 16) uiGesture.scrolling = true;
    if (uiGesture.scrolling) {
      uiGesture.button = null;
      uiSetMapScroll(uiGesture.mapScrollStart + uiGesture.start.y - pos.y);
    }
    return true;
  }
  if (vdistance(uiGesture.start, pos) > 24 && !uiGesture.button?.info) {
    uiUpgrade = null;
    uiGesture.button = null;
  }
  if (uiGesture.button?.info && !uiGesture.button.disabled && vdistance(uiGesture.start, pos) > 24) {
    if (!uiGesture.dragging) beginPlacement(uiGesture.button.info, 'drag');
    uiGesture.dragging = true;
    setMousePos(pos);
    dragPlacement(mouseCell);
  }
  return true;
}
function pressEndUI(pos) {
  if (uiGesture?.mapScrollStart !== undefined) pressMoveUI(pos);
  const gesture = uiGesture;
  uiGesture = null;
  if (!gesture?.captured) return false;
  if (gesture.scrolling) return true;
  if (gesture.cancelOnly) { cancelPlacement(); return true; }
  if (gesture.dragging) {
    setMousePos(pos);
    finishPlacementDrag(mouseCell);
  } else if (gesture.button) {
    // Revalidate after the press: money, selection or game mode may have changed.
    const button = uiControls().find(b => b.id === gesture.button.id && uiRectContains(b, pos));
    if (button && !(gesture.cancelledUpgrade && button.branch)) uiActivate(button);
    else uiUpgrade = null;
  }
  return true;
}
function cancelUIInput() {
  if (placement.mode === 'drag') cancelPlacement();
  uiGesture = null;
  uiUpgrade = null;
}
function bindUI() {
  document.addEventListener('pointerdown', event => {
    if (event.target !== outputCanvas || event.button !== 0) uiUpgrade = null;
  });
  document.addEventListener('wheel', () => { uiUpgrade = null; }, {passive: true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameMode === mainGame) { paused = true; uiOverlay = 'pause'; cancelUIInput(); }
  });
  document.addEventListener('keydown', event => {
    uiUpgrade = null;
    if (event.repeat) return;
    if (uiOverlay === 'guide' && ['ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault(); guideActivate(event.code === 'ArrowLeft' ? 'guide-prev' : 'guide-next');
      return;
    }
    if (uiOverlay === 'guide' && event.code === 'Escape') {
      event.preventDefault(); uiActivate({id:'guide-close'}); return;
    }
    if (gameMode !== mainGame) return;
    if (event.code === 'Space') { event.preventDefault(); uiActivate({id: paused ? 'resume' : 'pause'}); }
    if (event.code === 'Escape') {
      if (uiOverlay === 'pause') uiActivate({id: 'resume'});
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
function uiTowerImage(info) {
  if (assetsPending.length) return null;
  if (!uiTowerImages.size) uiPrepareTowerImages();
  return uiTowerImages.get(info.type);
}
function uiPrepareTowerImages() {
  // Render once as an atlas at native game scale, using the live bloom settings.
  const atlas = document.createElement('canvas');
  atlas.width = frameCanvas.width; atlas.height = frameCanvas.height;
  const paint = atlas.getContext('2d'), previous = ctx;
  const cell = 128, columns = Math.floor(atlas.width / cell);
  const bounds = [];
  try {
    ctx = paint;
    towerInfo.forEach((info, index) => {
      const x = index % columns * cell, y = Math.floor(index / columns) * cell;
      const tower = new info.type(0, 0);
      tower.angle = Math.PI / 6;
      paint.save(); paint.translate(x + cell / 2, y + cell / 2);
      paint.scale(globalScaleFactor, globalScaleFactor);
      tower.draw(); paint.restore();
      const pixels = paint.getImageData(x, y, cell, cell).data;
      let left = cell, top = cell, right = -1, bottom = -1;
      for (let row = 0; row < cell; row++) for (let column = 0; column < cell; column++) {
        if (pixels[(row * cell + column) * 4 + 3] < 16) continue;
        left = Math.min(left, column); right = Math.max(right, column);
        top = Math.min(top, row); bottom = Math.max(bottom, row);
      }
      // Leave space for the halo outside the original PNG silhouette.
      const padding = 8;
      left = Math.max(0, left - padding); top = Math.max(0, top - padding);
      right = Math.min(cell - 1, right + padding); bottom = Math.min(cell - 1, bottom + padding);
      bounds.push({info, x: x + left, y: y + top, width: right - left + 1, height: bottom - top + 1});
    });
    glowFrame(atlas, true);
    for (const {info, x, y, width, height} of bounds) {
      const image = document.createElement('canvas');
      image.width = width; image.height = height;
      // Copy synchronously, before the WebGL drawing buffer is discarded.
      image.getContext('2d').drawImage(outputCanvas, x, y, width, height, 0, 0, width, height);
      uiTowerImages.set(info.type, {image, left: 0, top: 0, width, height});
    }
  } finally {
    ctx = previous;
    // Thumbnail generation shares the shader but never leaves its atlas on screen.
    glowFrame(frameCanvas);
  }
}
function uiDrawTowerImage(c, info, x, y, size, dimmed) {
  const picture = uiTowerImage(info);
  if (!picture) return;
  const {image, left, top, width, height} = picture;
  const scale = size / Math.max(width, height);
  c.save();
  if (dimmed) c.globalAlpha *= 0.45;
  c.imageSmoothingQuality = 'high';
  c.drawImage(image, left, top, width, height, x - width * scale / 2, y - height * scale / 2,
    width * scale, height * scale);
  c.restore();
}
function uiDrawButton(c, b) {
  if (b.guide) { guideDrawButton(c, b); return; }
  if (b.map) {
    c.save(); c.beginPath(); c.rect(uiMapList.x, uiMapList.y, uiMapList.w, uiMapList.h); c.clip();
    uiDrawMapCard(c, b); c.restore(); return;
  }
  if (b.id === 'confirm-upgrade') {
    c.strokeStyle = '#65adff'; c.lineWidth = 4;
    c.strokeRect(b.x + 3, b.y + 5, b.w - 6, b.h - 10);
    uiText(c, 'Confirm', b.x + b.w / 2, b.y + b.h / 2, 41, '#65adff', 'center');
    return;
  }
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
  } else if (b.info || b.branch) {
    uiDrawTowerImage(c, b.info || b.branch, center, b.y + 48, 80, b.disabled || b.unaffordable);
    uiText(c, b.label, center, b.y + 103, 31, color, 'center');
    uiText(c, b.sub, center, b.y + 137, 34, b.disabled || b.unaffordable ? color : uiColors.gold, 'center');
  } else {
    uiText(c, b.label, center, b.y + (b.sub ? 57 : b.h / 2), b.label.length > 14 ? 38 : b.label.length > 8 ? 33 : 41, color, 'center');
    if (b.sub) uiText(c, b.sub, center, b.y + 108, b.sub.length > 14 ? 30 : 38, b.disabled ? color : uiColors.gold, 'center');
  }
}
let uiGuideAnimating = false;
function drawUI(now = performance.now()) {
  const c = interfaceCtx, g = uiGeometry();
  const upgrade = uiPendingUpgrade();
  const scaleY = interfaceCanvas.height / (g.height + uiScoreHeader);
  c.setTransform(interfaceCanvas.width / g.width, 0, 0, scaleY, 0, uiScoreHeader * scaleY);
  const elapsed = Math.min(100, now - (uiLastFrame || now)); uiLastFrame = now;
  const destination = selectedTower ? 1 : 0;
  const step = elapsed / 180;
  uiSlide = destination ? Math.min(1, uiSlide + step) : Math.max(0, uiSlide - step);
  if (selectedTower) uiPanelTower = selectedTower;
  if (!uiSlide) uiPanelTower = null;
  const guideAnimating = uiOverlay === 'guide' && (guideAnimationFrame(now) !== 'settled' || guideTurretAnimating());
  const signature = [interfaceCanvas.width, interfaceCanvas.height, gameMode.name, uiOverlay, uiGuidePage, uiMapChoice, uiMapScroll, selectedMapId,
    paused, money, lives, score, uiScoreHeader, waveCounter, betweenWaves, buildTicks, waveClearPayout?.age, canSendWave(),
    creeps.length + hopper.length + backlog.length, gameAccelerated, selectedBuild?.type.name,
    selectedTower?.cellPosition.x, selectedTower?.cellPosition.y, selectedTower?.constructor.name,
    selectedTower?.level, selectedTower?.targetMode, selectedTower?.kills, Math.floor(selectedTower?.damageDealt || 0),
    uiSlide, sellConfirmTower === selectedTower, uiGesture?.button?.id, upgrade?.buttonId,
    placement.mode, placement.cell?.x, placement.cell?.y, placement.blocked,
    now < uiToastUntil ? uiToastMessage : '', assetsPending.length].join('|');
  if (signature === uiDrawSignature) {
    // One last composite removes the faded trace before returning to idle.
    if (uiOverlay === 'guide' && (guideAnimating || uiGuideAnimating)) guideComposite(c, now, false);
    uiGuideAnimating = guideAnimating;
    return;
  }
  uiDrawSignature = signature;
  c.clearRect(0, -uiScoreHeader, g.width, g.height + uiScoreHeader);

  c.fillStyle = uiColors.surface;
  c.fillRect(0, -uiScoreHeader, g.width, g.hud + uiScoreHeader);
  c.fillRect(0, g.dock, g.width, g.strip);
  if (gameMode === mainGame || gameMode === gameOver) {
    uiDrawNumberStamp(c, 'WAVE', String(betweenWaves ? Math.max(0, waveCounter - 1) : waveCounter), {x:6,y:0,w:180,h:156}, betweenWaves ? Math.ceil(buildTicks / 60) + 's' : String(creeps.length + hopper.length + backlog.length) + ' left');
    uiText(c, '$' + money, 194, 78, money > 9999 ? 40 : 48, uiColors.gold);
    uiText(c, '♥ ' + lives, 416, 78, 44, uiColors.mint);
    for (const button of uiHudControls()) uiDrawButton(c, button);
    // Drawing only: the compact score can cover buttons without changing hits.
    uiText(c, 'Score ' + score.toLocaleString(), uiScoreHeader ? g.width / 2 : 534,
      uiScoreHeader ? -uiScoreHeader / 2 : 24, uiScoreHeader ? 44 : 30, uiColors.text, 'center');
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
    c.fillStyle = uiColors.edge; c.fillRect(0, g.dock, g.width, 3);
    uiDrawWaveProgress(c, g);
    if (waveClearPayout) uiDrawWaveBonus(c, g);
  }
  uiDrawPlacement(c);
  uiDrawUpgrade(c);
  const modal = uiModal();
  if (modal) {
    c.fillStyle = '#071114ed'; c.fillRect(0, -uiScoreHeader, g.width, g.height + uiScoreHeader);
    if (modal === 'maps') {
      uiText(c, 'Choose your ground', 90, 180, 70, uiColors.mint);
      uiText(c, mapCatalog.length + ' routes · Drag to browse', 90, 270, 38, uiColors.muted);
      const limit = uiMapScrollLimit();
      if (limit > 0) {
        const thumb = uiMapList.h * uiMapList.h / (uiMapList.h + limit);
        c.fillStyle = uiColors.edge;
        c.fillRect(1034, uiMapList.y, 6, uiMapList.h);
        c.fillStyle = uiColors.muted;
        c.fillRect(1034, uiMapList.y + uiMapScroll / limit * (uiMapList.h - thumb), 6, thumb);
      }
    } else if (modal === 'guide') uiDrawGuide(c, now);
    else if (modal === 'pause') {
      uiText(c, 'Paused', 180, 420, 84, uiColors.mint);
      uiWrap(c, 'Wave ' + waveCounter + ' · ' + wavePlan(waveCounter).hint, 180, 525, 720, 36, 48);
    } else {
      uiText(c, modal === 'welcome' ? 'SLTD' : 'Defense breached', 180, 510, modal === 'welcome' ? 110 : 67, uiColors.mint);
      uiWrap(c, modal === 'welcome' ? 'Five foundations. Branches and levels.' : 'Reached wave ' + waveCounter + ' · Score ' + score.toLocaleString() + '.', 180, 660, 720, 43, 62);
      uiWrap(c, modal === 'welcome' ? 'Choose a map, or explore the field guide before you deploy.' : 'Choose a map, then build your defense. Pause for the field guide.', 180, 810, 720, 37, 56);
    }
    for (const button of uiControls()) uiDrawButton(c, button);
  }
  if (uiToastMessage && now < uiToastUntil) {
    c.font = '500 34px system-ui, sans-serif';
    const width = Math.min(1000, c.measureText(uiToastMessage).width + 48);
    c.fillStyle = '#152c2ff0'; c.fillRect((g.width - width) / 2, g.hud + 18, width, 64);
    uiText(c, uiToastMessage, g.width / 2, g.hud + 50, 34, uiColors.text, 'center');
  }
  if (uiOverlay === 'guide') guideComposite(c, now, true);
  uiGuideAnimating = guideAnimating;
}

function uiUpgradeControl() {
  const pending = uiPendingUpgrade();
  if (!pending || uiSlide < 0.99) return null;
  const button = uiTowerControls(pending.tower, 0).find(b => b.id === pending.buttonId);
  return uiButton('confirm-upgrade', button.x, button.y - 156, button.w, 156, 'Confirm');
}
function uiDrawUpgrade(c) {
  const pending = uiPendingUpgrade(), confirm = uiUpgradeControl();
  if (!pending || !confirm) return;
  const {tower, stats} = pending;
  c.save(); c.beginPath(); c.rect(12, mapTop, 1056, 1536); c.clip();
  c.strokeStyle = '#65adff'; c.lineWidth = 3;
  for (const radius of [stats.range, stats.minimumRange]) {
    if (!(radius > 0)) continue;
    c.beginPath(); c.arc(tower.x + 12, tower.y + mapTop, radius, 0, TWOPI); c.stroke();
  }
  c.restore();
  uiDrawButton(c, confirm);
}

function uiDrawWaveProgress(c, g) {
  // Draw in backing pixels so the rule stays exactly one pixel high at any DPR.
  const transform = c.getTransform();
  const y = Math.round(g.hud * transform.d + transform.f) - 1;
  const tip = Math.round(interfaceCanvas.width * waveProgress());
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = uiColors.edge; c.fillRect(0, y, interfaceCanvas.width, 1);
  c.fillStyle = uiColors.mint; c.fillRect(0, y, tip, 1);
  // Only the leading particle glows; the progress rule remains sharp.
  const radius = Math.max(3, 14 * transform.a);
  const glow = c.createRadialGradient(tip, y + .5, 0, tip, y + .5, radius);
  glow.addColorStop(0, '#defff2'); glow.addColorStop(.25, '#81e4bdaa'); glow.addColorStop(1, '#81e4bd00');
  c.fillStyle = glow; c.beginPath(); c.arc(tip, y + .5, radius, 0, TWOPI); c.fill();
  c.fillStyle = '#effff8'; c.fillRect(tip - 1, y, 2, 1);
  c.restore();
}

function uiDrawWaveBonus(c, g) {
  const bonus = waveClearPayout;
  const converted = Math.floor(bonus.timeBonus * Math.min(1, bonus.age / waveBonusDrainTicks));
  c.fillStyle = '#102a28ee'; c.fillRect(90, g.hud + 28, 900, 140);
  uiText(c, 'LEVEL COMPLETE', g.width / 2, g.hud + 68, 32, uiColors.mint, 'center');
  uiText(c, bonus.base === 0 ? 'No wave bonus' : '$' + bonus.base + ' + $' + converted + ' time = $' + (bonus.base + converted),
    g.width / 2, g.hud + 125, 40, uiColors.gold, 'center');
}

function uiDrawNumberStamp(c, word, number, bounds, sub, disabled = false) {
  const center = bounds.x + bounds.w / 2;
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '900 72px system-ui, sans-serif';
  c.fillStyle = disabled ? '#52655e' : uiColors.mint;
  c.globalAlpha = .3;
  // Extend the labels downwards while keeping their top edge in place.
  c.save(); c.translate(center, bounds.y + 65); c.scale(1, 1.65);
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
  const record = highScoreRecordForMap(map.id);
  const level = record.level === null ? '' : ' · Level ' + record.level;
  uiText(c, 'High score ' + record.score.toLocaleString() + level, x + 242, y + 268, 34, uiColors.gold);
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
