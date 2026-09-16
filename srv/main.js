"use strict"

window.onload = init;

let lastTime = performance.now();
let tickRemainder = 0;

function init() {
  window.outputCanvas = document.querySelector('#main');
  window.interfaceCanvas = document.querySelector('#interface');
  window.interfaceCtx = interfaceCanvas.getContext('2d');
  outputCanvas.width = OutputWidth;
  outputCanvas.height = OutputHeight;
  const resize = () => {
    const rect = document.getElementById('viewport').getBoundingClientRect();
    const scale = Math.min(rect.width / OutputWidth, rect.height / OutputHeight);
    const shell = document.getElementById('game-shell');
    shell.style.width = OutputWidth * scale + 'px';
    shell.style.height = OutputHeight * scale + 'px';
    const density = Math.min(window.devicePixelRatio || 1, 3);
    interfaceCanvas.width = Math.round(OutputWidth * scale * density);
    interfaceCanvas.height = Math.round(OutputHeight * scale * density);
  };
  new ResizeObserver(resize).observe(document.getElementById('viewport'));
  resize();
  bindUI();
  initInput();

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

}

function screenToCanvas({x,y}) {
  let canvas=outputCanvas;
  const rect = canvas.getBoundingClientRect();
  let v=v2((x-rect.left)/rect.width*canvas.width,(y-rect.top)/rect.height*canvas.height);
  return vscale(v,1/globalScaleFactor);
}

function update() {
  requestAnimationFrame(update);
  if (!running) return;

  let thisTime = performance.now();
  let diff = thisTime - lastTime;
  tickRemainder += Math.min(diff, 160) / (1000 / 60);
  let ticks = Math.floor(tickRemainder);
  tickRemainder -= ticks;
  lastTime = thisTime;

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
  drawUI(thisTime);

  // Must run in the same frame as glowFrame: the WebGL context has no
  // preserveDrawingBuffer, so the drawing buffer is cleared once the browser
  // composites. Reading it any later yields a blank image.
  if (pendingScreenshot) {
    let request = pendingScreenshot;
    pendingScreenshot = null;
    try {
      const capture = document.createElement('canvas');
      capture.width = interfaceCanvas.width;
      capture.height = interfaceCanvas.height;
      const captureCtx = capture.getContext('2d');
      captureCtx.drawImage(outputCanvas, 0, 0, capture.width, capture.height);
      captureCtx.drawImage(interfaceCanvas, 0, 0);
      request.resolve(capture.toDataURL('image/png'));
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
