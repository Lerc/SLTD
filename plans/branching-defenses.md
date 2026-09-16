# Branching defenses

## Design

Keep the five existing tower foundations and sprite assets. Make the important decisions happen after placement: each foundation has two mutually exclusive specialties, with distinct damage or support behaviors. Prices in the management panel are incremental; selling returns 70% of all money spent on that tower.

The game and all controls are canvas-rendered in a fixed 1080 × 1848 portrait coordinate system. The 1536-high map occupies 83% of that height; one 156-high status row and one 156-high control strip use the remainder. The viewport scales only when the window itself changes size. Desktop landscape windows show the same portrait game centered between black side margins.

Selecting a tower slides its controls over the build strip in 180 ms. The two upgrade choices, targeting, selling and close button reuse the same strip. No instructional headings, branding or helper rows occupy active gameplay space. Tutorials and fullscreen controls live in a paused canvas overlay. The shortest phone control is 150 logical units wide and 156 high, preserving 44-pixel touch targets at 320-pixel portrait width.

A separate transparent 2D canvas renders crisp controls after the battlefield bloom pass. Drawing and input share button geometry. The UI redraws on changes and during animations; it does not require DOM controls or relayout. Screenshots composite both canvases. Pointer capture supports drag placement, with explicit cancellation and single-pointer ownership.

Combat effects use the existing persistence canvas, with a cap of 64 concurrent effect systems and eight impact particles per projectile. The map uses a restrained green grid, a brighter marked route, and entry/exit accents. Specialist towers have colored hexagonal collars; status rings and enemy markers communicate armor, shields, frost and fire.

## Progression targets

- Start with 320 credits, 20 integrity, and 15 seconds to build.
- Allow two well-placed starter towers to clear the first two waves without leaks.
- Introduce armor in wave 3, shields in wave 4, a guardian in wave 5, menders in wave 6, and splitters in wave 7.
- Give 10 seconds between subsequent waves. Sending early awards one credit per remaining second, rounded up.
- Keep bounties fixed. Award `35 + 5 × wave` credits for clearing a wave.
- Raise density gradually, capped at 60 regular enemies plus an occasional guardian.
- Increase health smoothly, with additional quadratic growth after wave 12. Later cycles add mixed veteran units so early formations do not repeat unchanged.

Seeded simulations use a legal sequence of purchases and upgrades, without injected money. For seeds 11, 42, and 87, the mixed defense clears the introductory waves at full integrity and loses on wave 21 if it stops expanding at eight towers. Two starter towers with no further investment lose on wave 5. These are regression targets, not a substitute for player feedback on difficulty.

## Architecture and compatibility

- `arsenal.js`: foundation and specialization catalog, upgrade/sell rules, specialist combat and bounded effects.
- `waves.js`: deterministic wave composition, scaling, rewards and early launch.
- `entities.js`: status effects, damage types, new creeps, targeting and projectile behavior.
- `ui.js`: canvas drawing, shared hit regions, sliding control strip and paused overlays.
- `input.js`: pointer ownership, capture, cancellation and keyboard state.
- `main.js`: fixed portrait viewport, world rendering and crisp UI compositing. Simulation logic remains usable without a DOM.
- Node loads `showRunner.js` with browser-style global variable semantics so saved state and commands change the same values used by the simulation.
- Node saves preserve specialization investment, targeting, active status effects and split-child spawn positions. The browser command snapshot remains a lightweight tower-layout snapshot, as before; it is not a full mid-combat save.

## Validation

`npm test` runs combat and economy checks plus three seeded mixed-defense simulations and a starter-only baseline. `tests/browser/mobile.test.js` exercises canvas controls with pointer events: tap and drag placement, pointer identifier zero, cancellation, branch selection, targeting, refunds, paused help and wave launch. It compares canvas bounds, cell coordinates and the world transform through the slide animation and all management/modal transitions. It also checks portrait aspect, centering and phone hit-target sizes.

Canvas interaction checks passed in Chrome at 390 × 844 and 320 × 568, and Firefox at 1366 × 682. At 320 × 568 the visible map is 455 pixels high, compared with 299 in the previous DOM layout. Desktop portrait letterboxing was also visually checked at 1366 × 768.

Phone sizes are emulated; performance and touch feel still warrant checking on physical Android and iOS devices. Safari is not available in this environment.
