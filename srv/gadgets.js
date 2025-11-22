"use strict";


function makeContainer( ) {
  var contents = [];
  
  function update ( ) {
    for (let e of contents) {
      e.update();
    }
  }

  function draw() {
    for (let e of contents) {
      e.draw();
    }
  }

  function pressStart(p) {
    for (let e of contents) {
      e.pressStart(p);
    }

  }
  function pressMove(p) {
    for (let e of contents) {
      e.pressMove(p);
    }

  }

  function pressEnd(p) {
    for (let e of contents) {
      e.pressEnd(p)
    }

  }
  
  contents.update = update;
  contents.draw = draw;
  contents.pressStart = pressStart;
  contents.pressMove = pressMove;
  contents.pressEnd = pressEnd;
  
  return contents;
}

function makePanel (left,top,width,height) {
  let contents = makeContainer();

  function update() {
    contents.update();
  }

  function draw() {
    ctx.save()
    ctx.translate(left,top)
    contents.draw()
    ctx.restore(); 
    //ctx.strokeStyle="#aaf";
    //ctx.strokeRect(left,top,width,height);
  }


  function pressStart(p) {
    contents.pressStart(vdiff(p,v2(left,top)));
  }

  function pressMove(p) {
    contents.pressMove(vdiff(p,v2(left,top)));
  }

  function pressEnd(p) {
    contents.pressEnd(vdiff(p,v2(left,top)));

  }
  
  return {contents,update,draw,pressStart,pressMove,pressEnd}
}

function makeButton (left,top,width,height) {


  function draw() {
    ctx.fillStyle="#3342";
    ctx.fillRect(left,top,width,height)    
  }

  function update() {

  }

  function touched() {

  }

  function pressStart(p) {
    if (surrounds(p)) {
      this.touched();
    }

  }

  function pressMove(p) {
  }

  function pressEnd(p) {

  }

  function surrounds(p) {
    //console.log({x,y,left,top,width,height})
    return ((p.x>left) && (p.y>top) && (p.x-left < width)  && (p.y-top) < height) 
  }

  function getBounds() {
    return {left,top,width,height};
  }

  return {draw,update,surrounds,pressStart,pressMove,pressEnd,touched,getBounds }
}

var towerInfo= [
  {cost: 100, type: Tower, minRange : 0, maxRange: 250},
  {cost: 300, type: Stubby, minRange : 0, maxRange: 180},
  {cost: 350, type: Zappy, minRange : 0, maxRange: 350},
  {cost: 1000, type: Star, minRange : 250, maxRange: 600},
  {cost: 500, type: Thumper, minRange : 0, maxRange: 150},
  
]
function makeTowerButton(centerX,centerY,type) {
  let width = 180;
  let height = 200;
  let button = makeButton(centerX-width/2,centerY-height/2,width,height);


  function draw( ) {    
    button.draw();
    ctx.drawSprite(Assets.TowerIcons,centerX,centerY-30,type);

    let info = towerInfo[type];

    ctx.fillStyle = money>=info.cost?"#444":"#322";
    ctx.textAlign= "center";
    ctx.fillText(info.cost,centerX,centerY+90);
  }

  function touched() {
    draggingTower=towerInfo[type];
  }

  return {...button,draw,touched}

}

// Export to global environment (works in both browser and Node.js)
if (typeof module !== 'undefined' && module.exports) {
  globalThis.makeContainer = makeContainer;
  globalThis.makePanel = makePanel;
  globalThis.makeButton = makeButton;
  globalThis.towerInfo = towerInfo;
  globalThis.makeTowerButton = makeTowerButton;
}