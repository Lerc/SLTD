"use strict";

// Cosmetic only: bounded, tick-driven effects on the existing trail canvas.
// Snapshot burst endpoints; only Prism follows its live target between pulses.
function towerFiringEffect(tower, target, origin = tower) {
  if (typeof ctx === 'undefined' || !ctx) return;
  const kind = tower.constructor.name;
  const life = {Ranger:12, Repeater:8, Mortar:36, Firestorm:52, Tesla:15, Prism:22, Railgun:28, Executioner:30, Cryo:85, Quake:48}[kind];
  if (!life) return;
  if (kind === 'Prism') {
    const active = particleSystems.find(p => p.owner === tower && p.isActive());
    if (active) { active.refresh(target); return; }
  }
  if (particleSystems.length >= 64) return;
  const start = {...origin.position};
  if (origin === tower) {
    const muzzle = tower.bulletsComeOutHere;
    start.x += muzzle.x; start.y += muzzle.y;
  }
  const center = {...tower.position};
  let end = {...target.position};
  let age = 0;
  let focus = tower.focus || 1;
  let liveTarget = target;
  const radius = tower.splash || tower.range;
  const flamePower = tower.power;
  const finishing = kind === 'Executioner' && target.damage / target.hitPoints > 0.65;
  const effect = {
    owner: kind === 'Prism' ? tower : null,
    refresh(next) { age = 0; liveTarget = next; focus = tower.focus || 1; },
    move() {
      age++;
      if (kind === 'Firestorm' && age < life) {
        for (let i = 0; i < 19; i++) {
          const position = firestormFlame(i, end, radius, age, life);
          const previous = firestormFlame(i, end, radius, age - 1, life);
          emitEmber(position.x, position.y, position.x - previous.x, position.y - previous.y,
            flamePower / 19 * (1 - age / life));
        }
      }
      if (kind === 'Prism' && !liveTarget.dead && tower.target === liveTarget && towers.includes(tower)) {
        end = {...liveTarget.position};
        const muzzle = tower.bulletsComeOutHere;
        start.x = tower.x + muzzle.x; start.y = tower.y + muzzle.y;
      } else if (kind === 'Prism') age = Math.max(age, life - 5);
    },
    isActive() { return age < life; },
    draw(c) {
      c.save();
      c.globalAlpha = Math.min(1, (life - age) / Math.min(12, life));
      c.lineCap = 'round';
      c.lineJoin = 'round';
      drawTowerShot(c, kind, {start, end, center, age, life, focus, radius, finishing});
      c.restore();
    }
  };
  particleSystems.push(effect);
}

// The renderer and ember emission use the same moving Firestorm elements.
function firestormFlame(index, end, radius, age, life) {
  if (index >= 16) {
    const angle = (index - 16) * Math.PI * 2 / 3 + age * 0.045 + 0.55;
    const distance = radius * (0.35 + age / life * 0.5);
    return {x: end.x + Math.cos(angle) * distance, y: end.y + Math.sin(angle) * distance};
  }
  const angle = index * 2.4, distance = radius * Math.sqrt((index + 0.5) / 16) * 0.9;
  const elapsed = age - index % 5 * 2;
  const height = (1 - Math.min(1, Math.max(0, elapsed / 13))) * 100;
  return {x: end.x + Math.cos(angle) * distance - height * 0.35,
    y: end.y + Math.sin(angle) * distance - height - Math.max(0, elapsed - 13) * 0.6,
    falling: elapsed < 13};
}

