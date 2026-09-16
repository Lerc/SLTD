# Branching defenses

## Design

Keep the five existing tower foundations and sprite assets. Make the important decisions happen after placement: each foundation has two mutually exclusive specialties, with distinct damage or support behaviors. Prices in the management panel are incremental; selling returns 70% of all money spent on that tower.

The game and all controls are canvas-rendered in a fixed 1080 × 1848 portrait coordinate system. The 1536-high map occupies 83% of that height; one 156-high status row and one 156-high control strip use the remainder. The viewport scales only when the window itself changes size. Desktop landscape windows show the same portrait game centered between black side margins.

Selecting a tower slides its controls over the build strip in 180 ms. The two upgrade choices, targeting, selling and close button reuse the same strip. No instructional headings, branding or helper rows occupy active gameplay space. Tutorials and fullscreen controls live in a paused canvas overlay. The shortest phone control is 150 logical units wide and 156 high, preserving 44-pixel touch targets at 320-pixel portrait width.

A separate transparent 2D canvas renders crisp controls after the battlefield bloom pass. Drawing and input share button geometry. The UI redraws on changes and during animations; it does not require DOM controls or relayout. Screenshots composite both canvases. Pointer capture supports drag placement, with explicit cancellation and single-pointer ownership.

Placement has two explicit modes. Dragging from a foundation button always finishes on release, placing once or cancelling. Tapping a foundation enters preview mode: an empty tile gets a fixed range preview and a “Tap to build” confirmation square. Tapping that square again purchases; another empty tile moves the preview; an invalid tile cancels. Insufficient funds turn the range orange and latch cancellation on the next tap, even if income arrives meanwhile.

The HUD superimposes numbers over faded, filled “Wave” and “Send” labels. Number text is 54px versus 72px labels: 75% of their height. Wave shows the latest launched wave or last completed wave during preparation; Send shows the pending wave and the early-send bonus below.

A canvas map picker precedes deployment. Foundry retains the original route. Switchback enters at the bottom right, winds through the inner board and exits at the bottom left. Crosswind passes vertically and horizontally through the same crossing. Explicit ordered cell paths prevent shortcuts at the junction; colored gate arrows show entry and exit direction on any edge. All maps share the same board dimensions, economy and wave schedule. Map selection never changes viewport geometry.

Canvas sizing assigns the UI buffer dimensions only when they actually change and invalidates its drawing cache after resizing. This prevents the initial ResizeObserver callback from clearing an already rendered title screen and leaving the cache marked current.

Combat effects use the existing persistence canvas, with a cap of 64 concurrent effect systems and eight impact particles per projectile. The map uses a restrained green grid, a brighter marked route, and entry/exit accents. Specialist towers have colored hexagonal collars; status rings and enemy markers communicate armor, shields, frost and fire.

All turret art faces north in local coordinates, with clockwise positive rotation. Specialist barrels use the same reference as the original sprites and targeting angles.

## Progression targets

- Start with 320 credits, 20 integrity, and 15 seconds to build.
- Allow two well-placed starter towers to clear the first two waves without leaks.
- Introduce armor in wave 3, shields in wave 4, a guardian in wave 5, menders in wave 6, and splitters in wave 7.
- Give 10 seconds to prepare when all active waves have cleared. Sending during preparation awards one credit per remaining second, rounded up.
- Send unlocks 180 simulation ticks (three game-seconds) after every launch. Players may repeatedly overlap waves; each keeps its own spawn clock and enemy health scaling. Sending during combat awards the full 10-credit preparation bonus. Pause freezes the cooldown; 2× speed advances it with the game.
- Keep bounties fixed. Award `35 + 5 × wave` credits once for each cleared wave, even when waves finish out of order. Split children belong to their parent's wave and must also be cleared before its reward.
- Raise density gradually, capped at 60 regular enemies plus an occasional guardian.
- Increase health smoothly, with additional quadratic growth after wave 12. Later cycles add mixed veteran units so early formations do not repeat unchanged.

Seeded simulations use a legal sequence of purchases and upgrades, without injected money. For seeds 11, 42, and 87, the mixed defense clears the introductory waves at full integrity and loses on wave 21 if it stops expanding at eight towers. Two starter towers with no further investment lose on wave 5. These are regression targets, not a substitute for player feedback on difficulty.

## Architecture and compatibility

- `arsenal.js`: foundation and specialization catalog, upgrade/sell rules, specialist combat and bounded effects.
- `waves.js`: deterministic wave composition, scaling, independent spawn clocks, per-wave rewards and early launch.
- `maps.js`: route catalog, orthogonal route construction and ordered paths through crossings.
- `placement.js`: shared drag/preview/confirmation state and cancellation rules.
- `entities.js`: status effects, damage types, new creeps, targeting and projectile behavior.
- `ui.js`: canvas drawing, shared hit regions, sliding control strip and paused overlays.
- `input.js`: pointer ownership, capture, cancellation and keyboard state.
- `main.js`: fixed portrait viewport, world rendering and crisp UI compositing. Simulation logic remains usable without a DOM.
- Node loads `showRunner.js` with browser-style global variable semantics so saved state and commands change the same values used by the simulation.
- Node saves preserve the selected map and route, active wave clocks and enemy wave membership, queued enemy health, specialization investment, targeting, active status effects and split-child spawn positions. Browser snapshots also retain the map and route but remain lightweight tower-layout snapshots, not full mid-combat saves.

## Validation

`npm test` runs combat and economy checks plus three seeded mixed-defense simulations and a starter-only baseline. `tests/browser/mobile.test.js` exercises canvas controls with pointer events: tap and drag placement, pointer identifier zero, cancellation, branch selection, targeting, refunds, paused help and wave launch. It compares canvas bounds, cell coordinates and the world transform through the slide animation and all management/modal transitions. It also checks portrait aspect, centering and phone hit-target sizes.

The Node suite also checks actual specialist barrel geometry against four firing directions, placement transitions and funds changes, and path traversal and save/load for each map. `tests/browser/placement-maps.test.js` checks map selection, preview confirmation, drag completion, invalid cells, insufficient-funds cancellation and Wave/Send labels through the canvas controls. Seeded difficulty targets above apply to Foundry; the additional maps have route validation but still need player balance feedback.

Overlap checks cover the exact three-second gate, six simultaneous waves, independent spawning and rewards, split-child difficulty and wave ownership, and overlapping save/load. Browser checks exercise Send with four waves on Crosswind. The startup test checks visible canvas pixels after a fresh load without resizing; it caught the original blank-screen bug. Both startup and overlap checks pass in Chrome and Firefox. The seeded progression results above use sequential waves; overlapping-wave balance still benefits from playtesting.

Canvas interaction checks passed in Chrome at 390 × 844 and 320 × 568, and Firefox at 1366 × 682. At 320 × 568 the visible map is 455 pixels high, compared with 299 in the previous DOM layout. Desktop portrait letterboxing was also visually checked at 1366 × 768.

Phone sizes are emulated; performance and touch feel still warrant checking on physical Android and iOS devices. Safari is not available in this environment.
