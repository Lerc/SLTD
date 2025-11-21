"use strict"
var versionString="0.91";
var globalScaleFactor = 0.5;
window.onload = init;
var showNote=true;
var note = "";
var ticker = 0;
var viewPosition=[400,300];
var gameMode=a=>a;

var waveCounter =1;
var difficulty =1;

var gameAcceleration=1;
var gameAccelerated=false;
//var OutputWidth=1080;
//var OutputHeight=1920;
var OutputWidth=540;
var OutputHeight=960;

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


function init() {
  document.querySelector("#goFullScreen").onclick=_=>toggleFullScreen();
  initInput();
  window.outputCanvas = document.querySelector("#main");
  outputCanvas.width=OutputWidth;
  outputCanvas.height=OutputHeight;
  
  window.frameCanvas=document.createElement("canvas");
  frameCanvas.width=OutputWidth;
  frameCanvas.height=OutputHeight;
  var frameCtx= frameCanvas.getContext("2d");
  frameCanvas.ctx=frameCtx;
  window.ctx=frameCtx;

  initGlow(outputCanvas,frameCanvas);

  requestAnimationFrame(update);
  
  outputCanvas.addEventListener("mousemove",mouseMoveHandler);
  outputCanvas.addEventListener("mousedown",mouseDownHandler);
  outputCanvas.addEventListener("mouseup",mouseUpHandler);
}


 /*
function screenToCanvas({x,y}) {
  let canvas=outputCanvas;
  let v=v2(x/canvas.clientWidth*canvas.width,y/canvas.clientHeight*canvas.height);
  return vscale(v,1/globalScaleFactor);
}
*/
function setMousePos(v) {
  canvasMouse  =v; 
  canvasMouseX=canvasMouse.x;
  canvasMouseY=canvasMouse.y;

  viewMouseX=canvasMouse.x;
  viewMouseY=canvasMouse.y-mapTop;

  mouseCell= worldToMap(v2(viewMouseX,viewMouseY))
  //note = " tile"+JSON.stringify(mouseCell);


}


function mouseMoveHandler(e) {
  let v = screenToCanvas(v2(e.pageX,e.pageY));
  setMousePos(v);
  if (e.button==0) pressMove(v);
}

function mouseUpHandler(e) {
  let v = screenToCanvas(v2(e.pageX,e.pageY));
  setMousePos(v);
  if (e.button==0) pressEnd(v);
}

function mouseDownHandler(e) {
  let v = screenToCanvas(v2(e.pageX,e.pageY));
  setMousePos(v);
  if (e.button==0) pressStart(v);
}


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


function pressStart(pos) {
  startPos=pos;

  endPos=pos;
  dragPos=pos;

  pressStartUI(pos);


}

function pressEnd(pos) {
  endPos=pos;
  if (draggingTower) {
    let towerHere = towers.find( ({cellPosition}) => vsame(cellPosition,mouseCell));
    if (!towerHere && levelMap.canBuildHere(mouseCell)) {
      buyTower(draggingTower,mouseCell.x,mouseCell.y)
    }
  }
  draggingTower = false;
  pressEndUI(pos);

}

function pressMove(pos) {
  dragPos=pos;

  if (draggingTower) {

  }

  pressMoveUI(pos);

}


var gameMode = waitForContent;


let lastTime = performance.now();

function update() {
  requestAnimationFrame(update);
  if (!running) return;

  let thisTime = performance.now();
  let diff = thisTime - lastTime;
  let ticks = Math.round(diff / 16);
  lastTime = thisTime;
  if (ticks > 10) ticks = 10;
  ticker += ticks;

  try {
    for (let i = 0; i < ticks; i++) {
      gameMode();
      Input.flushKeysDown();
    }

    if (gameMode.draw) gameMode.draw();
  } catch(e) {
    running=false;
    throw e;
  }


  glowFrame(frameCanvas);  
}

function waitForContent() {
  if (assetsPending.length == 0) {
    gameMode=waitForFullScreen;
  }
}

var wave =[
  [5,Basic],
  [3,Zipper],
  [3,Flyer],
  [6,Ball],
  [3,Spikey],
  [5,Basic],
  [1,BigBall]
];

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

