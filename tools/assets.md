# Asset regeneration

The game loads processed PNGs from `srv/images`. Full-size working sources live
in `BaseMedia/towers` and `BaseMedia/creeps`. Keep edits to those sources separate
from the generated game assets.

The editable workflow graphs are `tools/TowerMod.json` and `tools/Creeps.json`.
Their exported `.mjs` scripts embed the graph: when changing a graph, export its
script again so both files describe the same process. Run commands below from
the repository root with Node.js 20.9+; shell brace expansion requires Bash.

```bash
npm ci
```

Sharp is a development dependency. The game and headless simulation have no
runtime npm dependencies, and playing locally does not require this install.

## Towers

```bash
node tools/TowerMod.mjs BaseMedia/towers/*.png --out srv/images/towers
```

The workflow adjusts the layers, adds a black outline to the turret, and resizes
each atlas to 320 × 160. Its left cell is the body and its right cell is the
weapon. `towerSpriteLayout` and `prepareTowerSprites` in `srv/Assets.js` align
the pivots and muzzle positions and prepare 128 × 128 drawing surfaces.

## Creep bodies

```bash
node tools/Creeps.mjs \
  BaseMedia/creeps/{Spikey,Mender,Splitter,Shieldbug,Skimmer,Capacitor,Bulwark}.png \
  --out srv/images/creeps
```

The body workflow applies the tone adjustment and produces 96 × 96 sprites.
The original Creep1–4 images remain separate assets. `output.png` is not loaded
by `srv/Assets.js` and is excluded from this gameplay regeneration command.

## Shield bubble

The bubble uses its own resizing step, preserving its source tone and alpha.
It is excluded from the creep body workflow:

```bash
node --input-type=module -e "import sharp from 'sharp'; await sharp('BaseMedia/creeps/ShieldBubble.png').resize(256, 256).png().toFile('srv/images/creeps/ShieldBubble.png');"
```

`prepareCreepSprite` in `srv/Assets.js` attenuates the bubble for gameplay glow;
body sprites receive no further runtime dimming. Browser workflow exports and
Node regeneration can differ slightly at antialiased edges, so validate the
rendered appearance rather than requiring identical compressed PNG bytes.

## Loading and verification

After changing shipped sprites, update the relevant image query versions in
`srv/Assets.js`, its script query in `srv/index.html`, and `window.WSB.version`.
Reload the page before inspecting it. The tactical guide uses the same sprites
and glow shader as gameplay; its portrait staging canvas uses
`willReadFrequently` to avoid Firefox accelerated-canvas fringes.

Use the [single-creep renderer](render-creep.md) for isolated appearance checks.
Browser checks include `tests/browser/energy-shields.test.js`,
`tests/browser/field-guide-glow.test.js`, and
`tests/browser/field-guide-animation.test.js`. Run them in Chrome and Firefox
through browser-bridge after verifying the loaded version. `npm test` checks
the gameplay rules; it does not inspect image appearance.

## Historical brightness matching

`tools/match-tower-brightness.py` reproduces the earlier histogram comparison
using archived originals in `evaluations/tower-art/brightness/originals`.
It writes adjusted PNGs under `evaluations/tower-art/brightness/regenerated`
and comparison reports beside that directory. Use the TowerMod workflow above
to regenerate current shipped art.
