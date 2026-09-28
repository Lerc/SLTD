const check = (condition, message) => { if (!condition) throw new Error(message); };
startGame('foundry'); paused = true; money = 10000;
const capture = () => {
  const image = document.createElement('canvas');
  image.width = frameCanvas.width; image.height = frameCanvas.height;
  image.getContext('2d').drawImage(outputCanvas, 0, 0);
  return image;
};
const pixels = image => image.getContext('2d').getImageData(0, 0, image.width, image.height).data;
const energy = image => {
  const data = pixels(image), sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) for (let channel = 0; channel < 3; channel++) sum[channel] += data[i + channel];
  return sum;
};
glowFrame(frameCanvas);
const before = pixels(capture());
uiTowerImages.clear();
uiTowerImage(towerInfo[0]);
const after = pixels(capture());
check(before.every((value, index) => value === after[index]), 'Generating icons restores the exact gameplay frame');
check(uiTowerImages.size === towerInfo.length, 'Every tower has a cached shader image');
const previous = ctx;
try {
  for (const info of towerInfo) {
    const picture = uiTowerImage(info), data = pixels(picture.image);
    check(data[3] === 0, info.name + ' has a transparent background');
    check(data.some((value, index) => index % 4 === 3 && value > 0 && value < 255), info.name + ' carries a translucent glow');
    const black = document.createElement('canvas'); black.width = picture.width; black.height = picture.height;
    const paint = black.getContext('2d'); paint.fillStyle = '#000'; paint.fillRect(0, 0, black.width, black.height);
    paint.drawImage(picture.image, 0, 0);
    const iconEnergy = energy(black);
    const raw = document.createElement('canvas'); raw.width = frameCanvas.width; raw.height = frameCanvas.height;
    ctx = raw.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, raw.width, raw.height);
    // Match the native pixel phase, then run the ordinary opaque gameplay path.
    ctx.translate(64, 64); ctx.scale(globalScaleFactor, globalScaleFactor);
    const tower = new info.type(0, 0); tower.angle = Math.PI / 6; tower.draw();
    glowFrame(raw);
    const gameEnergy = energy(capture());
    for (let channel = 0; channel < 3; channel++) {
      check(Math.abs(iconEnergy[channel] - gameEnergy[channel]) <= Math.max(100, gameEnergy[channel] * .03),
        info.name + ' matches gameplay shader brightness and color in channel ' + channel);
    }
  }
} finally { ctx = previous; glowFrame(frameCanvas); }
await gameControl.screenshot('tower-buttons-shader');
wslog({result:'PASS', shaderPortraits:uiTowerImages.size, preservesGameFrame:true, transparentGlow:true});