function creepCount(waveNumber) {
  return Math.floor(min(100, 6 + Math.log(10+waveNumber*4)*Math.sqrt(waveNumber)));
}

function generateWave(num) {
  wave = [];
  let kinds = [Basic,Zipper,Ball,Basic,Flyer,Spikey,Basic,BigBall];
  
  let switchChance = [0.2,0.1,0.3,0.2,0.2,0.3,0.2,0.9];

  let rnd = makeRandom(num+42);

  let count = creepCount(num);

  console.log("wave "+num+" has "+count+" creeps");
  let kind = 0;
  let batch = [];

  for (let i = 0;i<count; i++) {
    let p = switchChance[kind];
    if (num > 1) {
      if (rnd()<p) {

        kind = (kind+1) % kinds.length;
      }
    }
    batch.push(kind); 
  }
  batch.sort();
  for (let i of batch) {
    hopper.push(new kinds[i]());
  }
}


var mapTop=106;
var angle = 0;

//var entities = [];
var creeps = [];
var towers = [];
var bullets = [];

var particleSystems =[];

var backlog = []; 
var hopper =[];
var waveAge =0;
var releaseRate =80;

function startGame() {
  //entities =[];
  money=250;
  towers=[];
  creeps=[];
  particleSystems =[];
  bullets=[];
  gameAcceleration=2;
  gameAccelerated=false;

  lives=20;
  waveCounter=1;
  difficulty=1;
  initUI();
  gameMode = mainGame;
  console.log("starting game")
  window.levelMap = createWorld(map1);

  /*
  for (let [count,type] of wave) { 
    for (let i=0;i<count;i++) {
      hopper.push(new type());    
    }
  }
*/
  generateWave(waveCounter);

  //towers.push(new Tower(5,5))
  
}

function nextWave( ) {
  waveCounter+=1;
  difficulty*=1.08;
  generateWave(waveCounter)
}

function mainGame() {
  let cycles = 1;
  if (gameAccelerated) cycles = gameAcceleration;

  for (let i=0; i<cycles;i++) {
    mainGame_core();
  }
}

function mainGame_core() {
  angle=(angle+0.1)%TWOPI;
  waveAge+=1;
  if ((waveAge % 15) == 0) {  
    //every 5 ticks fill from any backlog
    if (backlog.length>0) entities.push(backlog.shift())
  } 
  if ((creeps.length==0) || (waveAge % releaseRate  == 0)) {
    if (hopper.length>0) {
      let e = hopper.shift();
        creeps.push(e);
    }
  }

  if (creeps.length+hopper.length+backlog.length  == 0 ) {
    if (lives > 0 ) nextWave();
  }

  for (let e of creeps) {
    e.move();
  }
  creeps.sort( (a,b)=>(b.distanceTraveled()-a.distanceTraveled()) );

  for (let e of towers) {
    e.move();
  }
  for (let e of bullets) {
    e.move();
  }
  for (let p of particleSystems) {
    p.move();
  }

  creeps=creeps.filter(e=>!e.dead);
  towers=towers.filter(e=>!e.dead);
  bullets=bullets.filter(e=>!e.dead);
  
  particleSystems=particleSystems.filter(p=>p.isActive());

  if (gameMode != mainGame) return;

  if (lives<=0) {
    taps=0;
    draggingTower=false;
    gameMode = gameOver;
  }

  if (Input.keyWentDown(133))  {
    let clickedTower= towers.find( ({cellPosition}) => vsame(cellPosition,mouseCell))
   
    if (selectedTower === clickedTower) showTowerMenu(clickedTower);
    selectedTower = clickedTower;
  }

  updateUI();


}