function drawTowerShot(c, kind, s) {
  const {start, end, center, age, life, focus, radius, finishing} = s;
  const tau = Math.PI * 2;
  const t = age / life;
  const dx = end.x - start.x, dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / length, uy = dy / length;
  const line = (x1, y1, x2, y2, color, width) => {
    c.strokeStyle = color; c.lineWidth = width;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  };
  const ring = (x, y, r, color, width = 3) => {
    c.strokeStyle = color; c.lineWidth = width;
    c.beginPath(); c.arc(x, y, Math.max(0, r), 0, tau); c.stroke();
  };
  const dot = (x, y, r, color) => {
    c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, tau); c.fill();
  };
  const along = (d, side = 0) => ({x:start.x + ux * d - uy * side, y:start.y + uy * d + ux * side});
  const streak = (d, size, side, color, width) => {
    const a = along(d, side), b = along(d - size, side);
    line(a.x, a.y, b.x, b.y, color, width);
  };
  // Stable geometry avoids consuming gameplay randomness or flickering each draw.
  const noise = n => { const v = Math.sin(n * 127.1 + center.x * 0.13 + center.y * 0.37) * 43758.5453; return v - Math.floor(v); };

  if (kind === 'Ranger') {
    // A single long, narrow flechette with a pointed head and sharp impact slivers.
    const d = Math.min(length, length * (age + 1) / 3);
    streak(d, Math.min(80, d), 0, '#184060', 3);
    const tip = along(d), tail = along(d - 24);
    c.fillStyle = '#286080'; c.beginPath(); c.moveTo(tip.x, tip.y);
    c.lineTo(tail.x - uy * 5, tail.y + ux * 5);
    c.lineTo(tail.x + uy * 5, tail.y - ux * 5); c.closePath(); c.fill();
    if (age > 2) for (let i = -1; i <= 1; i++) {
      const a = along(length + age * 2, i * age);
      line(end.x, end.y, a.x, a.y, '#204860', 2);
    }
  } else if (kind === 'Repeater') {
    // Three separated brass tracers, a staccato muzzle flash and ejected casing.
    for (let i = 0; i < 3; i++) {
      const d = ((t + i / 3) % 1) * length;
      streak(d, Math.min(d, 17), i % 2 ? 3 : -3, '#604008', 5);
    }
    if (age < 3) {
      const tip = along(24);
      line(start.x, start.y, tip.x, tip.y, '#785018', 7);
    }
    const casing = along(-12 - age * 2, 12 + age * 3);
    line(casing.x, casing.y, casing.x + 5, casing.y + 4, '#382808', 3);
  } else if (kind === 'Tesla') {
    // Jagged, branching arcs; each chain hop has its own discharge corona.
    c.strokeStyle = '#185068'; c.lineWidth = 4; c.beginPath(); c.moveTo(start.x, start.y);
    const segments = Math.max(4, Math.ceil(length / 25));
    const phase = Math.floor(age / 3);
    for (let i = 1; i < segments; i++) {
      const p = along(length * i / segments, (noise(i + phase * 19) - 0.5) * 36);
      c.lineTo(p.x, p.y);
    }
    c.lineTo(end.x, end.y); c.stroke();
    for (let i = 1; i <= 3; i++) {
      const p = along(length * i / 4);
      const q = along(length * i / 4 + 15, (i % 2 ? 1 : -1) * (18 + noise(i + phase) * 20));
      line(p.x, p.y, q.x, q.y, '#103048', 2);
    }
    ring(end.x, end.y, 9 + age % 4 * 3, '#205868', 2);
  } else if (kind === 'Prism') {
    // Continuous optical core; split sidebands converge as the focus ramps up.
    line(start.x, start.y, end.x, end.y, '#281038', 6 + focus * 3);
    for (const side of [-1, 1]) {
      const p = along(0, side * (10 - focus));
      line(p.x, p.y, end.x, end.y, side < 0 ? '#401848' : '#183858', 2);
    }
    line(start.x, start.y, end.x, end.y, '#604068', 2 + focus);
    ring(end.x, end.y, 8 + focus * 3, '#482058', 3);
    for (let i = 0; i < 3; i++) {
      const p = along(((age / 14 + i / 3) % 1) * length);
      dot(p.x, p.y, 2 + focus, '#584068');
    }
  } else if (kind === 'Railgun') {
    // Instant ruler-straight rail, paired shock collars and forward metal spall.
    if (age < 9) {
      line(start.x, start.y, end.x, end.y, '#183c30', 13 * (1 - age / 12));
      line(start.x, start.y, end.x, end.y, '#608070', 3);
    }
    for (let i = 1; i <= 4; i++) {
      const p = along(length * i / 5);
      c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(dy, dx));
      c.strokeStyle = '#204838'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(0, 0, 4 + age * 0.3, 9 + age * 0.9, 0, 0, tau); c.stroke(); c.restore();
    }
    for (let i = 0; i < 7; i++) {
      const p = along(length + age * (2 + noise(i) * 3), (noise(i + 9) - 0.5) * age * 3);
      line(p.x, p.y, p.x - ux * 12, p.y - uy * 12, '#305040', 3);
    }
  } else if (kind === 'Executioner') {
    // A closing targeting seal and crossed blades; lethal threshold flares wider.
    const r = 14 + (1 - Math.min(1, age / 12)) * 36;
    c.strokeStyle = finishing ? '#701020' : '#401020'; c.lineWidth = finishing ? 6 : 3;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      c.beginPath(); c.arc(end.x, end.y, r, a, a + 0.8); c.stroke();
    }
    if (age < 5) for (let i = 0; i < 4; i++) streak(length * i / 4, 12, 0, '#481020', 3);
    if (age >= 8) {
      const slash = (finishing ? 42 : 25) * Math.min(1, (age - 7) / 4);
      line(end.x-slash, end.y-slash, end.x+slash, end.y+slash, '#681428', finishing ? 7 : 4);
      line(end.x+slash, end.y-slash, end.x-slash, end.y+slash, '#481038', 4);
    }
  } else if (kind === 'Mortar') {
    // A chunky recoiling shell, then a hollow pressure front with flying debris.
    if (age < 7) {
      const flight = age / 7;
      const p = along(length * flight);
      p.y -= Math.sin(flight * Math.PI) * Math.min(65, length * 0.3);
      dot(p.x, p.y, 10, '#403008');
      line(p.x-ux*8, p.y-uy*8, p.x-ux*23, p.y-uy*23, '#301808', 6);
    } else {
      const blast = (age - 7) / (life - 7);
      ring(end.x, end.y, radius * Math.sqrt(blast), '#503008', 6 * (1 - blast) + 2);
      if (blast < 0.2) dot(end.x, end.y, 18 * (1 - blast * 4), '#684020');
      for (let i = 0; i < 12; i++) {
        const a = i * tau / 12 + noise(i) * 0.3;
        const d = radius * blast * (0.5 + noise(i + 4) * 0.5);
        const x = end.x + Math.cos(a) * d, y = end.y + Math.sin(a) * d;
        line(x, y, x - Math.cos(a) * 11, y - Math.sin(a) * 11, '#402010', 4);
      }
    }
  } else if (kind === 'Firestorm') {
    // Falling firebrands settle into flames; loose embers use the shared pool.
    for (let i = 0; i < 16; i++) {
      const {x, y, falling} = firestormFlame(i, end, radius, age, life);
      if (falling) {
        line(x, y, x - 9, y - 28, '#582008', 6);
      } else {
        dot(x, y, 3 + (1 - t) * 5, i % 3 ? '#481008' : '#602808');
      }
    }
    c.strokeStyle = '#381008'; c.lineWidth = 5;
    for (let i = 0; i < 3; i++) {
      const a = i * tau / 3 + age * 0.045;
      c.beginPath(); c.arc(end.x, end.y, radius * (0.35 + t * 0.5), a, a + 1.1); c.stroke();
    }
  } else if (kind === 'Cryo') {
    // Sparse sixfold frost lattice: a field of growing crystals, not a blast.
    const spread = Math.min(1, age / 22);
    ring(center.x, center.y, radius * spread, '#103040', 2);
    for (let i = 0; i < 19; i++) {
      const a = i * 2.4, d = radius * Math.sqrt((i + 1) / 20) * 0.92;
      if (d > radius * spread) continue;
      const x = center.x + Math.cos(a) * d, y = center.y + Math.sin(a) * d;
      const size = 9 + noise(i) * 9;
      for (let j = 0; j < 6; j++) {
        const b = j * tau / 6;
        const tipX = x + Math.cos(b) * size, tipY = y + Math.sin(b) * size;
        line(x, y, tipX, tipY, '#184858', 2);
        line(tipX, tipY, x + Math.cos(b + 0.4) * size * 0.55, y + Math.sin(b + 0.4) * size * 0.55, '#103840', 2);
      }
    }
  } else if (kind === 'Quake') {
    // Angular fault lines rupture outwards; a second broken shock front follows.
    const spread = Math.min(1, age / 18);
    for (let i = 0; i < 9; i++) {
      const a = i * tau / 9;
      let x = center.x + Math.cos(a) * 38, y = center.y + Math.sin(a) * 38;
      for (let j = 1; j <= 5; j++) {
        const d = 38 + (radius - 38) * j / 5 * spread;
        const bend = a + (noise(i * 7 + j) - 0.5) * 0.35;
        const nx = center.x + Math.cos(bend) * d, ny = center.y + Math.sin(bend) * d;
        line(x, y, nx, ny, '#382008', 7 - j);
        if (j === 3) line(nx, ny, nx + Math.cos(bend + 0.7) * 25, ny + Math.sin(bend + 0.7) * 25, '#302008', 3);
        x = nx; y = ny;
      }
      const d = radius * Math.min(1, (age + 1) / 28);
      const x1 = center.x + Math.cos(a) * d, y1 = center.y + Math.sin(a) * d;
      line(x1, y1, center.x + Math.cos(a + 0.4) * d, center.y + Math.sin(a + 0.4) * d, '#483018', 5);
      dot(x1, y1 - Math.sin(t * Math.PI) * 12, 4, '#302418');
    }
  }
}
