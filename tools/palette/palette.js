"use strict"

// Glow colour-space probe.
//
// The bloom shader is strongly non-linear: with the game's live settings
// (threshold 0, bloom 1, blurLevel 2, exposure 0.7) *everything* contributes
// to bloom, the result is ACES tone-mapped and then gamma-corrected. So the
// RGB you ask for in ctx.fillStyle is not the RGB you get on screen, and the
// error depends on the shape you drew it in -- a thin line picks up far less
// bloom from its neighbours than a solid block of the same colour.
//
// These charts draw known swatches, capture the post-glow frame, and sample
// the result so we can build an input -> output mapping. Labels are added
// afterwards, over the captured PNG, so no label text pollutes the bloom.
//
// Usage (browser, over browser-bridge):
//   await palette.render('ramp'); await palette.capture('ramp');

;(function () {

  const W = OutputWidth;    // 540
  const H = OutputHeight;   // 960

  // Swatch colours, as [name, r, g, b] at full intensity. Kept to hues the
  // game actually uses (cyan UI, green grid, red/orange health) plus the
  // primaries needed to see per-channel behaviour.
  const HUES = [
    ['white',   255, 255, 255],
    ['red',     255,   0,   0],
    ['green',     0, 255,   0],
    ['blue',      0,   0, 255],
    ['cyan',      0, 255, 255],
    ['magenta', 255,   0, 255],
    ['yellow',  255, 255,   0],
    ['orange',  255, 128,   0]
  ];

  // Brightness levels applied as a multiplier on each hue.
  const LEVELS = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];

  // Line widths probed, in frame-canvas pixels.
  const WIDTHS = [1, 2, 3, 4, 6, 8, 12, 16];

  const scale = (c, k) => c.map(v => Math.round(v * k));
  const css = ([r, g, b]) => `rgb(${r},${g},${b})`;

  // Every chart records what it drew and where, so labels and samples can be
  // attached to exact pixel positions afterwards.
  let regions = [];

  function begin() {
    regions = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
  }

  function mark(label, x, y, w, h, meta) {
    regions.push({ label, x, y, w, h, ...meta });
  }

  // --- charts --------------------------------------------------------------

  // Solid blocks: hue x brightness. Establishes the base transfer curve for
  // large areas, where bloom contribution is saturated.
  function blocks() {
    begin();
    const cols = LEVELS.length, rows = HUES.length;
    const cw = 56, ch = 84, ox = 60, oy = 70;
    for (let r = 0; r < rows; r++) {
      const [name, ...rgb] = HUES[r];
      for (let c = 0; c < cols; c++) {
        const k = LEVELS[c];
        const col = scale(rgb, k);
        const x = ox + c * cw, y = oy + r * ch;
        ctx.fillStyle = css(col);
        ctx.fillRect(x, y, cw - 8, ch - 12);
        mark(`${name} ${Math.round(k * 100)}%`, x, y, cw - 8, ch - 12,
             { hue: name, level: k, input: col, kind: 'block' });
      }
    }
    return { title: 'Solid blocks - hue x brightness', rows, cols };
  }

  // Lines: width x brightness, one hue per chart. A thin bright line and a
  // thick dim line can land on the same output value; this is where that
  // trade-off becomes visible.
  function lines(hueName) {
    begin();
    const hue = HUES.find(h => h[0] === hueName) || HUES[0];
    const [name, ...rgb] = hue;
    const ox = 70, oy = 60, rowH = 108, colW = 58;
    for (let r = 0; r < WIDTHS.length; r++) {
      const lw = WIDTHS[r];
      for (let c = 0; c < LEVELS.length; c++) {
        const k = LEVELS[c];
        const col = scale(rgb, k);
        const x = ox + c * colW, y = oy + r * rowH;
        ctx.strokeStyle = css(col);
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + rowH - 34);
        ctx.stroke();
        mark(`w${lw} ${Math.round(k * 100)}%`, x, y, lw, rowH - 34,
             { hue: name, level: k, width: lw, input: col, kind: 'line' });
      }
    }
    return { title: `Lines - ${name}: width x brightness`, rows: WIDTHS.length, cols: LEVELS.length };
  }

  // Feature size test: the same input colour drawn as squares of increasing
  // size. Bloom is gathered from neighbouring pixels, so a small feature never
  // reaches the brightness its colour implies -- this is why a 1px line at
  // full white lands dimmer than a solid block at input 24. Sizes are probed
  // at the centre, where a large block is already bloom-saturated.
  function context() {
    begin();
    const SIZES = [1, 2, 3, 4, 6, 8, 12, 20, 32];
    const LV = [0.25, 0.5, 1.0];
    const ox = 70, oy = 90, rowH = 76, colW = 52;
    for (let r = 0; r < LV.length; r++) {
      const k = LV[r];
      const col = scale(HUES[0].slice(1), k);
      ctx.fillStyle = css(col);
      for (let c = 0; c < SIZES.length; c++) {
        const sz = SIZES[c];
        // Centre each square in its cell so samples never straddle a neighbour.
        const x = ox + c * colW + Math.floor((colW - sz) / 2);
        const y = oy + r * rowH * 2 + Math.floor((rowH - sz) / 2);
        ctx.fillRect(x, y, sz, sz);
        mark(`${sz}px sq ${Math.round(k * 100)}%`, x, y, sz, sz,
             { level: k, size: sz, input: col, kind: 'size' });
      }
    }
    return { title: 'Feature size vs brightness', rows: LV.length, cols: SIZES.length };
  }

  // Fine greyscale ramp: the transfer curve at high resolution, as both a
  // wide bar (saturated bloom) and a 1px line (minimal bloom).
  function ramp() {
    begin();
    const steps = 32;
    const bw = Math.floor((W - 80) / steps);
    for (let i = 0; i < steps; i++) {
      const k = (i + 1) / steps;
      const v = Math.round(255 * k);
      const x = 40 + i * bw;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, 120, bw - 1, 200);        // thick bar
      mark(`bar ${v}`, x, 120, bw - 1, 200, { level: k, input: [v, v, v], kind: 'bar' });

      ctx.fillRect(x + Math.floor(bw / 2), 420, 1, 200);  // 1px line
      mark(`line ${v}`, x + Math.floor(bw / 2), 420, 1, 200,
           { level: k, input: [v, v, v], kind: 'thinline' });
    }
    return { title: 'Greyscale ramp - 32 steps, thick bar vs 1px line', rows: 2, cols: steps };
  }

  const CHARTS = { blocks, lines, context, ramp };

  // --- driving -------------------------------------------------------------

  // Take over the render loop: gameMode.draw runs every frame, so parking a
  // no-op draw here keeps our pattern on the frame canvas untouched.
  let active = null;

  function paletteMode() {}
  paletteMode.draw = function () {
    if (active) active();
  };

  async function render(chart, arg) {
    const fn = CHARTS[chart];
    if (!fn) throw new Error(`unknown chart: ${chart}`);
    let info;
    // Redraw every frame so the pattern survives; cheap enough at this size.
    active = () => { info = fn(arg); };
    gameMode = globalThis.gameMode = paletteMode;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { chart, arg, info, regions: regions.slice() };
  }

  // Capture the post-glow frame and read back the actual output colour at the
  // centre of each marked region.
  async function capture(name) {
    const dataURL = await captureScreenshot();
    return { name, dataURL, regions: regions.slice() };
  }

  // Sample output pixels by re-reading the composited canvas. Must run in the
  // same frame as the capture, so it is done from the returned data URL
  // instead -- see sampleFromImage below.
  async function sampleFromImage(dataURL, regs) {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataURL; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const cx2 = c.getContext('2d');
    cx2.drawImage(img, 0, 0);
    // The capture is the output canvas (same pixel size as the frame canvas).
    return regs.map(r => {
      const px = Math.round(r.x + r.w / 2);
      const py = Math.round(r.y + r.h / 2);
      const d = cx2.getImageData(px, py, 1, 1).data;
      return { ...r, output: [d[0], d[1], d[2]] };
    });
  }

  globalThis.palette = {
    render, capture, sampleFromImage,
    charts: Object.keys(CHARTS),
    hues: HUES.map(h => h[0]),
    levels: LEVELS,
    widths: WIDTHS,
    settings: () => ({ threshold: 0, bloom: 1, blurLevel: 2, exposure: 0.7 })
  };
})();
