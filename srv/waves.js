"use strict";

// Introduce a counter at a time, then revisit it in mixed waves.
var waveThemes = [
  {name: 'First contact', hint: 'Build two Sentries beside the bends.', kinds: [Basic]},
  {name: 'Quick feet', hint: 'Runners are fragile. Fast fire catches them.', kinds: [Basic, Zipper]},
  {name: 'Iron shells', hint: 'Armor blocks 60% of physical damage. Use Pulse or Ranger.', kinds: [Basic, Ball]},
  {name: 'Static charge', hint: 'Energy strips shields; piercing bypasses them.', kinds: [Zipper, Shieldbug]},
  {name: 'The first guardian', hint: 'Guardian: high health, slow resistant, costs 3 lives.', kinds: [Basic, Ball], boss: true},
  {name: 'Second wind', hint: 'Menders regenerate. Burning stops their recovery.', kinds: [Basic, Mender]},
  {name: 'Brood march', hint: 'Splitters release two runners when defeated.', kinds: [Splitter, Zipper]},
  {name: 'Swarm front', hint: 'Chains and splash punish tightly packed enemies.', kinds: [Zipper, Flyer, Splitter]},
  {name: 'Fortified column', hint: 'Combine energy, piercing and a slowing field.', kinds: [Shieldbug, Ball, Mender]},
  {name: 'Guardian escort', hint: 'Focus strong targets; keep crowd control for the escort.', kinds: [Spikey, Shieldbug, Splitter], boss: true},
  {name: 'Reclamation', hint: 'Burn the menders before their shields outlast you.', kinds: [Mender, Shieldbug, Flyer]},
  {name: 'Breakthrough', hint: 'Fast enemies and armored escorts. Cover the exit.', kinds: [Zipper, Ball, Splitter]}
];
function wavePlan(num) {
  const theme = waveThemes[(num - 1) % waveThemes.length];
  const count = Math.min(60, 8 + Math.floor(num * 1.5));
  const kinds = [];
  for (let i = 0; i < count; i++) {
    const veteran = [Spikey, Shieldbug, Mender, Splitter];
    kinds.push(num > 12 && i % 3 === 0 ? veteran[(Math.floor(i / 3) + num) % veteran.length] : theme.kinds[i % theme.kinds.length]);
  }
  if (theme.boss || num % 5 === 0) kinds.splice(Math.floor(count / 2), 0, BigBall);
  return {...theme, name: theme.name + (num > 12 ? ' · veteran ' + Math.floor((num - 1) / 12) : ''), kinds, count: kinds.length, interval: Math.max(22, 70 - num * 2), reward: 35 + num * 5};
}
function waveDifficulty(num) { return 1 + (num - 1) * 0.16 + Math.pow(Math.max(0, num - 5), 1.35) * 0.07 + Math.pow(Math.max(0, num - 12), 2) * 0.16; }
function sendWave() {
  if (globalThis.gameMode !== globalThis.mainGame || !globalThis.betweenWaves || globalThis.paused) return false;
  const bonus = Math.ceil(globalThis.buildTicks / 60);
  money = globalThis.money = money + bonus;
  globalThis.buildTicks = 0;
  globalThis.betweenWaves = false;
  generateWave(globalThis.waveCounter);
  return true;
}
if (typeof module !== 'undefined' && module.exports) Object.assign(globalThis, {waveThemes, wavePlan, waveDifficulty, sendWave});
