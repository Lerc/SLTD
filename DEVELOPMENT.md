# SLTD · Simple Little Tower Defence

A phone-friendly tower defence game using vanilla JavaScript, Canvas and WebGL. No build step or runtime dependencies.

## Play locally

```sh
python3 -m http.server 8000 --directory srv
```

Open **http://localhost:8000**. Choose a map, then tap **Deploy defenses**. Foundry is the original route. Switchback winds from the bottom-right entrance to the bottom-left exit. Crosswind crosses itself, passing through the junction twice.

`main` contains the current game. `legacy` preserves the previous main at `db8a05d`, before Simple Little Tower Defence became main.

Eight more levels follow the 11 × 16 PNG patterns in `BaseMedia/Maps`: Knotwork, Zigzag, Coil, Longbow, Serpentine, Cascade, Sawtooth and Interlace (maps 1–8 respectively). Drag the map list up or down to browse, or use a mouse wheel. Tap a map to select it; the Deploy button stays visible below the list. Green marks the entrance and orange marks the exit in the previews. Crossings carry creeps straight through on each pass.

- Tap a foundation, then an empty tile to preview its range. Tap the **Tap to build** square again to confirm. An invalid tile cancels.
- With a mouse, move over the map after selecting a foundation to preview its placement and range, then click to build.
- Or drag from the build bar and release to build once. Every drag ends in placement or cancellation.
- An orange range circle means **Insufficient funds**. Your next tap cancels the preview.
- Tap a built tower, then its level-number button to buy an affordable level-up immediately. Tap a specialization to preview its resulting range, then the blue outlined **Confirm** button above it to buy it; any other interaction dismisses the preview. Levels carry into later branches. Tap empty ground to dismiss the panel.
- Choose **First**, **Strong**, or **Near** targeting. Sell with two taps for 70% of the total investment.
- Pause to plan, or use 2× speed. The game pauses when its tab is hidden. **Restart** begins the same map again; **Abandon game** returns to map selection.
- Kills earn score equal to the creep type’s base bounty multiplied by its original wave level (including splitter children). Escapes and credit bonuses earn no points. Each map’s best score and the level at which it was earned are saved in this browser and shown on map selection, including runs you restart or abandon. Older records without a level show just the score.
- Taller screens show the score in a strip above the game. Shorter screens show a compact score above Money, Lives, Pause and Speed without changing their touch targets.
- **Wave** shows the latest launched wave; **Send** shows the next wave and its early-launch credit bonus. Send unlocks three game-seconds after each launch, allowing multiple waves at once. Sending early pays one credit per remaining second (rounded up). Open the Tactical archive from the pause overlay.
- Each wave’s countdown is its last estimated unimpeded exit time (release offset plus route length ÷ creep speed), followed by 10 seconds. The next wave launches automatically even if enemies remain. A one-pixel line below the HUD counts down, with a glowing tip.
- Launching a wave adds its base clear reward to a shared pot. Only clearing **all** active and queued enemies, including splitter children, pays that pot plus the remaining-seconds bonus. Losing any life empties the entire pot. A zero pot displays **No wave bonus** and earns no time bonus, including for early sends; starting another wave adds its base reward to the pot again. The bar quickly drains as the bonus counts up. The payout stays visible for four game-seconds in total, then the next wave starts immediately. Overlapping waves keep their own release schedules.
- The game always uses a portrait canvas. Tower management slides over the build strip without moving or resizing the map.
- **Space** pauses/resumes; **Escape** closes menus or clears selection. Choose **Inspect defenses** in the pause overlay to build while time is stopped.

## Upgrade branches

| Foundation | Branch A | Branch B |
| --- | --- | --- |
| Sentry · 100 | Ranger · +420: long-range piercing | Repeater · +480: rapid fire |
| Cannon · 180 | Mortar · +630: explosive splash | Orbital · +900: long-range spirals |
| Pulse · 220 | Tesla · +720: chain lightning | Prism · +720: sustained beam ramps to 4× |
| Incinerator · 190 | Inferno · +570: intense lingering burns | Firestorm · +660: wide burning blasts |
| Nova · 260 | Cryo · +540: area slow | Quake · +660: slow and damage vulnerability |

