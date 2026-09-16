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
- Tap a built tower to choose one of its two permanent specializations.
- Choose **First**, **Strong**, or **Near** targeting. Sell with two taps for 70% of the total investment.
- Pause to plan, or use 2× speed. The game pauses when its tab is hidden.
- **Wave** shows the latest launched wave; **Send** shows the next wave and its early-launch credit bonus. Send unlocks three game-seconds after each launch, allowing multiple waves at once. Calling a wave during combat grants 10 credits. Open the field guide from the pause overlay.
- The game always uses a portrait canvas. Tower management slides over the build strip without moving or resizing the map.
- **Space** pauses/resumes; **Escape** closes menus or clears selection. Choose **Inspect defenses** in the pause overlay to build while time is stopped.

## Upgrade branches

| Foundation | Branch A | Branch B |
| --- | --- | --- |
| Sentry · 100 | Ranger · +140: long-range piercing | Repeater · +160: rapid fire |
| Cannon · 180 | Mortar · +210: explosive splash | Incinerator · +190: burning splash |
| Pulse · 220 | Tesla · +240: four-target lightning | Prism · +240: sustained beam ramps to 4× |
| Orbital · 360 | Railgun · +280: heavy piercing | Executioner · +260: finishes wounded enemies |
| Nova · 260 | Cryo · +180: area slow | Quake · +220: slow and damage vulnerability |

Armor resists physical shots; shields are weak to energy and piercing. Burning stops menders from regenerating. Splitters release runners. Guardians resist slows and cost three lives on escape.

The first 12 waves introduce threats in a fixed order. Later cycles add veteran mixed formations and increasing health. Kill bounties stay fixed; wave-clear rewards fund further building.

## Checks and headless play

```sh
npm test
node srv/nodemain.js -e 'buy_tower Tower 3 2; upgrade_tower 0 Ranger; send_wave; advance 1000; list_counts'
```

The Node suite checks combat, turret orientation, placement, ordered map routes, overlapping waves, legal upgrades, refunds, save/load and seeded progression. Browser interaction tests run through the browser-bridge CLI:

```sh
/path/to/browser-bridge/wsb run tests/browser/mobile.test.js --app sltd --timeout 90 --wait
/path/to/browser-bridge/wsb run tests/browser/placement-maps.test.js --app sltd --timeout 90 --wait
/path/to/browser-bridge/wsb run tests/browser/overlapping-waves.test.js --app sltd --timeout 90 --wait
```

Run `tests/browser/startup.test.js` immediately after reloading the page to check that the initial screen appears without a resize.

See [balance and implementation notes](plans/branching-defenses.md) for the tuning targets and validation scope.
