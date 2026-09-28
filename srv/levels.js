"use strict";

// Damage uses 1 + a*n^p; rate/range approach 1 + cap exponentially.
// n = level - 1. Bounded rate/range preserve each weapon's role at high levels.
// Each row: first level price, price exponent, damage curve, rate curve, range curve.
var towerGrowth = {
  Tower:       [40, 1.45, [.38,1.12], [.65,.20], [.32,.16]],
  Stubby:      [55, 1.48, [.55,1.18], [.28,.12], [.24,.15]],
  Zappy:       [60, 1.44, [.25,1.10], [1.20,.27], [.22,.12]],
  Incinerator: [50, 1.46, [.18,1.08], [.50,.15], [.30,.12]],
  Thumper:     [65, 1.50, [.30,1.08], [.45,.14], [.80,.28]],
  Ranger:      [95, 1.52, [.45,1.20], [.35,.10], [.55,.22]],
  Repeater:    [100,1.48, [.20,1.05], [1.90,.32], [.18,.11]],
  Mortar:      [120,1.55, [.58,1.22], [.28,.09], [.42,.18]],
  Star:        [140,1.58, [.65,1.24], [.40,.16], [.28,.13]],
  Inferno:     [110,1.51, [.22,1.09], [.60,.18], [.20,.10]],
  Firestorm:   [125,1.54, [.32,1.13], [.32,.11], [.46,.19]],
  Tesla:       [130,1.53, [.28,1.11], [.70,.21], [.38,.17]],
  Prism:       [130,1.56, [.38,1.16], [.95,.25], [.35,.14]],
  Railgun:     [175,1.62, [.70,1.28], [.18,.08], [.36,.20]],
  Executioner: [160,1.57, [.48,1.21], [.55,.19], [.26,.09]],
  Cryo:        [100,1.49, [.16,1.04], [.38,.13], [.70,.24]],
  Quake:       [125,1.54, [.50,1.17], [.32,.10], [.62,.23]]
};
const effectGrowth = {
  Incinerator: {burnPower:[.55,1.22], burnDuration:[.60,.22], splash:[.25,.14]},
  Inferno: {burnPower:[.85,1.28], burnDuration:[1.00,.24], splash:[.18,.10]},
  Firestorm: {burnPower:[.38,1.15], burnDuration:[.45,.16], splash:[.85,.25]},
  Mortar: {splash:[.65,.21]},
  Tesla: {chainRange:[.50,.18], chainCount:[4,.16]},
  Cryo: {slowFactor:[.38,.20], slowDuration:[.65,.18]},
  Quake: {slowFactor:[.25,.12], slowDuration:[.40,.16]}
};
function levelCurve(curve, n, power = false) {
  return 1 + curve[0] * (power ? Math.pow(n, curve[1]) : 1 - Math.exp(-curve[1] * n));
}
function levelBase(tower) {
  if (!tower.levelBase) {
    tower.levelBase = {};
    for (const key of ['power','rate','range','minimumRange','splash','burnPower','burnDuration','slowFactor','slowDuration','chainCount','chainRange']) {
      if (tower[key] !== undefined) tower.levelBase[key] = tower[key];
    }
  }
  return tower.levelBase;
}
function towerLevelStats(tower, level = tower.level) {
  const base = levelBase(tower), profile = towerGrowth[tower.constructor.name], n = level - 1;
  const stats = {...base};
  stats.power = base.power * levelCurve(profile[2], n, true);
  stats.rate = base.rate * levelCurve(profile[3], n);
  stats.range = base.range * levelCurve(profile[4], n);
  // Orbital's blind spot narrows gradually, but never disappears.
  stats.minimumRange = base.minimumRange / levelCurve(profile[4], n);
  for (const [key, curve] of Object.entries(effectGrowth[tower.constructor.name] || {})) {
    const factor = levelCurve(curve, n, key === 'burnPower');
    if (key === 'slowFactor') stats[key] = Math.max(.22, 1 - (1 - base[key]) * factor);
    else if (key === 'chainCount') stats[key] = base[key] + Math.floor(factor - 1);
    else stats[key] = base[key] * factor;
  }
  return stats;
}
function applyTowerLevel(tower, level = 1) {
  if (!Number.isSafeInteger(level) || level < 1) level = 1;
  Object.assign(tower, towerLevelStats(tower, level));
  tower.level = level;
  return tower;
}
function levelUpCost(tower) {
  const [price, exponent] = towerGrowth[tower.constructor.name];
  return Math.ceil(price * Math.pow(tower.level, exponent) / 5) * 5;
}
function levelUpTower(tower) {
  if (globalThis.gameMode !== globalThis.mainGame || !towers.includes(tower)) return false;
  const cost = levelUpCost(tower);
  if (!Number.isFinite(cost) || money < cost) return false;
  const cooldownFraction = tower.cooldown * tower.rate / 1000;
  applyTowerLevel(tower, tower.level + 1);
  tower.cooldown = cooldownFraction * 1000 / tower.rate;
  tower.invested += cost;
  money = globalThis.money = money - cost;
  combatEffect(tower.position, getTowerInfo(tower).tint || '#184038', null, 65);
  return tower;
}
function levelUpHighlight(tower) {
  const next = towerLevelStats(tower, tower.level + 1);
  const keys = [['power','damage'],['rate','rate'],['range','range'],['burnPower','burn'],['splash','splash']];
  const gains = keys.filter(([key]) => tower[key] > 0).map(([key,label]) => ({label, gain:next[key]/tower[key]-1}));
  const best = gains.sort((a,b) => b.gain-a.gain)[0];
  return '+' + Math.round(best.gain*100) + '% ' + best.label;
}
if (typeof module !== 'undefined' && module.exports) Object.assign(globalThis, {
  towerGrowth, towerLevelStats, applyTowerLevel, levelUpCost, levelUpTower, levelUpHighlight
});
