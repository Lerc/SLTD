# Glow colour-space probe

The bloom shader makes the RGB you ask for in `ctx.fillStyle` quite different
from the RGB that lands on screen. These charts measure the actual mapping so
drawing code can be written against real output rather than guesswork.

## Regenerating

Needs the game page open and `wsb ensure` already run.

```bash
tools/palette/run-palette.sh      # render + capture + sample -> out/
python3 tools/palette/label.py    # annotate            -> out/labelled/
```

`palette.js` is injected into the live page over browser-bridge; no game files
are modified. Labels are drawn onto the PNG **after** capture, so no label text
passes through the shader and contaminates a measurement.

Each chart produces `out/<name>.png` (raw capture), `out/<name>.json` (sampled
input→output pairs), and `out/labelled/<name>.png` (annotated).

## The pipeline being measured

`main.js:29` runs the glow with `threshold:0, bloom:1, blurLevel:2, exposure:0.7`.
Per `CanvasGlow.js`:

1. **Bright pass** — `smoothstep(threshold, threshold+0.2, luma)`. With
   `threshold:0` *everything* contributes to bloom, not just highlights.
2. **Blur** — downsample/upsample mip chain, so bloom at a pixel is gathered
   from its **neighbours**. Feature size therefore changes the result.
3. **Composite** — `original + bloom*intensity`, then `*exposure`, then ACES
   filmic tone mapping, then gamma `1/2.2`.

Steps 1–3 compound into a curve that is extremely steep near black and almost
flat above input ~64.

## What the measurements show

### 1. The usable input range is roughly 0–64, not 0–255

Solid fills, greyscale (`out/labelled/ramp.png`):

| input | output | | input | output |
|------:|-------:|-|------:|-------:|
| 8  | 40  | | 96  | 223 |
| 16 | 75  | | 128 | 232 |
| 24 | 115 | | 160 | 234 |
| 32 | 149 | | 192 | 236 |
| 48 | 191 | | 224 | 238 |
| 64 | 206 | | 255 | 239 |

Input 64 already reaches 206. The remaining 191 units of input buy just 33 more
units of output. **Everything above ~64 is visually interchangeable.**

To hit a target on-screen value with a solid fill:

| want on screen | draw |
|---------------:|-----:|
| 40  | 8   |
| 80  | 16  |
| 120 | 24  |
| 160 | 32  |
| 200 | 56  |
| 220 | 88  |
| 230 | 120 |

### 2. Feature size dominates colour

Same input, different square size (`out/labelled/context.png`), white:

| size | 25% in | 50% in | 100% in |
|-----:|-------:|-------:|--------:|
| 1px  | 14  | 21  | 34  |
| 2px  | 149 | 194 | 225 |
| 3px  | 160 | 202 | 229 |
| 4px  | 175 | 213 | 235 |
| 8px  | 199 | 228 | 239 |
| 32px | 207 | 232 | 239 |

There is a **cliff between 1px and 2px**: a 1px square at full white outputs
only 34 — dimmer than a 32px square at quarter brightness (207). A single-pixel
feature has almost no neighbours to gather bloom from, so it never lights up.

The same holds for lines. A 1px line at input 255 reads 142; a solid bar at
input 24 reads 115. **Line width is a stronger brightness control than colour.**

### Corollary: dim your fills, but not your text

These two rules pull in opposite directions, and it is easy to apply the wrong
one. Large fills saturate, so they need **low** input to stay dark or keep a
hue. Text and thin strokes lose brightness to their own thinness, so they need
**high** input to read at all.

Dimming label text the way a fill is dimmed produces murky, low-contrast text —
it is already losing brightness to the size curve, and lowering the input takes
away what is left. Observed on the tower selection panel: labels at input 40
peaked at 163 against a 129 fill (34 points of contrast); returning them to
near-white took the peak to 238 (174 points).

Rule of thumb: **fills go dark (input ≤ 64), text and thin strokes stay bright
(input ≥ 200).**

Practical rule: never rely on a 1px feature being visible. Use ≥2px for anything
that must read clearly.

### 3. Saturated hues drift toward white/yellow

Because each channel saturates independently near 239, ratios between channels
collapse as input rises. Orange (`255,128,0`, a clean 2:1 red:green) measured:

| input | output | R/G in | R/G out |
|-------|--------|-------:|--------:|
| 32,16   | 121,79  | 2.00 | 1.53 |
| 64,32   | 200,157 | 2.00 | 1.27 |
| 128,64  | 232,207 | 2.00 | 1.12 |
| 255,128 | 239,232 | 1.99 | **1.03** |

At full input, orange renders as `239,232,0` — indistinguishable from yellow.
**To keep a hue readable, keep its brightest channel low** (≤64). Drawing
`64,32,0` preserves the orange far better than `255,128,0` does.

Pure primaries are safe (a zero channel stays zero), so red/green/blue/cyan/
magenta hold their hue at any level — only their brightness compresses.

## Charts

| file | shows |
|------|-------|
| `ramp` | 32-step greyscale, solid bar vs 1px line |
| `blocks` | 8 hues x 8 brightness levels, solid fill |
| `context` | feature size (1–32px) x brightness |
| `lines-white`, `lines-cyan`, `lines-green`, `lines-orange` | line width x brightness per hue |

## Caveats

- Values are measured at each swatch's **centre**. Edges are brighter still,
  since they gather bloom from both sides.
- Sampling reads the captured PNG, so it includes the full pipeline exactly as
  the player sees it.
- All numbers assume the live settings above. Changing `exposure` or `bloom`
  invalidates the tables — re-run the probe.
