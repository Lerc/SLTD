# Creep health, shield and energy bar review

Rerendered all twelve creep types at their current constructor sizes, including
the larger Capacitor (scale 0.975) and Mender (scale 1.1). Each of the 52 PNGs
comes from `tools/render-creep.py`, with normal game glow, difficulty 1, bars
enabled, a 384×384 frame and 3× enlargement after glow. Matching JSON files
record each resolved state and the glow settings; `requests.json` records the
input snapshots.

| Comparison | Coverage |
| --- | --- |
| [Roster](creep-table.png) | All twelve types with 65% health; shield and Flyer energy also at 65% |
| [Native pixels](native-table.png) | Same roster reduced by exactly 3× with nearest-neighbor sampling to show actual game pixels |
| [Critical state](critical-table.png) | All twelve types with 10% health and 10% shield/energy where applicable |
| [Bank states](bar-states.png) | Flyer and four shielded types at full, half, 10% and empty banks, with 65% health |
| [Combat effects](effect-states.png) | Four shield impacts, Capacitor charging arcs, and full/half/low Flyer boosts |

The Capacitor charging preview now shows three bright orbiting dots with curved
trails fading to transparent behind them.

The initial renders exposed health bars crossing the Mender and Shieldbug
sprites, and faint shield fills against their bubbles. The game now places bars
above the sprite and shield/charging effect bounds, gives small creeps a minimum
bar width, slightly thickens the bars, and brightens resting shield and energy
fills. Health remains green/red, shields blue, and energy amber. Empty shield and
energy banks retain their dark track; undamaged creeps still omit the health bar.

Visual inspection covered the five sheets, including native pixel size, low
fills and effects. Health bars clear the enlarged bodies; shield and energy rows
remain identifiable above health. No evaluated sprite, bar or effect clips at
the frame edge. All 52 metadata files match the requested states and have bars
and game glow enabled. The Node suite and browser shield/Flyer checks pass.

Rebuild from the repository root:

```sh
python3 evaluations/creep-bars/render.py
```

The comparison-sheet script needs Pillow and uses up to three independent
Chrome renders at once (`--jobs 1` runs serially). It does not change the game
state or source art. Individual snapshots can also be rendered directly:

```sh
python3 tools/render-creep.py Flyer \
  --state '{"damage":5.25,"boostCharge":0.5,"boostTicks":60}' \
  -o /tmp/flyer-bars.png --metadata /tmp/flyer-bars.json
```
