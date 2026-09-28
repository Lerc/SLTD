const check = (condition, message) => { if (!condition) throw new Error(message); };
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const viewport = document.getElementById('viewport');
const previousStyle = viewport.style.cssText;
const labels = [];
const fillText = interfaceCtx.fillText;
interfaceCtx.fillText = function(text, ...args) { labels.push(text); return fillText.call(this, text, ...args); };
function draw() { labels.length = 0; uiDrawSignature = ''; drawUI(); }
try {
  viewport.style.cssText = 'inset:0 auto auto 0;width:390px;height:844px';
  for (let i = 0; i < 4; i++) await frame();
  startGame('crosswind'); sendWave(); paused = true;
  const total = buildTicks;
  for (let i = 0; i < 180; i++) mainGame_core();
  check(buildTicks === total - 180, 'Timer uses simulation ticks');
  draw();
  check(uiControls().find(b => b.id === 'send').sub === '+$' + Math.ceil(buildTicks / 60), 'Send advertises the duration bonus');
  // Verify the progress rule in backing pixels, away from its glowing tip.
  const transform = interfaceCtx.getTransform();
  const y = Math.round(uiGeometry().hud * transform.d + transform.f) - 1;
  const x = Math.floor(interfaceCanvas.width / 4);
  const pixel = row => [...interfaceCtx.getImageData(x, row, 1, 1).data];
  check(pixel(y).slice(0, 3).join(',') === '129,228,189', 'Mint progress rule occupies its boundary pixel');
  check(pixel(y - 1).slice(0, 3).join(',') !== '129,228,189' && pixel(y + 1).slice(0, 3).join(',') !== '129,228,189', 'Progress rule is exactly one pixel high');
  await gameControl.screenshot('wave-countdown');

  // Overlap two waves, clear only the newer one, then cash out the whole pot.
  paused = false; sendWave(); paused = true;
  const base = waveClearBase;
  creeps = creeps.filter(c => c.waveNumber !== 2);
  hopper = hopper.filter(c => c.waveNumber !== 2);
  const balance = money;
  rewardClearedWaves();
  check(money === balance && waveClearBase === base, 'No partial wave-clear payment');
  creeps = []; hopper = []; backlog = [];
  const timeBonus = waveSendBonus();
  rewardClearedWaves(); draw();
  check(waveClearBase === 0 && money === balance + base + timeBonus, 'Combined base and time bonus pay once');
  check(labels.includes('LEVEL COMPLETE') && labels.includes('$' + base + ' + $0 time = $' + base), 'Clear display starts at the accumulated base');
  const fraction = waveProgress();
  for (let i = 0; i < 15; i++) mainGame_core();
  draw();
  const converted = Math.floor(timeBonus / 3);
  check(labels.includes('$' + base + ' + $' + converted + ' time = $' + (base + converted)), 'Displayed bonus grows proportionally');
  check(Math.abs(waveProgress() - fraction * 2 / 3) < 1e-9, 'Progress drains in proportion to the converted bonus');
  await gameControl.screenshot('wave-clear-converting');
  for (let i = 15; i < waveBonusDrainTicks; i++) mainGame_core();
  draw(); check(waveProgress() === 0, 'Progress reaches zero');
  check(labels.includes('$' + base + ' + $' + timeBonus + ' time = $' + (base + timeBonus)), 'Final displayed award is exact');
  await gameControl.screenshot('wave-clear-total');
  for (let i = waveBonusDrainTicks; i < waveBonusPauseTicks - 1; i++) mainGame_core();
  check(waveCounter === 2 && waveClearPayout && buildTicks === 0, 'Payout stays visible without an extra preparation countdown');
  paused = false;
  mainGame_core();
  paused = true;
  check(!betweenWaves && waveCounter === 3 && !waveClearPayout, 'Wave three starts as soon as the payout presentation ends');
  check(money === balance + base + timeBonus, 'Countdown does not repay the bonus');
  // A leak cancels the shared pot and the result must still advance the game.
  startGame('foundry'); sendWave(); paused = true; mainGame_core();
  const leak = creeps[0];
  leak.pathIndex = levelMap.path.length - 1; leak.findNextStep();
  const noBonusBalance = money;
  draw();
  check(waveClearBase === 0 && uiControls().find(b => b.id === 'send').sub === '+$0', 'A leak removes the advertised time bonus');
  creeps = []; hopper = []; backlog = [];
  mainGame_core(); draw();
  check(labels.includes('No wave bonus'), 'Zero-base clear explicitly says No wave bonus');
  check(waveClearPayout?.base === 0 && waveClearPayout.timeBonus === 0, 'Zero-base clear awards no time bonus');
  check(money === noBonusBalance, 'Zero-base clear pays nothing');
  for (let i = 0; i < waveBonusPauseTicks - 1; i++) mainGame_core();
  check(waveCounter === 1, 'No-bonus result retains the payout pause');
  paused = false; mainGame_core(); paused = true;
  check(waveCounter === 2 && !waveClearPayout && money === noBonusBalance, 'No-bonus result advances once without extra credit');
  check(running, 'Rendering remains healthy');
  wslog({result:'PASS', pixelRule:1, combinedBase:base, timeBonus, automaticWave:waveCounter});
} finally {
  interfaceCtx.fillText = fillText;
  viewport.style.cssText = previousStyle;
  startGame('foundry'); paused = true;
}
