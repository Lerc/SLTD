# Single-creep appearance renderer

Run from the repo root (Python 3 and Chrome/Chromium required; no Python packages,
Node dependencies, running server, or open game tab needed):

```sh
python3 tools/render-creep.py --list-types
python3 tools/render-creep.py Shieldbug -o /tmp/shieldbug.png
python3 tools/render-creep.py Shieldbug \
  --state '{"shield":12,"shieldFlash":1,"shieldHitPoints":19.2}' \
  -o /tmp/shieldbug-hit.png
python3 tools/render-creep.py Capacitor \
  --state '{"shield":18,"slowTicks":120,"slowFactor":0.5,"burnTicks":90}' \
  -o /tmp/capacitor-debuffs.png --metadata /tmp/capacitor-debuffs.json
python3 tools/render-creep.py Bulwark \
  --state '{"shield":0,"damage":25,"angle":0.785398}' \
  -o /tmp/bulwark-exposed.png
```

`--state @path/to/state.json` accepts a JSON file containing the same property
object. Values override the type's constructor defaults. State is applied as a
snapshot, with no movement or combat simulation: you can depict an existing burn
inside a returned shield without the shield's debuff immunity blocking the setup.
A positive tick count means that status is active.

| State fields | Meaning |
| --- | --- |
| `shield` | Remaining shield points; 0 hides the bubble |
| `shieldFlash` | Shield-hit brightness, 0–1; 1 is a fresh impact |
| `shieldHitPoints` | Shield points immediately before impact, for the fading lost-points trace |
| `shieldRatio`, `hitPoints` | Capacity is `shieldRatio × hitPoints` |
| `damage` | Health damage already taken |
| `slowTicks`, `slowFactor` | Chill duration and movement multiplier |
| `burnTicks`, `burnPower` | Burning duration and damage per tick |
| `vulnerableTicks` | Quake vulnerability duration |
| `hitFlash` | Positive values show the normal damage flash |
| `angle` | Facing in radians; 0 faces up |
| `scale`, `radius` | The creep's own scale and indicator radius |
| `armor`, `regeneration` | Creep traits; Mender’s healing emblem is part of its PNG |
| `brood`, `slowResistance` | Boolean creep traits |

Unknown fields and invalid values fail clearly instead of silently producing the
wrong image. When changing health/capacity without specifying `shield`, shielded
types start full; Capacitors retain their uncharged default. `shieldHitPoints`
defaults to current charge when a flash is requested without a previous value.

Images default to **320×320**, at **3× native game pixels**, on a dark background.
The script loads the real entry point and sprites, initializes the actual game
renderer, draws exactly one creep and its indicators, then applies the live glow
settings. It crops and enlarges **after** glow, so zoom does not exaggerate bloom.
Enlargement uses nearest-neighbor sampling to expose the native rendered pixels.

Useful options:

- `--size 512 --zoom 4`: change output framing and enlargement. Excessively tight
  crops fail with a message to increase size or reduce zoom.
- `--zoom 1`: native game pixel size, with no enlargement.
- `--difficulty 3`: scale health and shield capacity before applying state values.
- `--no-bars`: hide health/shield points indicators.
- `--no-glow`: inspect the raw drawing before bloom and tone mapping.
- `--background '#000000'`: change the background color **before** glow. The
  game's glow renderer produces an opaque image; transparent export is not used.
- `--metadata /tmp/render.json`: save the resolved visual state, capacity, actual
  glow settings and rendering options alongside the PNG.
- `--browser /path/to/chromium`: select the browser; `SLTD_CHROME` also works.

The temporary HTTP server binds only to loopback and serves `srv/`. Each render
uses a disposable browser profile and software WebGL, then closes the browser
and server. It does not connect to browser-bridge or touch a running game. It
requires permission to open a local socket and launch Chrome in sandboxed agent
environments. It does not disable Chrome's sandbox.
