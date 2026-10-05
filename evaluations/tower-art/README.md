# Specialist tower artwork

Twelve transparent PNG atlases live in `srv/images/towers/`. Each contains a
stationary body in the left half and a separate weapon in the right half.
The built-in image generation tool produced the artwork; `prompts.json` records
the complete prompt for each tower. Full-size working sources are in
`BaseMedia/towers`. The current `tools/TowerMod.json` / `tools/TowerMod.mjs`
workflow adjusts the layers, adds a black turret outline, and produces 320 × 160
atlases. See [asset regeneration](../../tools/assets.md) for current commands.
Earlier unadjusted originals are archived in `brightness/originals/` for the
historical brightness study below.

`prepareTowerSprites` in `srv/Assets.js` caches two 128px drawing surfaces per
tower. The measured attachment points in `towerSpriteLayout` align each weapon
bearing and muzzle; chassis footprints are normalized to 78 world units. Source
PNG brightness is matched to Sentry, Cannon and Pulse, with no additional runtime
dimming. `Specialist.draw` uses the same layers in gameplay and the field guide.
Cryo and Quake use stationary radial emitters. Mortar's effect starts at its bore,
26 units forward; other directional specialist muzzles remain 50 units forward.

`tower-overview.png` and `brightness/tower-overview.png` record earlier
appearances, before the compact TowerMod processing. The latter includes
Sentry, Cannon and Pulse in the first row for comparison through the live glow
renderer. To make a new comparison with the currently loaded sprites, use the
browser-bridge skill's `wsb` command and a separate output directory:

```sh
wsb run evaluations/tower-art/preview.js --app sltd --wait > /tmp/sltd-tower-preview.log
mkdir -p /tmp/sltd-tower-preview
python3 tools/palette/collect.py /tmp/sltd-tower-preview < /tmp/sltd-tower-preview.log
```

Validation: full `npm test` suite passed; browser firing-effects and field-guide
animation checks passed; `preview.js` verified all 24 layers loaded, contained
visible pixels, and had transparent unclipped edges. Visual review used Chrome.

## Historical source brightness matching

Run `python3 tools/match-tower-brightness.py` to reproduce the adjustment from
the archived originals. Adjusted PNGs go to `brightness/regenerated/`, leaving
the shipped sprites untouched; the report files are refreshed in `brightness/`.
It requires Pillow, NumPy and Matplotlib. It matches
bodies against Tower1/2/3 and weapons against Gun1/2/3, with equal weight per
reference tower. Background pixels are excluded and edge pixels are weighted by
alpha. Brightness is Rec.709-weighted **sRGB luma** on a 0–255 scale, not linear
light luminance. The script matches the cumulative distributions independently
for all 24 layers; it preserves dimensions, exact alpha, and fully transparent
pixels. RGB channels scale together until a channel reaches 255, then highlights
mix toward white to reach the target brightness while keeping their hue.

| Source profile | Reference | Before | Adjusted |
| --- | ---: | ---: | ---: |
| Body mean luma | 50.28 | 42.18 | 50.18 |
| Body near-black pixels (luma < 8) | 71.74% | 13.84% | 71.92% |
| Body bright pixels (luma ≥ 160) | 23.05% | 7.36% | 23.07% |
| Weapon mean luma | 119.06 | 46.97 | 118.73 |
| Weapon near-black pixels | 39.39% | 19.47% | 39.38% |
| Weapon bright pixels | 54.34% | 10.16% | 54.27% |

These measurements describe that historical adjustment, before TowerMod
processing. Every adjusted layer was within one luma unit / percentage point of
these reference statistics. `brightness/comparison.json` contains the measurements;
`brightness/histogram-comparison.png` plots the before/after histograms and CDFs.
