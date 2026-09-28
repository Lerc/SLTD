const check = (condition, message) => { if (!condition) throw new Error(message); };
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const viewport = document.getElementById('viewport');
const originalStyle = viewport.style.cssText;
const records = mapCatalog.map(m => [m.id, localStorage.getItem('sltd.highScore.' + m.id)]);
const originalScores = highScores;
async function tap(id, top = false) {
  const b = uiControls().find(b => b.id === id);
  check(b && !b.disabled, 'Available control: ' + id);
  await gameControl.tapCanvas(b.x + b.w / 2, b.y + (top ? 24 : b.h / 2));
}
async function resize(width, height) {
  viewport.style.cssText = `inset:0 auto auto 0;width:${width}px;height:${height}px`;
  for (let i = 0; i < 4; i++) await frame();
}
try {
  for (const [id] of records) localStorage.removeItem('sltd.highScore.' + id);
  highScores = Object.create(null);
  startGame('foundry'); paused = true;
  waveCounter = 12;
  const creep = new BigBall(); creep.waveNumber = 12;
  creep.takeDamage(creep.hitPoints, 'piercing');
  check(score === 600, 'Kill scores immediately');
  const snapshot = gameControl.saveState();
  gameControl.loadState(snapshot); paused = true;
  check(score === 600, 'Browser snapshot retains score');
  const draws = [];
  const fillText = interfaceCtx.fillText;
  interfaceCtx.fillText = function(text, x, y, ...rest) {
    draws.push({text, x, y, font:this.font});
    return fillText.call(this, text, x, y, ...rest);
  };
  try {
    for (const [width, height, header] of [[360, 800, 72], [360, 616, 0], [800, 400, 0]]) {
      await resize(width, height);
      check(uiScoreHeader === header, 'Score layout responds to spare viewport height');
      draws.length = 0; uiDrawSignature = ''; drawUI();
      const label = draws.find(d => d.text === 'Score 600');
      check(label && label.y === (header ? -36 : 24), 'Score is drawn in the correct band');
      check(label.x === (header ? 540 : 534), 'Score centered over the intended region');
      const board = outputCanvas.getBoundingClientRect();
      const overlay = interfaceCanvas.getBoundingClientRect();
      const scale = board.width / 1080;
      check(Math.abs(board.top - overlay.top - header * scale) < 1, 'Whole game shifts below score strip');
      check(Math.abs(board.height / scale - 1848) < 1, 'Board and controls retain their proportions');
      check(board.bottom <= height + 1 && board.right <= width + 1, 'Game fits viewport');
      const point = gameControl.cellToCanvas(3, 2);
      const client = gameControl.canvasToClient(point.x, point.y);
      const mapped = screenToCanvas({x:client.clientX, y:client.clientY});
      check(Math.abs(mapped.x - point.x) < .01 && Math.abs(mapped.y - point.y) < .01, 'Input coordinates follow shifted board');
      const fast = gameAccelerated;
      await tap('speed', true);
      check(gameAccelerated !== fast, 'Score does not capture upper speed-button taps');
      await tap('pause', true);
      check(!paused, 'Upper pause tap resumes inspection');
      await tap('pause', true);
      check(paused && uiOverlay === 'pause', 'Upper pause tap opens menu');
      await tap('plan');
      await gameControl.screenshot(header ? 'score-tall' : width > height ? 'score-landscape' : 'score-compact');
    }
  } finally { interfaceCtx.fillText = fillText; }
  await resize(360, 800);
  await tap('pause'); // Resume inspection.
  await tap('pause');
  await gameControl.screenshot('score-pause');
  await tap('restart');
  check(gameMode === mainGame && selectedMapId === 'foundry' && score === 0, 'Restart resets same map');
  check(money === 320 && lives === 20 && towers.length === 0 && !paused && !uiOverlay, 'Restart clears game and menu state');
  check(highScoreForMap('foundry') === 600, 'Restart retains map record');
  await tap('pause'); await tap('abandon');
  check(gameMode === titleScreen && uiOverlay === 'maps', 'Abandon returns to map selection');
  highScores = Object.create(null);
  check(highScoreForMap('foundry') === 600, 'Record reloads from browser storage');
  check(highScoreRecordForMap('foundry').level === 12, 'Record level reloads from browser storage');
  localStorage.setItem('sltd.highScore.switchback', '123');
  delete highScores.switchback;
  draws.length = 0;
  interfaceCtx.fillText = function(text, x, y, ...rest) {
    draws.push({text, x, y, font:this.font});
    return fillText.call(this, text, x, y, ...rest);
  };
  try {
    uiDrawSignature = ''; drawUI();
    check(draws.some(d => d.text === 'High score 600 · Level 12'), 'Map card shows the recorded level');
    check(draws.some(d => d.text === 'High score 123'), 'Legacy map card shows only the score');
    check(!draws.some(d => d.text.startsWith('High score 123 ·')), 'Legacy map card does not invent a level');
  } finally { interfaceCtx.fillText = fillText; }
  await gameControl.screenshot('score-maps');
  localStorage.removeItem('sltd.highScore.switchback');
  delete highScores.switchback;
  await tap('map-switchback'); await tap('deploy');
  paused = true;
  new Basic().takeDamage(10, 'piercing');
  check(score === 5 && highScoreForMap('switchback') === 5 && highScoreForMap('foundry') === 600, 'Maps retain independent records');
  wslog({result:'PASS', layouts:['tall', 'compact', 'landscape'], persistence:true, pauseActions:true});
} finally {
  viewport.style.cssText = originalStyle;
  for (const [id, value] of records) {
    if (value === null) localStorage.removeItem('sltd.highScore.' + id);
    else localStorage.setItem('sltd.highScore.' + id, value);
  }
  highScores = originalScores;
  startGame('foundry'); paused = true;
}
