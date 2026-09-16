"use strict"

// Game configuration
var versionString="1.0 — Branching defenses";
var globalScaleFactor = 0.5;
var showNote=true;
var note = "";
var ticker = 0;
var viewPosition=[400,300];
var gameMode=a=>a;

var waveCounter =1;
var difficulty =1;

var gameAcceleration=1;
var gameAccelerated=false;
var OutputWidth=540;
var OutputHeight=924;

var cellSize = 96;
var lives = 20;
var money = 0;

var canvasMouseX=0;
var canvasMouseY=0;

var viewMouseX=0;
var viewMouseY=0;
var mouseCell = v2(-1,-1);
var canvasMouse = v2(-1,-1);

var selectedTower = null;
var paused = false;
var betweenWaves = true;
var buildTicks = 900;
var selectedBuild = null;

var x=350;
var y=100;
var dx=5;
var dy=5;
var running=true;

var map1 = [
  '##.########',
  '##.########',
  '##.###....#',
  '##.....##.#',
  '#########.#',
  '#########.#',
  '#########.#',
  '#########.#',
  '#########.#',
  '###.......#',
  '###.#######',
  '###.#######',
  '###.....###',
  '#######.###',
  '#######.###',
  '#######.###',
]

var  startPos = v2(0,0);
var  endPos = v2(0,0);
var  dragPos = v2(0,0);
var draggingTower = null;

var mapTop=156;
var angle = 0;

var creeps = [];
var towers = [];
var bullets = [];

var particleSystems =[];

var backlog = [];
var hopper =[];
var waveAge =0;
var releaseRate =80;

var gameViewTransform = null;

var wave =[
  [5,Basic],
  [3,Zipper],
  [3,Flyer],
  [6,Ball],
  [3,Spikey],
  [5,Basic],
  [1,BigBall]
];

let taps = 0;

// Input handling (called from browser or headless)
function pressStart(pos) {
  startPos = pos;
  dragPos = pos;
  if (typeof pressStartUI === 'function') pressStartUI(pos);
}
function pressMove(pos) {
  dragPos = pos;
  if (typeof pressMoveUI === 'function') pressMoveUI(pos);
}
function pressEnd(pos) {
  if (typeof pressEndUI === 'function' && pressEndUI(pos)) return;
  if (gameMode !== mainGame) return;
  if (pos.y < mapTop || pos.y >= mapTop + 1536) return;
  setMousePos(pos);
  if (vdistance(startPos, pos) > 45) return;
  if (typeof sellConfirmTower !== 'undefined') sellConfirmTower = null;
  const tower = towers.find(t => vsame(t.cellPosition, mouseCell));
  if (tower) {
    selectedTower = globalThis.selectedTower = tower;
    selectedBuild = null;
  } else if (selectedBuild) {
    const built = buyTower(selectedBuild, mouseCell.x, mouseCell.y);
    if (typeof uiToast === 'function') uiToast(built ? selectedBuild.name + ' deployed' : 'Choose an empty tile and check your credits');
  } else selectedTower = globalThis.selectedTower = null;
  if (typeof updateUI === 'function') updateUI(true);
}

function setMousePos(v) {
  canvasMouse  =v;
  canvasMouseX=canvasMouse.x;
  canvasMouseY=canvasMouse.y;

  viewMouseX=canvasMouse.x - 12;
  viewMouseY=canvasMouse.y-mapTop;

  mouseCell= worldToMap(v2(viewMouseX,viewMouseY))
}

// Wave generation
function indexOfMax(arr) {
  if (arr.length === 0) {
      return -1;
  }

  var max = arr[0];
  var maxIndex = 0;

  for (var i = 1; i < arr.length; i++) {
      if (arr[i] > max) {
          maxIndex = i;
          max = arr[i];
      }
  }

  return maxIndex;
}

function creepCount(waveNumber) { return wavePlan(waveNumber).count; }
function generateWave(num) {
  const plan = wavePlan(num);
  difficulty = globalThis.difficulty = waveDifficulty(num);
  releaseRate = globalThis.releaseRate = plan.interval;
  waveAge = globalThis.waveAge = 0;
  for (const Kind of plan.kinds) globalThis.hopper.push(new Kind());
  hopper = globalThis.hopper;
}

