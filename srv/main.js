"use strict"

window.onload = init;

let lastTime = performance.now();

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

function screenToCanvas({x,y}) {
  let canvas=outputCanvas;
  let v=v2(x/canvas.clientWidth*canvas.width,y/canvas.clientHeight*canvas.height);
  return vscale(v,1/globalScaleFactor);
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
