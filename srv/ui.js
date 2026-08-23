"use strict"

var widgets = [];
var towerSelectionPanel = null;
var towerSelectionPanelCurrentY = 1900;  // Start off-screen
var towerSelectionPanelTargetY = 1900;   // Target position
var towerSelectionPanelVisibleY = 1650;  // Where it appears (same as purchase panel)
var towerSelectionPanelHiddenY = 1900;   // Where it hides (off-screen)

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

  // Create tower selection panel (initially hidden off-screen)
  towerSelectionPanel = createTowerSelectionPanel();
  widgets.push(towerSelectionPanel);
}


function updateUI() {
  // Animate tower selection panel sliding
  let easingFactor = 0.3;
  towerSelectionPanelCurrentY += (towerSelectionPanelTargetY - towerSelectionPanelCurrentY) * easingFactor;

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

function createTowerSelectionPanel() {
  // Create a panel that will slide up/down based on towerSelectionPanelCurrentY
  let panel = {
    contents: makeContainer(),
    update: function() {
      this.contents.update();
    },
    draw: function() {
      ctx.save();
      ctx.translate(0, towerSelectionPanelCurrentY);

      // Opaque background. The alpha this used to carry ("#222e") let the
      // purchase bar underneath leak through at ~7%, which the glow then
      // amplified: measured, the leak composited to input ~49 and rendered at
      // screen 237 -- as bright as fully lit content. Small leaks are not
      // subtle under this shader, so the panel must fully cover what it hides.
      //
      // Values below are chosen from the measured transfer curve in
      // tools/palette/README.md rather than by eye. Input 16 lands at screen
      // ~75: a distinct dark surface, well clear of the ~200+ of lit content.
      ctx.fillStyle = "#101010";
      ctx.fillRect(0, 0, 1080, 250);
      // Border at input 40/56 -> screen ~176/200, bright enough to define the
      // edge without blooming into a halo over the playfield.
      ctx.strokeStyle = "#283038";
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, 1080, 250);

      this.contents.draw();
      ctx.restore();
    },
    pressStart: function(p) {
      this.contents.pressStart(vdiff(p, v2(0, towerSelectionPanelCurrentY)));
    },
    pressMove: function(p) {
      this.contents.pressMove(vdiff(p, v2(0, towerSelectionPanelCurrentY)));
    },
    pressEnd: function(p) {
      this.contents.pressEnd(vdiff(p, v2(0, towerSelectionPanelCurrentY)));
    }
  };

  // Create Sell button
  let sellButton = makeButton(150, 65, 250, 120);
  sellButton.draw = function() {
    // #d44 (221,68,68) sat both the red and the off-channels: red pinned at
    // 238 while 68 bloomed up too, washing the fill toward pink. Keeping the
    // brightest channel low preserves the hue -- see tools/palette/README.md.
    ctx.fillStyle = "#280808";
    ctx.fillRect(150, 65, 250, 120);
    ctx.strokeStyle = "#801818";
    ctx.lineWidth = 3;
    ctx.strokeRect(150, 65, 250, 120);
    // Label at input 40 -> screen ~176: legible without bleeding into the fill.
    ctx.fillStyle = "#282828";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Sell", 275, 125);
  };
  sellButton.touched = function() {
    console.log("Sell button clicked");
    // TODO: Implement sell functionality
  };

  // Create Upgrade button
  let upgradeButton = makeButton(450, 65, 250, 120);
  upgradeButton.draw = function() {
    ctx.fillStyle = "#082808";
    ctx.fillRect(450, 65, 250, 120);
    ctx.strokeStyle = "#188018";
    ctx.lineWidth = 3;
    ctx.strokeRect(450, 65, 250, 120);
    ctx.fillStyle = "#282828";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Upgrade", 575, 125);
  };
  upgradeButton.touched = function() {
    console.log("Upgrade button clicked");
    // TODO: Implement upgrade functionality
  };

  // Create Close (X) button
  let closeButton = makeButton(950, 30, 100, 100);
  closeButton.draw = function() {
    // A 6px stroke is past the ~2px cliff and saturates like a fill, so this
    // needs the same low input a block would.
    ctx.strokeStyle = "#902020";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(970, 50);
    ctx.lineTo(1030, 110);
    ctx.moveTo(1030, 50);
    ctx.lineTo(970, 110);
    ctx.stroke();
  };
  closeButton.touched = function() {
    console.log("Close button clicked");
    hideTowerSelectionPanel();
  };

  panel.contents.push(sellButton);
  panel.contents.push(upgradeButton);
  panel.contents.push(closeButton);

  return panel;
}

function showTowerSelectionPanel() {
  towerSelectionPanelTargetY = towerSelectionPanelVisibleY;
}

function hideTowerSelectionPanel() {
  towerSelectionPanelTargetY = towerSelectionPanelHiddenY;
}

function showTowerMenu() {

  let panel = makePanel(250,1650,580,900);


}