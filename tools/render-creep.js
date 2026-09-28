"use strict";

// Runs in a disposable browser page. All drawing and glow come from game code.
const initializeCreepRenderer = window.onload;
window.onload = async function() {
  const report = value => {
    const result = document.createElement('pre');
    result.id = 'creep-render-result';
    result.textContent = JSON.stringify(value);
    document.body.appendChild(result);
  };
  try {
    const request = await (await fetch('/__creep__/request.json')).json();
    running = false; // init() prepares the real renderer; its animation loop stays idle.
    initializeCreepRenderer();
    startGame();
    difficulty = request.difficulty;
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(request.type)) throw new Error('Invalid creep type');
    const Type = eval(request.type); // Class names live in the game's lexical scope.
    if (!(Type.prototype instanceof Creep)) throw new Error('Not a creep type: ' + request.type);
    const creep = new Type();
    const initialShieldFraction = creep.maxShield > 0 ? creep.shield / creep.maxShield : 0;
    const fields = ['angle', 'scale', 'radius', 'hitPoints', 'damage', 'shield', 'shieldRatio',
      'shieldFlash', 'shieldHitPoints', 'hitFlash', 'slowTicks', 'slowFactor', 'burnTicks',
      'burnPower', 'vulnerableTicks', 'armor', 'regeneration', 'brood', 'slowResistance'];
    for (const [key, value] of Object.entries(request.state)) {
      if (!fields.includes(key)) throw new Error('Unknown visual state field: ' + key);
      const boolean = key === 'brood' || key === 'slowResistance';
      if (boolean ? typeof value !== 'boolean' : typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(key + ' must be ' + (boolean ? 'boolean' : 'a finite number'));
      }
      if (!boolean && key !== 'angle' && value < 0) throw new Error(key + ' cannot be negative');
      if (['scale', 'radius', 'hitPoints'].includes(key) && value === 0) throw new Error(key + ' must be positive');
      if (['shieldFlash', 'slowFactor', 'armor'].includes(key) && value > 1) throw new Error(key + ' must be between 0 and 1');
      creep[key] = value;
    }
    // Changing capacity without explicitly setting charge keeps its initial fraction.
    if (!Object.hasOwn(request.state, 'shield')) creep.shield = initialShieldFraction * creep.maxShield;
    if (creep.shield > creep.maxShield) throw new Error('shield exceeds maxShield (' + creep.maxShield + '); set shieldRatio or hitPoints too');
    if (creep.damage > creep.hitPoints) throw new Error('damage exceeds hitPoints');
    if (!Object.hasOwn(request.state, 'shieldHitPoints') && creep.shieldFlash > 0) creep.shieldHitPoints = creep.shield;
    if (!creep.image?.width || (creep.image instanceof HTMLImageElement && !creep.image.naturalWidth)) throw new Error('Creep sprite failed to load');

    // Center within the full native game framebuffer. Crop and enlarge AFTER
    // bloom so changing output zoom cannot change the apparent glow strength.
    const crop = request.size / request.zoom;
    if (crop > Math.min(OutputWidth, OutputHeight)) throw new Error('Crop exceeds game framebuffer; increase --zoom or reduce --size');
    const bodyRadius = Math.max(creep.image.width / 2, creep.image.height / 2, creep.radius + 21, 62);
    const extent = bodyRadius * creep.scale * globalScaleFactor;
    if (extent + 10 > crop / 2) throw new Error('Creep would be clipped; increase --size or reduce --zoom');
    creep.x = OutputWidth / 2 / globalScaleFactor;
    creep.y = OutputHeight / 2 / globalScaleFactor;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = request.background;
    ctx.fillRect(0, 0, OutputWidth, OutputHeight);
    ctx.setTransform(globalScaleFactor, 0, 0, globalScaleFactor, 0, 0);
    creep.drawMain();
    if (request.bars) creep.drawHealthBar();
    if (request.glow) glowFrame(frameCanvas);
    const capture = document.createElement('canvas');
    capture.width = capture.height = request.size;
    const context = capture.getContext('2d');
    context.imageSmoothingEnabled = false;
    // Read WebGL immediately, before compositing discards its drawing buffer.
    context.drawImage(request.glow ? outputCanvas : frameCanvas,
      (OutputWidth - crop) / 2, (OutputHeight - crop) / 2, crop, crop, 0, 0, request.size, request.size);
    report({png: capture.toDataURL('image/png').split(',')[1], metadata: {
      ...request, state: Object.fromEntries(fields.filter(key => creep[key] !== undefined).map(key => [key, creep[key]])),
      maxShield: creep.maxShield, nativeScale: globalScaleFactor, glowSettings: {...settings}
    }});
  } catch (error) {
    report({error: error.message});
  }
};
