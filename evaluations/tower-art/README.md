# Specialist tower artwork

Twelve transparent PNG atlases live in `srv/images/towers/`. Each contains a
stationary body in the left half and a separate weapon in the right half.
The built-in image generation tool produced the artwork; `prompts.json` records
the complete prompt for each tower. Unadjusted full-resolution originals are
archived in `brightness/originals/`.

`prepareTowerSprites` in `srv/Assets.js` caches two 128px drawing surfaces per
tower. The measured attachment points in `towerSpriteLayout` align each weapon
bearing and muzzle; chassis footprints are normalized to 78 world units. Source
PNG brightness is matched to Sentry, Cannon and Pulse, with no additional runtime
dimming. `Specialist.draw` uses the same layers in gameplay and the field guide.
Cryo and Quake use stationary radial emitters. Mortar's effect starts at its bore,
26 units forward; other directional specialist muzzles remain 50 units forward.

`tower-overview.png` retains the initial appearance. The corrected version is
`brightness/tower-overview.png`, with Sentry, Cannon and Pulse in the first row
for comparison through the live glow renderer. Regenerate it with the
browser-bridge skill's `wsb` command:

```sh
wsb run evaluations/tower-art/preview.js --app sltd --wait > /tmp/sltd-tower-preview.log
python3 tools/palette/collect.py evaluations/tower-art/brightness < /tmp/sltd-tower-preview.log
```

Validation: full `npm test` suite passed; browser firing-effects and field-guide
animation checks passed; `preview.js` verified all 24 layers loaded, contained
visible pixels, and had transparent unclipped edges. Visual review used Chrome.

## Source brightness matching

Run `python3 tools/match-tower-brightness.py` to reproduce the adjustment from
the archived originals. It requires Pillow, NumPy and Matplotlib. It matches
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

Every individual layer is within one luma unit / percentage point of these
reference statistics. `brightness/comparison.json` contains all measurements;
`brightness/histogram-comparison.png` plots the before/after histograms and CDFs.
