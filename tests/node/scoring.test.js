const assert = require('node:assert/strict');
const {test, beforeEach} = require('node:test');
const game = require('../../srv/nodemain.js');

beforeEach(() => {
  globalThis.highScores = Object.create(null);
  delete globalThis.localStorage;
  game.reset();
});
const kill = creep => creep.takeDamage(creep.hitPoints, 'piercing');

test('kills score by type and originating level, once, including burn kills', () => {
  const basic = new Basic();
  basic.waveNumber = 2;
  globalThis.waveCounter = 9;
  basic.takeDamage(1);
  assert.equal(score, 0);
  kill(basic);
  assert.equal(score, 10);
  assert.deepEqual(highScoreRecordForMap(selectedMapId), {score: 10, level: 9}, 'Records the current level, not the killed creep’s originating level');
  kill(basic);
  assert.equal(score, 10);
  const guardian = new BigBall();
  kill(guardian);
  assert.equal(score, 460);
  const burning = new Zipper();
  burning.applyBurn(1, burning.hitPoints, null);
  burning.move();
  assert.equal(score, 478);
  assert.equal(game.score, score);
});

test('leaks, wave bonuses and buying or selling towers do not award points', () => {
  const leak = new Basic();
  leak.pathIndex = levelMap.path.length;
  leak.findNextStep();
  kill(leak);
  assert.equal(lives, 19);
  sendWave();
  game.placeTower('Tower', 3, 2);
  sellTower(towers[0]);
  assert.equal(score, 0);
});

test('split children retain their parent level across save/load and overlapping waves', () => {
  generateWave(7);
  const parent = new Splitter();
  parent.waveNumber = 4;
  kill(parent);
  assert.equal(score, 40);
  generateWave(10);
  const state = game.saveState();
  game.reset();
  game.loadState(state);
  assert.equal(score, 40);
  assert.equal(backlog.length, 2);
  backlog.forEach(kill);
  assert.equal(score, 56);
  assert.ok(hopper.some(c => c.waveNumber === 7));
  const queued = hopper.find(c => c.waveNumber === 7);
  kill(queued);
  assert.equal(score, 56 + queued.constructor.value * 7);
  delete state.score;
  game.loadState(state);
  assert.equal(score, 0, 'Older saves default to zero');
});

test('map records survive restart, abandonment and storage reload; lower runs cannot replace them', () => {
  const saved = new Map();
  globalThis.localStorage = {getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value)};
  const [first, second] = mapCatalog;
  startGame(first.id);
  const guardian = new BigBall();
  globalThis.waveCounter = 7;
  kill(guardian);
  startGame(first.id);
  assert.equal(score, 0);
  kill(new Basic());
  assert.equal(highScoreForMap(first.id), 50);
  assert.equal(highScoreRecordForMap(first.id).level, 7);
  abandonGame();
  assert.equal(gameMode, titleScreen);
  const before = score;
  game.tick(100);
  assert.equal(score, before);
  startGame(second.id);
  kill(new Ball());
  assert.equal(highScoreForMap(second.id), 13);
  globalThis.highScores = Object.create(null);
  assert.equal(highScoreForMap(first.id), 50);
  assert.equal(highScoreForMap(second.id), 13);
  assert.deepEqual(highScoreRecordForMap(first.id), {score: 50, level: 7});
  assert.deepEqual(highScoreRecordForMap(second.id), {score: 13, level: 1});
});

test('legacy records have no level until beaten; ties preserve the existing record', () => {
  let saved = '10';
  const killFromFirstWave = () => {
    const creep = new Basic();
    creep.waveNumber = 1;
    kill(creep);
  };
  globalThis.localStorage = {getItem: () => saved, setItem: (_, value) => { saved = value; }};
  assert.deepEqual(highScoreRecordForMap(selectedMapId), {score: 10, level: null});
  globalThis.waveCounter = 4;
  killFromFirstWave();
  killFromFirstWave();
  assert.equal(saved, '10', 'Tying a legacy score does not invent its level');
  killFromFirstWave();
  assert.deepEqual(JSON.parse(saved), {score: 15, level: 4});
  game.reset();
  globalThis.waveCounter = 8;
  for (let i = 0; i < 3; i++) killFromFirstWave();
  assert.deepEqual(highScoreRecordForMap(selectedMapId), {score: 15, level: 4});
  killFromFirstWave();
  globalThis.highScores = Object.create(null);
  assert.deepEqual(highScoreRecordForMap(selectedMapId), {score: 20, level: 8});
});

test('missing or invalid saved levels leave valid scores readable', () => {
  for (const level of [undefined, null, 0, -1, 1.5, '7']) {
    globalThis.highScores = Object.create(null);
    globalThis.localStorage = {getItem: () => JSON.stringify({score: 123, level})};
    assert.deepEqual(highScoreRecordForMap(selectedMapId), {score: 123, level: null});
  }
});

test('unavailable or invalid local storage leaves scoring usable', () => {
  globalThis.localStorage = {getItem: () => 'NaN', setItem: () => { throw new Error('Storage disabled'); }};
  assert.equal(highScoreForMap(selectedMapId), 0);
  kill(new Basic());
  assert.equal(score, 5);
  assert.equal(highScoreForMap(selectedMapId), 5);
  globalThis.highScores = Object.create(null);
  globalThis.localStorage.getItem = () => { throw new Error('Storage disabled'); };
  kill(new Basic());
  assert.equal(highScoreForMap(selectedMapId), 10);
});
