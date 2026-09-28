"use strict";

var waveBonusDrainTicks = 45;
var waveBonusPauseTicks = 240;

// Introduce a counter at a time, then revisit it in mixed waves.
var waveThemes = [
  {name: 'First contact', hint: 'Build two Sentries beside the bends.', kinds: [Basic]},
  {name: 'Quick feet', hint: 'Runners are fragile. Fast fire catches them.', kinds: [Basic, Zipper]},
  {name: 'Iron shells', hint: 'Armor blocks 60% of physical damage. Use Pulse or Ranger.', kinds: [Basic, Ball]},
  {name: 'Static charge', hint: 'Shields recharge out of combat and block new debuffs. Energy strips them.', kinds: [Zipper, Shieldbug]},
  {name: 'The first guardian', hint: 'Guardian: high health, slow resistant, costs 3 lives.', kinds: [Basic, Ball], boss: true},
  {name: 'Second wind', hint: 'Menders regenerate. Burning stops their recovery.', kinds: [Basic, Mender]},
  {name: 'Brood march', hint: 'Splitters release two runners when defeated.', kinds: [Splitter, Zipper]},
  {name: 'Skimmer rush', hint: 'Fast shielded Skimmers resist chilling until their shields break.', kinds: [Zipper, Skimmer, Splitter]},
  {name: 'Charging column', hint: 'Capacitors enter unshielded. Keep hitting them to prevent charging.', kinds: [Shieldbug, Ball, Capacitor]},
  {name: 'Guardian escort', hint: 'Focus strong targets; keep crowd control for the escort.', kinds: [Spikey, Shieldbug, Splitter], boss: true},
  {name: 'Bulwark escort', hint: 'Bulwarks combine armor and shields. Energy and piercing cut through.', kinds: [Mender, Bulwark, Flyer]},
  {name: 'Breakthrough', hint: 'Fast enemies and armored escorts. Cover the exit.', kinds: [Zipper, Ball, Splitter]}
];
function wavePlan(num) {
  const theme = waveThemes[(num - 1) % waveThemes.length];
  const count = Math.min(60, 8 + Math.floor(num * 1.5));
  const kinds = [];
  for (let i = 0; i < count; i++) {
    const veteran = [Spikey, Shieldbug, Mender, Splitter, Skimmer, Bulwark, Capacitor];
    kinds.push(num > 12 && i % 3 === 0 ? veteran[(Math.floor(i / 3) + num) % veteran.length] : theme.kinds[i % theme.kinds.length]);
  }
  if (theme.boss || num % 5 === 0) kinds.splice(Math.floor(count / 2), 0, BigBall);
  return {...theme, name: theme.name + (num > 12 ? ' · veteran ' + Math.floor((num - 1) / 12) : ''), kinds, count: kinds.length, interval: Math.max(22, 70 - num * 2), reward: 35 + num * 5};
}
function waveDifficulty(num) { return 1 + (num - 1) * 0.16 + Math.pow(Math.max(0, num - 5), 1.35) * 0.07 + Math.pow(Math.max(0, num - 12), 2) * 0.16; }

// Nominal, unobstructed travel along the ordered route, in simulation ticks.
// Use every release/speed pair: an earlier slow guardian can leave last.
function waveDuration(formation, interval, path = levelMap.path) {
  const distance = path.slice(1).reduce((sum, point, i) => sum + vdistance(path[i], point) * cellSize, 0);
  return Math.max(0, ...formation.map((creep, i) => 1 + i * interval + Math.ceil(distance / creep.speed)));
}

function canSendWave() {
  return globalThis.gameMode === globalThis.mainGame && !globalThis.paused &&
    globalThis.sendCooldown === 0 && !(globalThis.waveClearPayout?.age < waveBonusPauseTicks);
}
function waveSendBonus() { return waveClearBase > 0 ? Math.max(0, Math.ceil(buildTicks / 60)) : 0; }
function sendWave() {
  if (!canSendWave()) return false;
  const bonus = waveSendBonus();
  money = globalThis.money = money + bonus;
  if (!betweenWaves) waveCounter = globalThis.waveCounter = waveCounter + 1;
  globalThis.buildTicks = 0;
  globalThis.betweenWaves = false;
  globalThis.sendCooldown = 180;
  globalThis.waveClearPayout = null;
  generateWave(globalThis.waveCounter);
  return true;
}

function spawnWaveCreeps() {
  for (const wave of activeWaves) {
    wave.age++;
    // Each wave keeps its own cadence when another wave is called in.
    if ((wave.age - 1) % wave.interval !== 0) continue;
    const index = hopper.findIndex(c => c.waveNumber === wave.number);
    if (index >= 0) creeps.push(hopper.splice(index, 1)[0]);
  }
}
function rewardClearedWaves() {
  if (lives <= 0 || !activeWaves.length || waveClearPayout || [...creeps, ...hopper, ...backlog].some(c => !c.dead)) return;
  waveClearPayout = globalThis.waveClearPayout = {
    base: waveClearBase, timeBonus: waveSendBonus(), age: 0,
    remainingTicks: buildTicks, totalTicks: waveCountdownTotal
  };
  money = globalThis.money = money + waveClearBase + waveClearPayout.timeBonus;
  waveClearBase = globalThis.waveClearBase = 0;
  activeWaves = globalThis.activeWaves = [];
  buildTicks = globalThis.buildTicks = 0;
}

function tickWaveCountdown() {
  if (waveClearPayout) {
    waveClearPayout.age++;
    if (waveClearPayout.age < waveBonusPauseTicks) return;
    // The payout presentation is the break before the next wave.
    sendWave();
    return;
  }
  buildTicks = globalThis.buildTicks = Math.max(0, buildTicks - 1);
}

function waveProgress() {
  if (waveClearPayout && waveClearPayout.age < waveBonusPauseTicks) {
    return waveClearPayout.remainingTicks / waveClearPayout.totalTicks * Math.max(0, 1 - waveClearPayout.age / waveBonusDrainTicks);
  }
  return waveCountdownTotal > 0 ? Math.max(0, Math.min(1, buildTicks / waveCountdownTotal)) : 0;
}

function restoreWaveCountdown(state) {
  waveClearPayout = globalThis.waveClearPayout = state.waveClearPayout ? {...state.waveClearPayout} : null;
  waveClearBase = globalThis.waveClearBase = state.waveClearBase ?? activeWaves.reduce((sum, w) => sum + wavePlan(w.number).reward, 0);
  waveCountdownTotal = globalThis.waveCountdownTotal = state.waveCountdownTotal ?? (betweenWaves ? Math.max(600, buildTicks) :
    waveDuration(wavePlan(waveCounter).kinds.map(Kind => new Kind()), releaseRate) + 600);
  if (state.waveCountdownTotal === undefined && !betweenWaves) {
    buildTicks = globalThis.buildTicks = Math.max(0, waveCountdownTotal - waveAge);
  }
}
if (typeof module !== 'undefined' && module.exports) Object.assign(globalThis, {
  waveBonusDrainTicks, waveBonusPauseTicks, waveThemes, wavePlan, waveDifficulty, waveDuration, canSendWave, waveSendBonus, sendWave,
  spawnWaveCreeps, rewardClearedWaves, tickWaveCountdown, waveProgress, restoreWaveCountdown
});