// Game lifecycle
function startGame() {
  money = globalThis.money = 320;
  towers = globalThis.towers = [];
  creeps = globalThis.creeps = [];
  particleSystems = globalThis.particleSystems = [];
  bullets = globalThis.bullets = [];
  hopper = globalThis.hopper = [];
  backlog = globalThis.backlog = [];
  gameAcceleration = globalThis.gameAcceleration = 2;
  gameAccelerated = globalThis.gameAccelerated = false;

  lives = globalThis.lives = 20;
  waveCounter = globalThis.waveCounter = 1;
  difficulty = globalThis.difficulty = 1;
  ticker = globalThis.ticker = 0;
  waveAge = globalThis.waveAge = 0;
  selectedTower = globalThis.selectedTower = null;
  selectedBuild = globalThis.selectedBuild = null;
  paused = globalThis.paused = false;
  betweenWaves = globalThis.betweenWaves = true;
  buildTicks = globalThis.buildTicks = 900;
  gameViewTransform = null;
  if (typeof persistenceCtx !== 'undefined') persistenceCtx.clearRect(0, 0, OutputWidth, OutputHeight);
  if (typeof initUI !== 'undefined') initUI();
  gameMode = globalThis.gameMode = mainGame;
  console.log("starting game")

  // Create levelMap - will be available globally
  globalThis.levelMap = createWorld(map1);

  if (typeof updateUI === 'function') updateUI();
}

function nextWave() {
  money = globalThis.money = money + wavePlan(waveCounter).reward;
  if (typeof uiToast === 'function') uiToast('Wave cleared · +' + wavePlan(waveCounter).reward + ' credits');
  waveCounter = globalThis.waveCounter = waveCounter + 1;
  difficulty = globalThis.difficulty = waveDifficulty(waveCounter);
  betweenWaves = globalThis.betweenWaves = true;
  buildTicks = globalThis.buildTicks = 600;
}

// Game modes
function waitForContent() {
  if (typeof assetsPending !== 'undefined' && assetsPending.length == 0) {
    gameMode = globalThis.gameMode = titleScreen;
  }
}

// Set initial game mode for browser (will be overridden in headless)
gameMode = globalThis.gameMode = waitForContent;

function waitForFullScreen() {
  let fullscreenActive = false;
  if (typeof document !== 'undefined' && document.fullscreenElement) {
    fullscreenActive = true;
  }

  if (fullscreenActive || taps > 2) {
    gameMode = globalThis.gameMode = titleScreen;
  }

  if (typeof Input !== 'undefined' && Input.keyWentDown(133)) {
    taps+=1;
  }
}

waitForFullScreen.draw = _=> {
  ctx.clear();
  ctx.fillStyle="#000";
  ctx.fillRect(0,0,OutputWidth,OutputHeight);
  ctx.setTransform(globalScaleFactor,0,0,   globalScaleFactor,0,0)

  ctx.fillStyle="#0af";
  ctx.font="64px sans-serif";
  ctx.textAlign="center";
  ctx.fillText("Go Fullscreen To Continue",540,900);

  ctx.font="30px sans-serif";
  ctx.fillText("Or tap three times to continue anyway",540,1500);

  ctx.font="20px sans-serif";
  ctx.fillText(versionString,100,1800);
}

function titleScreen() {}

titleScreen.draw = () => {
  ctx.clear();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, OutputWidth, OutputHeight);
};

function mainGame() {
  if (typeof updateUI === 'function') updateUI();
  if (globalThis.paused) return;
  let cycles = 1;
  if (gameAccelerated) cycles = gameAcceleration;

  for (let i=0; i<cycles;i++) {
    mainGame_core();
    if (gameMode !== mainGame) break;
  }
}

