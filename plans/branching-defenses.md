# Branching defenses

## Design

Keep the five existing tower foundations and sprite assets. Make the important decisions happen after placement: each foundation has two mutually exclusive specialties, with distinct damage or support behaviors. Prices in the management panel are incremental; selling returns 70% of all money spent on that tower.

The DOM interface sits outside the bloom pass for crisp text. Its header and bottom command panel surround a canvas sized to the available space. Portrait shows all five foundations in one row; short landscape moves management to the side. Controls have a minimum height of 44 CSS pixels. Both tap placement and dragging work, including a centered or resized canvas. No fullscreen prerequisite.

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
- `ui.js`: DOM controls and touch/drag management; simulation logic remains usable without a DOM.
- Node loads `showRunner.js` with browser-style global variable semantics so saved state and commands change the same values used by the simulation.
- Node saves preserve specialization investment, targeting, active status effects and split-child spawn positions. The browser command snapshot remains a lightweight tower-layout snapshot, as before; it is not a full mid-combat save.

## Validation

`npm test` runs combat and economy checks plus three seeded mixed-defense simulations and a starter-only baseline. `tests/browser/mobile.test.js` verifies building, both touch coordinate offsets and touch identifier zero, branch selection, targeting, selling, field-guide pause behavior, wave launch, control sizing and viewport overflow.

Browser validation passed in local Chrome at 390 × 844, 320 × 568, and 844 × 390, and in Firefox at 1366 × 682. A real emulated touch drag also passed in Chrome. Phone sizes are emulated; performance and touch feel still warrant checking on physical Android and iOS devices. Safari is not available in this environment.