Orbital can specialize again into **Railgun (+1000)** or **Executioner (+900)**. It cannot be built directly.

Turrets turn 15% of the remaining angle each simulation tick, following the shortest arc. Point-to-point weapons wait until they aim within 9° (5% of a half-turn). Incinerator and Inferno fire immediately while turning: flame packets follow the barrel direction, continue through enemies, and deflect and lose 28% of their speed on each hit. Each packet hits a given enemy once, applies burning on contact, and expires at its travel limit or maximum lifetime. Firestorm instead delivers a wide burning blast at the target, with falling firebrands and lingering embers. Area pulses fire without waiting for alignment. Flame packets and Firestorm flames share a pool of 250 tiny orange embers. Burning creeps use a separate pool of 500 with four times the emission chance for the same source power. Stronger flames emit more often; embers inherit their source velocity, brake into a gentle drift and fade out after 2–4 game-seconds.

Shots remain visible when their target dies. Sentry shots finish travelling to the enemy's last position and fade; Cannon shots oscillate ±20° around their homing heading at 2 Hz; they turn toward another living enemy when their target dies, or coast and fade when none remain; Pulse shots drift and dissipate. Orbital shots transform into `6 + 3 × level` small, bright-centered Orbital fragments that choose random living enemies. Each fragment launches radially with a randomized 50–74-tick phase that smoothly fades in directional homing. The burst shares the original shot's damage and uses its launch-time level. Without enemies, its fragments coast and fade. The clear payout begins when all living and queued enemies are gone. Remaining projectiles and visual effects continue animating during its four-second presentation, after which the next wave launches.

Every type can level up repeatedly. Foundation level 2 costs 40–65 credits; later levels become increasingly expensive. Each type has distinct damage, firing-rate and range curves, plus growth for its special effects. The level button shows its next price and largest stat gain. See [level curves and prices](plans/tower-levels.md).

Armor resists physical shots; shields are weak to energy and piercing. Burning stops menders from regenerating. Splitters release runners. Guardians resist slows and cost three lives on escape.

Flyers enter with an empty energy bank that fills over 15 game-seconds. Taking damage spends their current charge in a two-second burst: speed is `base speed × (1 + 2 × remaining charge)`, starting at up to 3× speed and fading linearly back to normal. Further hits do not extend an active burst. The bank recharges once the burst ends. An amber bar shows the bank, and twin exhaust trails show the boost; slows also reduce boosted speed.

Energy shields absorb damage and slowly recharge after a quiet period. Every damaging hit restarts that delay, including piercing health damage and ongoing burns. Any remaining shield blocks new debuffs (burning, chilling and vulnerability), including attempts to refresh existing ones. Debuffs already applied continue until they expire; a returning shield does not cleanse them. A hit that breaks the shield can apply its debuff immediately.

| Shielded creep | First wave | Character | Recharge delay |
| --- | --- | --- | --- |
| Shieldbug | 4 | Balanced shield carrier | 3 seconds |
| Skimmer | 8 | Fast, fragile runner with swept fins | 2 seconds |
| Capacitor | 9 | Enters unshielded; violet arcs pulse while its shield charges | 10 seconds |
| Bulwark | 11 | Slow escort with armor and a shield | 4 seconds |

Translucent cyan bubbles surround shielded creeps. Blue bars show remaining shield charge, flare on impact, and fade back to normal. The Tactical archive includes a dedicated shield page.

Health, shield and Flyer energy bars sit above their bodies and effects. See the refreshed [creep bar review](evaluations/creep-bars/creep-table.png), [native pixel comparison](evaluations/creep-bars/native-table.png), and [full/half/low/empty bank states](evaluations/creep-bars/bar-states.png). [Evaluation notes](evaluations/creep-bars/README.md) include the low-health and combat-effect comparisons and rerender command.