function updatePersistenceCanvas() {
  if (typeof persistenceCtx === 'undefined') return;
  if (!gameViewTransform) return; // Wait until transform is set by draw phase

  // Apply fade effect to persistence canvas
  persistenceCtx.fillStyle = "rgba(0,0,0,0.3)";
  persistenceCtx.fillRect(0, 0, persistenceCanvas.width, persistenceCanvas.height);

  // Save current context and use stored game view transform
  let savedCtx = ctx;

  // Switch to persistence canvas and apply the stored transform
  ctx = persistenceCtx;
  ctx.save();
  ctx.setTransform(gameViewTransform);
  let region = new Path2D();
  region.rect(0, 0, 1080, 1536);
  ctx.clip(region);

  // Draw bullets and particles to persistence canvas
  for (let e of bullets) {
    e.drawMain();
  }

  for (let p of particleSystems) {
    p.draw(ctx);
  }

  ctx.restore();

  // Switch back to frame context
  ctx = savedCtx;
}

function mainGame_core() {
  if (gameMode !== mainGame) return;
  if (globalThis.betweenWaves) {
    globalThis.buildTicks--;
    if (globalThis.buildTicks <= 0) sendWave();
    updatePersistenceCanvas();
    for (const p of particleSystems) p.move();
    particleSystems = globalThis.particleSystems = particleSystems.filter(p => p.isActive());
    return;
  }
  angle=(angle+0.1)%TWOPI;
  globalThis.waveAge += 1;
  waveAge = globalThis.waveAge;
  if ((globalThis.waveAge % 15) == 0) {
    //every 5 ticks fill from any backlog
    if (globalThis.backlog.length>0) {
      globalThis.creeps.push(globalThis.backlog.shift());
      backlog = globalThis.backlog;
      creeps = globalThis.creeps;
    }
  }
  if ((globalThis.creeps.length==0) || (globalThis.waveAge % releaseRate  == 0)) {
    if (globalThis.hopper.length>0) {
      let e = globalThis.hopper.shift();
      hopper = globalThis.hopper;
      globalThis.creeps.push(e);
      creeps = globalThis.creeps;
    }
  }

  if (creeps.length+globalThis.hopper.length+backlog.length  == 0 ) {
    if (lives > 0) { nextWave(); return; }
  }

  for (let e of globalThis.creeps) {
    e.move();
  }
  globalThis.creeps.sort( (a,b)=>(b.distanceTraveled()-a.distanceTraveled()) );
  creeps = globalThis.creeps;

  for (let e of globalThis.towers) {
    e.move();
  }
  for (let e of globalThis.bullets) {
    e.move();
  }
  for (let p of globalThis.particleSystems) {
    p.move();
  }

  creeps = globalThis.creeps = globalThis.creeps.filter(e=>!e.dead);
  towers = globalThis.towers = globalThis.towers.filter(e=>!e.dead);
  bullets = globalThis.bullets = globalThis.bullets.filter(e=>!e.dead);

  particleSystems = globalThis.particleSystems = globalThis.particleSystems.filter(p=>p.isActive());

  if (gameMode != mainGame) return;

  if (lives<=0) {
    taps=0;
    draggingTower=false;
    gameMode = globalThis.gameMode = gameOver;
  }

  // Update persistence canvas every tick for consistent visuals
  updatePersistenceCanvas();
}

mainGame.draw = function() {
  ctx.clear();
  ctx.fillStyle="#000";
  ctx.fillRect(0,0,OutputWidth,OutputHeight);
  ctx.setTransform(globalScaleFactor,0,0,   globalScaleFactor,0,0)

  drawWorld();


}

