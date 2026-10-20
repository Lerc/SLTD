// Builds the launcher icon PNGs and the 512 px F-Droid store icon from the
// game's own rendering of the Incinerator.
// Usage, from the repository root: node android/tools/make-icon.mjs
// Needs Chrome (set CHROME to override the binary) and the root dev dependencies.
//
// The tower is drawn exactly as the Tactical Archive draws its portraits:
// guideRenderPortrait() renders the specimen through the live glow shader at
// gameplay pixel scale, keeping alpha so the halo survives on the icon plate.
// The store icon needs about twice that scale, so it is drawn at 2x with one
// more blur level, which doubles the bloom radius to keep the same look.
import sharp from 'sharp';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdirSync, mkdtempSync, readFile, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srv = join(here, '../../srv');
const res = join(here, '../app/src/main/res');
const listing = join(here, '../../fastlane/metadata/android/en-US/images');
const heading = '-Math.PI/3'; // 0 faces up, clockwise positive: 10 o'clock
const background = '#091116';

const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json'};
const server = createServer((request, response) => {
  let path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  readFile(join(srv, path), (error, data) => {
    if (error) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, {'Content-Type': types[extname(path)] || 'application/octet-stream'});
    response.end(data);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const profile = mkdtempSync(join(tmpdir(), 'sltd-icon-'));
const chrome = spawn(process.env.CHROME || 'google-chrome', ['--headless=new', '--remote-debugging-port=0',
  '--user-data-dir=' + profile, '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=540,924', '--no-first-run', 'about:blank'], {stdio: ['ignore', 'ignore', 'pipe']});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let portrait, large;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let log = '';
    chrome.stderr.on('data', chunk => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\S+)/);
      if (match) resolve(match[1]);
    });
    chrome.on('exit', () => reject(Error('Chrome exited:\n' + log)));
  });
  const port = new URL(endpoint).port;
  const target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.onopen = resolve);
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  };
  const send = (method, params = {}) => new Promise(resolve => {
    pending.set(++id, resolve);
    socket.send(JSON.stringify({id, method, params}));
  });
  const evaluate = async expression => {
    const {result} = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };

  await send('Page.navigate', {url: `http://127.0.0.1:${server.address().port}/`});
  const ready = "typeof assetsPending !== 'undefined' && !assetsPending.length && !!Assets.IncineratorTurret";
  for (let i = 0; !await evaluate(ready).catch(() => false); i++) {
    if (i > 150) throw Error('The game did not finish loading: ' + await evaluate(
      "JSON.stringify({url: location.href, state: document.readyState, pending: typeof assetsPending === 'object' && assetsPending})"));
    await sleep(200);
  }
  const data = await evaluate(`(() => {
    const preview = guideSpecimen(towerInfo.find(t => t.type === Incinerator));
    preview.angle = ${heading};
    const picture = document.createElement('canvas');
    picture.width = picture.height = 320;
    guideRenderPortrait(preview, picture);
    return picture.toDataURL('image/png');
  })()`);
  portrait = Buffer.from(data.split(',')[1], 'base64');
  // guideRenderPortrait() at double scale on a staging canvas of the shader's
  // size; 540 px is the widest square the output canvas can return.
  const largeData = await evaluate(`(() => {
    const preview = guideSpecimen(towerInfo.find(t => t.type === Incinerator));
    preview.angle = ${heading};
    const source = document.createElement('canvas');
    source.width = frameCanvas.width;
    source.height = frameCanvas.height;
    const paint = source.getContext('2d', {willReadFrequently: true}), previous = ctx;
    paint.translate(270, 270);
    paint.scale(2 * 2.25 * preview.scale, 2 * 2.25 * preview.scale);
    try {
      ctx = paint;
      preview.draw();
      updateGlowSettings({blurLevel: 3});
      glowFrame(source, true);
      const picture = document.createElement('canvas');
      picture.width = picture.height = 540;
      picture.getContext('2d').drawImage(outputCanvas, 0, 0, 540, 540, 0, 0, 540, 540);
      return picture.toDataURL('image/png');
    } finally {
      ctx = previous;
      updateGlowSettings({blurLevel: 2});
    }
  })()`);
  large = Buffer.from(largeData.split(',')[1], 'base64');
  socket.close();
} finally {
  const exited = new Promise(resolve => chrome.exitCode === null ? chrome.once('exit', resolve) : resolve());
  chrome.kill();
  await exited;
  server.close();
  rmSync(profile, {recursive: true, force: true});
}

// The specimen sits at the portrait's centre. Measure the tower's solid reach
// from there, so the halo may fade past the safe zone but the tower never does.
async function measure(image) {
  const {data, info} = await sharp(image).raw().toBuffer({resolveWithObject: true});
  const centre = info.width / 2;
  let reach = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] >= 128) reach = Math.max(reach, Math.hypot(x + 0.5 - centre, y + 0.5 - centre));
  }
  return {image, width: info.width, reach};
}
const small = await measure(portrait);
const big = await measure(large);

async function plate(size, radius, reachDp, d, rounded, source = small) {
  const scaled = Math.round(source.width * reachDp * d / source.reach);
  const tower = await sharp(source.image).resize(scaled, scaled, {kernel: 'lanczos3'}).toBuffer();
  const crop = Math.max(0, Math.floor((scaled - size) / 2));
  const fitted = scaled > size
    ? await sharp(tower).extract({left: crop, top: crop, width: size, height: size}).toBuffer()
    : tower;
  const base = rounded
    ? sharp(Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${background}"/></svg>`))
    : sharp({create: {width: size, height: size, channels: 4, background: '#0000'}});
  return base.composite([{input: fitted, gravity: 'center', blend: rounded ? 'atop' : 'over'}]).png();
}

// Adaptive foreground: 108 dp, the tower's reach at the 33 dp safe-zone radius.
// Legacy icon (API 23-25): 48 dp rounded square on the game's background.
const densities = {mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4};
for (const [name, d] of Object.entries(densities)) {
  const dir = join(res, 'mipmap-' + name);
  mkdirSync(dir, {recursive: true});
  await (await plate(Math.round(108 * d), 0, 33, d, false)).toFile(join(dir, 'ic_launcher_foreground.png'));
  await (await plate(Math.round(48 * d), 8 * d, 22, d, true)).toFile(join(dir, 'ic_launcher.png'));
}
// Store icon: the legacy plate at 512 px. F-Droid does not read adaptive icons.
mkdirSync(listing, {recursive: true});
await (await plate(512, 512 * 8 / 48, 22, 512 / 48, true, big)).toFile(join(listing, 'icon.png'));
console.log(`Rendered the Incinerator portrait (reach ${small.reach.toFixed(1)} px, ${big.reach.toFixed(1)} px at 2x) into ${res} and ${listing}`);
