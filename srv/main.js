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

  window.persistenceCanvas=document.createElement("canvas");
  persistenceCanvas.width=OutputWidth;
  persistenceCanvas.height=OutputHeight;
  var persistenceCtx= persistenceCanvas.getContext("2d");
  persistenceCanvas.ctx=persistenceCtx;
  window.persistenceCtx=persistenceCtx;

  initGlow(outputCanvas,frameCanvas);
  updateGlowSettings({threshold:0,blurLevel:2,exposure:0.7,bloom:1})

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

  // gameControl's `advance` queues ticks to be run here, so scripted stepping
  // is drawn like any other frame instead of racing ahead of the renderer.
  if (typeof gameControl !== 'undefined') ticks += gameControl.takeTickCredit(200);

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

  // Must run in the same frame as glowFrame: the WebGL context has no
  // preserveDrawingBuffer, so the drawing buffer is cleared once the browser
  // composites. Reading it any later yields a blank image.
  if (pendingScreenshot) {
    let request = pendingScreenshot;
    pendingScreenshot = null;
    try {
      request.resolve(outputCanvas.toDataURL("image/png"));
    } catch (e) {
      request.reject(e);
    }
  }
}

let pendingScreenshot = null;

// Capture the next completed frame (post-glow) as a PNG data URL.
function captureScreenshot() {
  return new Promise((resolve, reject) => {
    if (!running) {
      reject(new Error("game loop is not running; nothing to capture"));
      return;
    }
    if (pendingScreenshot) pendingScreenshot.reject(new Error("superseded by a newer capture request"));
    pendingScreenshot = {resolve, reject};
  });
}
