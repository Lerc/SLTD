"use strict";

const emberLayers = [[3.3, '#481400'], [2, '#803004'], [1.2, '#fff0c0']];

// Cosmetic randomness must not change flame deflections or other combat rolls.
function emberRandom() {
  let seed = 0x6e624eb7;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

class EmberSystem {
  constructor({random = emberRandom(), capacity = 250, emissionRate = 0.035} = {}) {
    this.random = random;
    this.emissionRate = emissionRate;
    this.particles = Array.from({length: capacity}, () => ({active: false,
      x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0}));
    this.available = [];
    this.reset();
  }

  reset() {
    this.available.length = 0;
    for (const particle of this.particles) {
      particle.active = false;
      this.available.push(particle);
    }
  }

  emit(x, y, vx, vy, power, spread = 0) {
    if (!(power > 0) || this.random() >= this.emissionRate * power / (power + 24)) return false;
    // Rebuild only when exhausted. Expiration leaves slots inactive in place.
    if (!this.available.length) {
      for (const particle of this.particles) if (!particle.active) this.available.push(particle);
    }
    const particle = this.available.pop();
    if (!particle) return false;
    const offset = this.random() * Math.PI * 2;
    Object.assign(particle, {active: true, x: x + Math.cos(offset) * spread,
      y: y + Math.sin(offset) * spread, vx, vy,
      age: 0, life: 120 + Math.floor(this.random() * 121)});
    return true;
  }

  move() {
    for (const particle of this.particles) {
      if (!particle.active) continue;
      if (++particle.age >= particle.life) { particle.active = false; continue; }
      const speed = Math.hypot(particle.vx, particle.vy);
      const remaining = speed > 0 ? Math.max(0, speed - 0.04) / speed : 0;
      // A fresh random push each tick changes velocity, preserving inertia.
      // Stronger than a sustained push because successive directions cancel.
      const direction = this.random() * Math.PI * 2;
      particle.vx = particle.vx * remaining + Math.cos(direction) * 0.225;
      particle.vy = particle.vy * remaining + Math.sin(direction) * 0.225;
      particle.x += particle.vx;
      particle.y += particle.vy;
    }
  }

  isActive() { return this.particles.some(particle => particle.active); }

  draw(c) {
    c.save();
    const alpha = c.globalAlpha;
    for (const particle of this.particles) {
      if (!particle.active) continue;
      c.globalAlpha = alpha * Math.min(1, (particle.life - particle.age) / 60);
      // Dark orange edges retain their hue through bloom; the tiny core is hot.
      for (const [radius, color] of emberLayers) {
        c.fillStyle = color;
        c.beginPath(); c.arc(particle.x, particle.y, radius, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
  }
}

// Weapon flames and burning creeps have independent capacity and emission rates.
// Empty systems leave the effects list and rejoin when they next emit.
var emberSystem = new EmberSystem();
var burningEmberSystem = new EmberSystem({capacity: 500, emissionRate: 0.14});
function emitPooledEmber(system, x, y, vx, vy, power, spread) {
  const registered = particleSystems.includes(system);
  if (!registered && particleSystems.length >= 64) return false;
  if (!system.emit(x, y, vx, vy, power, spread)) return false;
  if (!registered) particleSystems.push(system);
  return true;
}
function emitEmber(x, y, vx, vy, power, spread = 0) {
  return emitPooledEmber(emberSystem, x, y, vx, vy, power, spread);
}
function emitBurnEmber(x, y, vx, vy, power, spread = 0) {
  return emitPooledEmber(burningEmberSystem, x, y, vx, vy, power, spread);
}

if (typeof module !== 'undefined' && module.exports) module.exports = {EmberSystem};
