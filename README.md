# SLTD · Branching Defenses

A phone-friendly tower defense game using vanilla JavaScript, Canvas and WebGL. No build step or runtime dependencies.

## Play locally

```sh
python3 -m http.server 8000 --directory srv
```

Open **http://localhost:8000**. Choose a map, then tap **Deploy defenses**. Foundry is the original route. Switchback winds from the bottom-right entrance to the bottom-left exit. Crosswind crosses itself, passing through the junction twice.

- Tap a foundation, then an empty tile to preview its range. Tap the **Tap to build** square again to confirm. An invalid tile cancels.
- Or drag from the build bar and release to build once. Every drag ends in placement or cancellation.
- An orange range circle means **Insufficient funds**. Your next tap cancels the preview.
- Tap a built tower for an affordable level-up or a permanent specialization. Levels carry into later branches. Tap empty ground to dismiss the panel.
- Choose **First**, **Strong**, or **Near** targeting. Sell with two taps for 70% of the total investment.
- Pause to plan, or use 2× speed. The game pauses when its tab is hidden.
- **Wave** shows the latest launched wave; **Send** shows the next wave and its early-launch credit bonus. Send unlocks three game-seconds after each launch, allowing multiple waves at once. Calling a wave during combat grants 10 credits. Open the field guide from the pause overlay.
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

Shots remain visible when their target dies. Sentry shots finish travelling to the enemy's last position and fade; Cannon shots turn toward another living enemy, or coast and fade when none remain; Pulse shots drift and dissipate. Orbital shots transform into `6 + 3 × level` small, bright-centered Orbital fragments that choose random living enemies. Each fragment launches radially with a randomized 36–60-tick phase that smoothly fades in directional homing. The burst shares the original shot's damage and uses its launch-time level. Without enemies, its fragments coast and fade. Wave preparation waits for all projectiles and active visual effects to finish.

Every type can level up repeatedly. Foundation level 2 costs 40–65 credits; later levels become increasingly expensive. Each type has distinct damage, firing-rate and range curves, plus growth for its special effects. The level button shows its next price and largest stat gain. See [level curves and prices](plans/tower-levels.md).

Armor resists physical shots; shields are weak to energy and piercing. Burning stops menders from regenerating. Splitters release runners. Guardians resist slows and cost three lives on escape.

The first 12 waves introduce threats in a fixed order. Later cycles add veteran mixed formations and increasing health. Kill bounties stay fixed; wave-clear rewards fund further building.

## Checks and headless play

```sh
npm test
node srv/nodemain.js -e 'buy_tower Tower 3 2; level_up_tower 0; send_wave; advance 1000; list_counts'
```

The Node suite checks combat, turret orientation, placement, ordered map routes, overlapping waves, tower levels, legal upgrades, refunds, save/load and seeded progression. Browser interaction tests run through the browser-bridge CLI:

```sh
/path/to/browser-bridge/wsb run tests/browser/levels.test.js --app sltd --timeout 90 --wait
/path/to/browser-bridge/wsb run tests/browser/mobile.test.js --app sltd --timeout 90 --wait
/path/to/browser-bridge/wsb run tests/browser/placement-maps.test.js --app sltd --timeout 90 --wait
/path/to/browser-bridge/wsb run tests/browser/overlapping-waves.test.js --app sltd --timeout 90 --wait
```

Run `tests/browser/startup.test.js` immediately after reloading the page to check that the initial screen appears without a resize.

See [balance and implementation notes](plans/branching-defenses.md) for the tuning targets and validation scope.