mainGame.draw = function() {
  ctx.clear();
  ctx.fillStyle="#000";
  ctx.fillRect(0,0,OutputWidth,OutputHeight);
  ctx.setTransform(globalScaleFactor,0,0,   globalScaleFactor,0,0)

  drawWorld();
    

//  ctx.fillStyle="#78f"

//  ctx.fillRect(x,y,100,100);

//  ctx.fillStyle="#4f4"
//  ctx.fillRect(y,x,20,10);


  ctx.fillStyle="#0af";
  if (showNote) {
    ctx.font="32px sans-serif";
    ctx.fillText(note, 10, 200);
  }
  ctx.font="55px sans-serif";
  ctx.textAlign="right";

  ctx.fillText("Lives: "+lives,1060,70);

  ctx.textAlign="center";
  ctx.fillText("$"+money,540,70);

  ctx.textAlign="left";
  ctx.fillText("Wave "+waveCounter,20,70);
  
//  ctx.fillText("$"+money,20,70);

  //ctx.strokeStyle="#aaf";
  //ctx.strokeRect(0,0,1080,100);




  //ctx.strokeRect(0,1650,1080,250);


  drawUI();
  /*
  ctx.beginPath();
  ctx.strokeStyle="#aaf";
  {
    let {x,y} = startPos;
    ctx.moveTo(x,y);
  }
  {
    let {x,y} = endPos;
    ctx.lineTo(x,y);
  }
  ctx.stroke();
  */
}


function drawWorld() {
  ctx.save();
  ctx.translate(12,mapTop);
  let region = new Path2D();
  region.rect(0, 0, 1080,1536 );
  ctx.clip(region,);
  
  levelMap.draw();

  for (let e of creeps) {
    e.drawMain();
  }

  for (let e of towers) {
    e.drawMain();
  }

  if (selectedTower) {
    selectedTower.drawRange();
  }

  for (let e of bullets) {
    e.drawMain();
  }

  for (let p of particleSystems) {
    p.draw(ctx);
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

let taps = 0;

function waitForFullScreen() {
  if (document.fullscreenElement || taps > 2) 
  {
    gameMode=titleScreen;
  }
  if (Input.keyWentDown(133)) {
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


function titleScreen() {
  if (Input.keyWentDown(133)){
    startGame();
  }
}

titleScreen.draw = _=>{
  ctx.clear();
  ctx.fillStyle="#000";
  ctx.fillRect(0,0,OutputWidth,OutputHeight);
  ctx.setTransform(globalScaleFactor,0,0,   globalScaleFactor,0,0)


  
  ctx.fillStyle="#0af";

  ctx.font="64px sans-serif";
  ctx.textAlign="center";
  ctx.fillText("I Wanted a New Tower Defence",540,100);
  ctx.fillText("To Play On My Phone",540,200);
  
  ctx.fillText("So I Made One",540,400);

  ctx.fillText("Press Anywhere to Start",540,650);
 
  ctx.font="50px sans-serif";
  ctx.textAlign="left";
  
  ctx.drawSprite(Assets.TowerIcons, 150,1000,0);
  ctx.fillText("Low Damage, Medium Range",300,1000);
  

  ctx.drawSprite(Assets.TowerIcons, 150,1200,1);
  ctx.fillText("High Damage, Very Short Range",300,1200);

  
  ctx.drawSprite(Assets.TowerIcons, 150,1400,2);
  ctx.fillText("Rapid Fire, Low Damage ",300,1400);

  ctx.drawSprite(Assets.TowerIcons, 150,1600,3);
  ctx.fillText("Long Range, High Damage, Slow ",300,1600);

  ctx.drawSprite(Assets.TowerIcons, 150,1800,4);
  ctx.fillText("Area Damage Around Tower ",300,1800);

}

function gameOver() {
  mainGame();
  if (Input.keyWentDown(133)) {
    taps+=1;
  }

  if (taps > 2) {
    startGame();
  }
}

gameOver.draw = _=>{
  mainGame.draw();

  ctx.fillStyle="#0006";
  ctx.strokeStyle="#0af";
  ctx.fillRect(200,800,680,300);
  ctx.strokeRect(200,800,680,300);
  ctx.strokeRect(200-8,800-8,680+16,300+16);
  ctx.strokeStyle="#6ef";
  ctx.strokeRect(200-4,800-4,680+8,300+8);

  ctx.fillStyle="#0af";
  ctx.font="75px sans-serif";
  ctx.textAlign="center";
  ctx.fillText("Game Over",540,900);

  ctx.font="50px sans-serif";
  ctx.fillText("Tap "+(3-taps)+" Times to Play Again",540,1050);

}