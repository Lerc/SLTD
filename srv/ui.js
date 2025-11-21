"use strict"

var widgets = [];

function initUI() {
  widgets = [];

  let panel = makePanel(0,1650,1080,250);
  widgets.push(panel);

  for (let i =0; i<5; i++) {
    let t = makeTowerButton(125+210*i,125,i);
      panel.contents.push(t)
  }

  let gameSpeedButton = makeButton(670,20,60,60);
  let accelerateButton = makeButton(755,20,60,60);
  widgets.push(gameSpeedButton);
  widgets.push(accelerateButton);

  gameSpeedButton.touched = function() {
    gameAcceleration*=2;
    if (gameAcceleration >16) gameAcceleration=2;
  }
  accelerateButton.touched = function() {
    gameAccelerated=!gameAccelerated;
  }

  gameSpeedButton.draw = function() {
    ctx.save();
    let {top,left,width,height} = gameSpeedButton.getBounds();
    ctx.strokeStyle="#0af";
    ctx.lineWidth=4;
    ctx.strokeRect(left,top,width,height);
    ctx.font="bold 40px sans-serif";
    ctx.textAlign="center";
    ctx.fillStyle="#0af";
    ctx.fillText(gameAcceleration+"x",left+width/2,top+42);
    ctx.restore();
  }

  accelerateButton.draw = function() {
    ctx.save();
    let {top,left,width,height} = accelerateButton.getBounds();
    let color = gameAccelerated ? "#6ef" : "#0af"
    ctx.strokeStyle=color;
    ctx.lineWidth=4;
    ctx.strokeRect(left,top,width,height);
    ctx.fillStyle=color;
    ctx.translate(left,top+2);
    ctx.fill(new Path2D("M16 28 L10 54 L34 28 L10 2 M54 28 L26 54 L34 28 L26 2"));
    //ctx.font="bold 20px sans-serif";
    //ctx.textAlign="center";
    //ctx.fillText("➤➤",left+width/2,top+42);
    ctx.restore();
  }
}


function updateUI() {
  for (let w of widgets ) {
    w.update();
  }
}

function drawUI() {
  for (let w of widgets ) {
    w.draw();
  }

}

function pressStartUI(pos) {
  for (let w of widgets ) {
    w.pressStart(pos);
  }

}

function pressMoveUI(pos) {
  for (let w of widgets ) {
    w.pressMove(pos);
  }
}

function pressEndUI(pos) {
  for (let w of widgets ) {
    w.pressEnd(pos);
  }

}


function showTowerMenu() {

  let panel = makePanel(250,1650,580,900);

  
}