function drawWorld() {
  ctx.save();
  ctx.translate(12,mapTop);
  let region = new Path2D();
  region.rect(0, 0, 1080,1536 );
  ctx.clip(region,);

  // Store the game view transform for persistence canvas
  gameViewTransform = ctx.getTransform();

  levelMap.draw();

  for (let e of creeps) {
    e.drawMain();
  }

  for (let e of towers) {
    e.drawMain();
  }

  if (selectedTower) selectedTower.drawRange();
  if (selectedBuild && levelMap.canBuildHere(mouseCell)) {
    const p = mapToWorld(mouseCell);
    ctx.strokeStyle = '#184050'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, selectedBuild.maxRange, 0, TWOPI); ctx.stroke();
    ctx.fillStyle = '#082028'; ctx.fillRect(p.x - 42, p.y - 42, 84, 84);
  }

  // Composite persistence canvas onto frame canvas (updated per tick in mainGame_core)
  if (typeof persistenceCtx !== 'undefined') {
    // Temporarily reset transform to draw at correct position
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(persistenceCanvas, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  } else {
    // Fallback for headless mode - draw bullets and particles directly
    for (let e of bullets) {
      e.drawMain();
    }

    for (let p of particleSystems) {
      p.draw(ctx);
    }
  }

  for (let e of creeps) {
    e.drawHealthBar();
  }

  if (draggingTower) {
    let towerHere = towers.find( ({cellPosition}) => vsame(cellPosition,mouseCell));

    if ( levelMap.canBuildHere(mouseCell)  && (draggingTower.cost <= money)  &&  !towerHere) {
      ctx.fillStyle="#fff2";
      ctx.lineWidth=5;
      ctx.strokeStyle="#fff7";
    } else {
      ctx.fillStyle="#f001";
      ctx.lineWidth=5;
      ctx.strokeStyle="#f002";
    }
    let {x,y} = mapToWorld(mouseCell);

    let {maxRange,minRange}=draggingTower;
    ctx.circle(x,y,maxRange);

    ctx.moveTo(x+minRange,y);
    ctx.ellipse(x, y, minRange, minRange, 0, 0, Math.PI * 2,true);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function gameOver() { if (typeof updateUI === 'function') updateUI(); }
gameOver.draw = mainGame.draw;

// Export to global environment (works in both browser and Node.js)
if (typeof module !== 'undefined' && module.exports) {
  // State variables
  globalThis.versionString = versionString;
  globalThis.globalScaleFactor = globalScaleFactor;
  globalThis.showNote = showNote;
  globalThis.note = note;
  globalThis.ticker = ticker;
  globalThis.viewPosition = viewPosition;
  globalThis.gameMode = gameMode;
  globalThis.waveCounter = waveCounter;
  globalThis.difficulty = difficulty;
  globalThis.gameAcceleration = gameAcceleration;
  globalThis.gameAccelerated = gameAccelerated;
  globalThis.OutputWidth = OutputWidth;
  globalThis.OutputHeight = OutputHeight;
  globalThis.cellSize = cellSize;
  globalThis.lives = lives;
  globalThis.money = money;
  globalThis.canvasMouseX = canvasMouseX;
  globalThis.canvasMouseY = canvasMouseY;
  globalThis.viewMouseX = viewMouseX;
  globalThis.viewMouseY = viewMouseY;
  globalThis.mouseCell = mouseCell;
  globalThis.canvasMouse = canvasMouse;
  globalThis.selectedTower = selectedTower;
  globalThis.x = x;
  globalThis.y = y;
  globalThis.dx = dx;
  globalThis.dy = dy;
  globalThis.running = running;
  globalThis.map1 = map1;
  globalThis.startPos = startPos;
  globalThis.endPos = endPos;
  globalThis.dragPos = dragPos;
  globalThis.draggingTower = draggingTower;
  globalThis.mapTop = mapTop;
  globalThis.angle = angle;
  globalThis.creeps = creeps;
  globalThis.towers = towers;
  globalThis.bullets = bullets;
  globalThis.particleSystems = particleSystems;
  globalThis.backlog = backlog;
  globalThis.hopper = hopper;
  globalThis.waveAge = waveAge;
  globalThis.releaseRate = releaseRate;
  globalThis.wave = wave;
  globalThis.taps = taps;
  globalThis.gameViewTransform = gameViewTransform;

  // Functions
  globalThis.pressStart = pressStart;
  globalThis.pressEnd = pressEnd;
  globalThis.pressMove = pressMove;
  globalThis.setMousePos = setMousePos;
  globalThis.indexOfMax = indexOfMax;
  globalThis.creepCount = creepCount;
  globalThis.generateWave = generateWave;
  globalThis.startGame = startGame;
  globalThis.nextWave = nextWave;
  globalThis.waitForContent = waitForContent;
  globalThis.waitForFullScreen = waitForFullScreen;
  globalThis.titleScreen = titleScreen;
  globalThis.mainGame = mainGame;
  globalThis.mainGame_core = mainGame_core;
  globalThis.updatePersistenceCanvas = updatePersistenceCanvas;
  globalThis.drawWorld = drawWorld;
  globalThis.gameOver = gameOver;
}
