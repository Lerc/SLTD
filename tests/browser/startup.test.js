// Run on a freshly reloaded page, before any resize or game interaction.
for (let i = 0; i < 3; i++) await new Promise(resolve => requestAnimationFrame(resolve));
const pixels = interfaceCtx.getImageData(0, 0, interfaceCanvas.width, interfaceCanvas.height).data;
if (!pixels.some((value, i) => i % 4 === 3 && value > 0)) {
  throw new Error('Initial canvas UI is blank before any resize');
}
if (!running || interfaceCanvas.getBoundingClientRect().height <= 0) throw new Error('Initial viewport is not ready');
wslog({result:'PASS', initialUI:'visible without resize', viewport:[innerWidth, innerHeight]});
