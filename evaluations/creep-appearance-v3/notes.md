# Creep art revision

Replaced the seven newer creep bodies with transparent PNGs using opaque black
interiors and pale, flat outlines, guided by Creep2.png, Creep3.png and Creep4.png.
The earlier distinct silhouettes remain: spiked mine, healing clover, paired
pods, beetle, swept wings, capacitor coils and broad armor.

Applied the independent V2 critique:

- Mender now has a solid central cross with black space around it. Removed its
  redundant procedural regeneration ring and cross; debuff rings still draw.
- Skimmer has a continuous bright outline, and body sprites no longer receive
  the exposure reduction needed by the previous shaded artwork.
- Shield bars are thinner and dimmer at rest. The impact peak remains bright,
  including the fading trace of lost points when a shield breaks.
- Kept the transparent bubble PNG and its restrained exposure so bodies remain
  visible. Ball and BigBall remain free of square armor frames.

`creep-table.png` uses the real game renderer at 3× native pixel scale.
`source-table.png` shows the underlying PNGs without game glow.
`Bulwark-impact.png` records a shield hit for comparison with its resting render.

Generation used the built-in image_gen tool. Initial prompts and source paths
are in generation-prompts.json; the final solid-cross edit is recorded in
mender-refinement.json. Final assets are in ../../srv/images/creeps/.

Validation: seven energy-shield Node tests passed, JavaScript syntax checks and
git diff --check passed, and all revised bodies were inspected through the
standalone renderer with the normal glow pipeline.
