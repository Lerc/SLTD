"use strict";

// One pointer owns each gesture, on both phones and desktop. Capture retains
// drags outside the canvas; cancellation never places a tower or clicks a menu.
function initInput() {
  const canvas = document.getElementById('main');
  let pointer = null;
  let held = {};
  let wentDown = {};
  window.usingTouch = false;
  window.Input = {
    isKeyDown: key => !!held[key],
    keyWentDown: key => !!wentDown[key],
    flushKeysDown: () => { wentDown = {}; }
  };
  document.addEventListener('keydown', event => { held[event.keyCode] = true; wentDown[event.keyCode] = true; });
  document.addEventListener('keyup', event => { held[event.keyCode] = false; });
  const position = event => screenToCanvas(v2(event.clientX, event.clientY));
  const cancel = () => { pointer = null; held[133] = false; cancelUIInput(); };
  canvas.addEventListener('pointerdown', event => {
    if (pointer !== null || event.button !== 0) return;
    event.preventDefault();
    pointer = event.pointerId;
    window.usingTouch = event.pointerType === 'touch';
    held[133] = true; wentDown[133] = true;
    if (event.isTrusted) canvas.setPointerCapture(pointer);
    const pos = position(event); setMousePos(pos); pressStart(pos);
  });
  canvas.addEventListener('pointermove', event => {
    if (pointer !== null && pointer !== event.pointerId) return;
    const pos = position(event); setMousePos(pos);
    if (pointer !== null) { event.preventDefault(); pressMove(pos); }
  });
  canvas.addEventListener('pointerup', event => {
    if (pointer !== event.pointerId) return;
    event.preventDefault();
    const pos = position(event); setMousePos(pos); pressEnd(pos);
    pointer = null; held[133] = false;
  });
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', () => { if (pointer !== null) cancel(); });
  window.addEventListener('blur', cancel);
}