Spikey, Mender, Splitter, Shieldbug, Skimmer, Capacitor and Bulwark have distinct transparent sprites in [srv/images/creeps](srv/images/creeps), alongside the shield bubble PNG. The processed bodies are 96 × 96 with black interiors and pale outlines toned to match the original creeps. The bubble is resized separately to 256 × 256; only the bubble receives runtime attenuation for the glow pipeline. The [appearance comparison](evaluations/creep-appearance-v3/creep-table.png), [source sprite sheet](evaluations/creep-appearance-v3/source-table.png), [independent critique](evaluations/creep-appearance-v2/critique.md) and [generation prompts](evaluations/creep-appearance-v3/generation-prompts.json) record earlier art revisions.

The first 12 waves introduce threats in a fixed order. Later cycles add veteran mixed formations and increasing health. Kill bounties stay fixed; wave-clear rewards fund further building.

## Asset processing

Full-size working sources live in `BaseMedia/towers` and `BaseMedia/creeps`; the game loads the processed PNGs from `srv/images`. Tower atlases are 320 × 160, with separate body and turret cells and an added black turret outline. The current workflows are [TowerMod.json](tools/TowerMod.json) and [Creeps.json](tools/Creeps.json), with exported Node scripts beside them. Asset processing requires Node.js 20.9+ and the development dependencies installed with `npm ci`.

See [asset regeneration](tools/assets.md) for commands, the shield bubble's separate resizing step, and cache-version updates. The older brightness-matching tool is retained for historical comparisons and writes its images into the evaluation directory.

## Render a single creep

```sh
python3 tools/render-creep.py Shieldbug --state '{"shield":12,"shieldFlash":1}' -o /tmp/shieldbug.png
```

Produces an isolated PNG using the actual game renderer and glow, without an open game tab. Requires Python 3 and Chrome/Chromium. Supports JSON state files, debuffs, facing, zoom, and optional state metadata; see [renderer usage](tools/render-creep.md).

## Checks and headless play

To refresh the imported levels after editing their source PNGs, run `python3 tools/import-maps.py` (requires Pillow). Purple pixels are roads, green is the entrance, red is the exit, and black/dark brown are buildable ground. Maps without entrance/exit markers start at their topmost endpoint. The importer validates connected routes and straight crossings; `python3 tools/import-maps.py --check` verifies that the checked-in routes match the PNGs. The game uses the generated data without loading the source images.

```sh
npm test
node srv/nodemain.js -e 'buy_tower Tower 3 2; level_up_tower 0; send_wave; advance 1000; list_counts'
```

The Node suite checks combat, shield recharge and debuff immunity, turret orientation, placement, ordered map routes, overlapping waves, automatic wave timing and combined clear bonuses, tower levels, legal upgrades, refunds, save/load (including shots and burns from sold towers), and seeded progression. [Node CI](.github/workflows/test.yml) runs these checks and the example evaluation on pushes to main and pull requests targeting main, using Node.js 24. Browser interaction tests run through the browser-bridge CLI:

```sh
/path/to/browser-bridge/wsb run tests/browser/levels.test.js --app sltd --timeout 90 --wait
/path/to/browser-bridge/wsb run tests/browser/mobile.test.js --app sltd --timeout 90 --wait
/path/to/browser-bridge/wsb run tests/browser/placement-maps.test.js --app sltd --timeout 90 --wait
/path/to/browser-bridge/wsb run tests/browser/overlapping-waves.test.js --app sltd --timeout 90 --wait
/path/to/browser-bridge/wsb run tests/browser/energy-shields.test.js --app sltd --wait
```

Run `tests/browser/startup.test.js` immediately after reloading the page to check that the initial screen appears without a resize.

See [balance and implementation notes](plans/branching-defenses.md) for the tuning targets and validation scope.
