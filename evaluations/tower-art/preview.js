// Run with browser-bridge; captures the real tower layers through the live glow.
const check = (condition, message) => { if (!condition) throw new Error(message); };
check(assetsPending.length === 0, 'Wait for all sprites to load');
const names = ['Incinerator', 'Ranger', 'Repeater', 'Mortar', 'Inferno', 'Firestorm',
  'Tesla', 'Prism', 'Railgun', 'Executioner', 'Cryo', 'Quake'];
for (const name of names) for (const suffix of ['Body', 'Turret']) {
  const sprite = Assets[name + suffix];
  check(sprite instanceof HTMLCanvasElement, name + suffix + ' missing');
  const data = sprite.getContext('2d').getImageData(0, 0, 128, 128).data;
  let opaque = 0;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const alpha = data[(y * 128 + x) * 4 + 3];
    if (alpha > 128) opaque++;
    if (x === 0 || y === 0 || x === 127 || y === 127) check(alpha === 0, name + suffix + ' clipped');
  }
  check(opaque > 80, name + suffix + ' empty');
}
const previous = {gameMode, paused, drawUI};
try {
  paused = true;
  drawUI = () => {
    interfaceCtx.save(); interfaceCtx.setTransform(1, 0, 0, 1, 0, 0);
    interfaceCtx.clearRect(0, 0, interfaceCanvas.width, interfaceCanvas.height);
    interfaceCtx.restore();
  };
  const gallery = () => {};
  gallery.draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#020405'; ctx.fillRect(0, 0, OutputWidth, OutputHeight);
    ctx.textAlign = 'center'; ctx.font = '20px sans-serif'; ctx.fillStyle = '#d6ecf1';
    ctx.fillText('TOWER BRIGHTNESS', 270, 38);
    ['Tower', 'Stubby', 'Zappy', ...names].forEach((name, i) => {
      const x = 90 + (i % 3) * 180, y = 112 + Math.floor(i / 3) * 166;
      const info = towerInfo.find(info => info.type.name === name);
      const tower = new info.type(3, 2);
      tower.angle = Math.PI / 8;
      ctx.save(); ctx.translate(x, y); ctx.scale(1.25, 1.25); tower.draw(); ctx.restore();
      ctx.fillStyle = '#c4d5da'; ctx.font = '16px sans-serif'; ctx.fillText(info.name, x, y + 72);
    });
  };
  gameMode = gallery;
  wslog('SHOT\ttower-overview\t' + await captureScreenshot());
  wslog({result:'PASS', towers:names.length, layers:24, transparent:true, unclipped:true});
} finally {
  gameMode = previous.gameMode; paused = previous.paused; drawUI = previous.drawUI;
  uiDrawSignature = '';
}
