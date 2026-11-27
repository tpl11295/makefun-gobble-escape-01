// The world: everything the game is, in one place, stepped in fixed 1/60 s
// ticks. A run is one turkey against one yard: collect three golden corn cobs
// while the farmer patrols, the knife sweeps and the oven glows; then the
// forest gate opens and the turkey runs for it. Escape a yard and the next
// one is harder (Night, then Dawn); escape all three and the turkey is free.
//
// Events are plain strings in world.events, read and cleared by main.js each
// frame so sounds and banners stay outside the rules.

import {
  CLOSE_CALL_POINTS,
  CORN,
  ESCALATION,
  FARMER,
  FIELD,
  LIVES,
  OVEN,
  STEP,
} from './config.js';
import { createRandom } from './random.js';
import { buildLevel, LEVEL_COUNT } from './levels.js';
import { createFarmer, FARMER_EVENTS, updateFarmer } from './farmer.js';
import { createTurkey, hurtTurkey, updateTurkey } from './turkey.js';
import { createKnives, knifeHitsTurkey, turkeyInOvenHeat, updateKnives } from './hazards.js';
import { circleHitsRect, distance } from './geometry.js';

export const WORLD_EVENTS = {
  SPOTTED: 'spotted',
  CLOSE_CALL: 'closeCall',
  CORN: 'corn',
  HIT: 'hit',
  GATE_OPEN: 'gateOpen',
  ESCAPED: 'escaped',
  CAUGHT: 'caught',
  DASH: 'dash',
};

export function createWorld(seed, level = 1) {
  const rng = createRandom(seed);
  const layout = buildLevel(level, rng);
  return {
    seed,
    level,
    layout,
    rng,
    turkey: createTurkey(layout.turkeyStart),
    farmer: createFarmer(layout, 0),
    knives: createKnives(layout.knifeRails, 0),
    corn: layout.cornSpots.map((spot, index) => ({ ...spot, taken: false, phase: index * 2.1 })),
    time: 0,
    score: 0,
    best: 0,
    state: 'title',
    outcome: null,
    heat: 0,
    inHeat: false,
    gateOpen: false,
    cornCollected: 0,
    particles: [],
    popups: [],
    banner: null,
    shake: 0,
    flash: 0,
    events: [],
    stats: { cornTaken: 0, closeCalls: 0, dashes: 0 },
    maxGateDistance: distance(layout.turkeyStart.x, layout.turkeyStart.y, layout.gate.x, layout.gate.y),
  };
}

/** Start a fresh run on the same yard (used after a caught turkey restarts). */
export function resetWorld(world, level = 1) {
  const fresh = createWorld(world.seed, level);
  fresh.best = world.best;
  return fresh;
}

function addPopup(world, x, y, text, color) {
  world.popups.push({ x, y, text, color, life: 1.2 });
}

function setBanner(world, text, color, seconds = 1.6) {
  world.banner = { text, color, timer: seconds, age: 0 };
}

function addParticles(world, kind, x, y, count, color, speed = 90, size = 4, life = 0.7) {
  for (let index = 0; index < count; index += 1) {
    const angle = world.rng() * Math.PI * 2;
    const velocity = speed * (0.4 + world.rng() * 0.8);
    world.particles.push({
      kind,
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - (kind === 'feather' ? 40 : 0),
      life: life * (0.6 + world.rng() * 0.7),
      maxLife: life,
      size: size * (0.7 + world.rng() * 0.6),
      color,
    });
  }
}

function updateParticles(world, dt) {
  for (const particle of world.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    if (particle.kind === 'feather') particle.vy += 260 * dt;
    if (particle.kind === 'ember') {
      particle.vy -= 30 * dt;
      particle.vx += Math.sin(particle.life * 9) * 12 * dt;
    }
  }
  world.particles = world.particles.filter((particle) => particle.life > 0);
  for (const popup of world.popups) {
    popup.life -= dt;
    popup.y -= 26 * dt;
  }
  world.popups = world.popups.filter((popup) => popup.life > 0);
  if (world.banner) {
    world.banner.timer -= dt;
    world.banner.age += dt;
    if (world.banner.timer <= 0) world.banner = null;
  }
  world.shake = Math.max(0, world.shake - dt * 26);
  world.flash = Math.max(0, world.flash - dt * 2.2);
}

/** The title screen's yard: the farmer walks his patrol, the knife sweeps, the oven glows. */
export function stepAmbient(world, dt) {
  const decoy = { x: -1000, y: -1000, alive: false };
  const events = new Set();
  updateFarmer(world.farmer, decoy, world.layout, world.rng, dt, events);
  updateKnives(world.knives, dt);
  world.time += dt;
  if (world.rng() < dt * 14) {
    addParticles(world, 'ember', world.layout.oven.glowX + (world.rng() - 0.5) * 40, world.layout.oven.glowY + (world.rng() - 0.5) * 20, 1, '#ff9a3c', 24, 3, 1.1);
  }
  updateParticles(world, dt);
}

function applyEscalation(world) {
  const escalation = world.cornCollected;
  world.farmer.speedMul = 1 + escalation * ESCALATION.farmerSpeed;
  world.farmer.visionRange = FARMER.visionRange + escalation * ESCALATION.visionRange;
  for (const knife of world.knives) {
    knife.speed = knife.baseSpeed * (1 + escalation * ESCALATION.knifeSpeed);
  }
}

/** One fixed step of a run in play. */
export function stepWorld(world, input, dt) {
  if (world.state !== 'play') return;
  world.time += dt;

  const effects = {
    dash: (x, y) => {
      world.stats.dashes += 1;
      world.events.push(WORLD_EVENTS.DASH);
      addParticles(world, 'dust', x, y, 8, '#c9b18a', 70, 5, 0.5);
    },
    hit: (x, y) => {
      world.events.push(WORLD_EVENTS.HIT);
      world.shake = 14;
      world.flash = 0.55;
      addParticles(world, 'feather', x, y, 14, '#f4efe2', 130, 5, 0.9);
      addParticles(world, 'feather', x, y, 6, '#8a5230', 100, 4, 0.8);
    },
  };

  updateTurkey(world.turkey, input, world.layout, dt, effects);

  const farmerEvents = new Set();
  updateFarmer(world.farmer, world.turkey, world.layout, world.rng, dt, farmerEvents);
  if (farmerEvents.has(FARMER_EVENTS.SPOTTED)) {
    world.events.push(WORLD_EVENTS.SPOTTED);
    setBanner(world, 'SPOTTED!', '#ff3b30', 1.4);
  }
  if (farmerEvents.has(FARMER_EVENTS.CLOSE_CALL)) {
    world.events.push(WORLD_EVENTS.CLOSE_CALL);
    world.stats.closeCalls += 1;
    world.score += CLOSE_CALL_POINTS;
    addPopup(world, world.turkey.x, world.turkey.y - 30, `CLOSE CALL +${CLOSE_CALL_POINTS}`, '#7ed957');
    setBanner(world, 'Lost him… for now.', '#7ed957', 1.4);
  }

  updateKnives(world.knives, dt);

  // The oven: heat builds in the glow, cools outside it, costs a life at full.
  world.inHeat = world.turkey.alive && turkeyInOvenHeat(world.turkey, world.layout.oven);
  if (world.inHeat) {
    world.heat = Math.min(1, world.heat + OVEN.heatRate * dt);
    if (world.rng() < dt * 20) {
      addParticles(world, 'ember', world.turkey.x + (world.rng() - 0.5) * 30, world.turkey.y + (world.rng() - 0.5) * 30, 1, '#ffb347', 30, 3, 0.7);
    }
    if (world.heat >= 1) {
      world.heat = 0.3;
      if (hurtTurkey(world.turkey, world.layout.oven.glowX, world.layout.oven.glowY, effects)) {
        setBanner(world, 'TOO HOT! The oven burns!', '#ff7a1a', 1.4);
        checkCaught(world);
      }
    }
  } else {
    world.heat = Math.max(0, world.heat - OVEN.coolRate * dt);
  }

  // Corn cobs.
  for (const cob of world.corn) {
    if (!cob.taken && distance(world.turkey.x, world.turkey.y, cob.x, cob.y) < CORN.radius + world.turkey.radius) {
      cob.taken = true;
      world.cornCollected += 1;
      world.stats.cornTaken += 1;
      world.score += CORN.points;
      world.events.push(WORLD_EVENTS.CORN);
      addPopup(world, cob.x, cob.y - 24, `+${CORN.points}`, '#f2c94c');
      addParticles(world, 'spark', cob.x, cob.y, 10, '#f2c94c', 90, 4, 0.6);
      applyEscalation(world);
      if (world.cornCollected >= CORN.total) {
        world.gateOpen = true;
        world.events.push(WORLD_EVENTS.GATE_OPEN);
        setBanner(world, 'THE GATE IS OPEN — RUN!', '#7ed957', 2.2);
        const gate = world.layout.gate;
        addParticles(world, 'spark', gate.x + 20, gate.y + 40, 18, '#7ed957', 110, 4, 1);
      } else {
        setBanner(world, `Corn ${world.cornCollected} of ${CORN.total} — the farmer stirs…`, '#ffd94d', 1.4);
      }
    }
  }

  // The farmer catches the turkey.
  if (world.turkey.alive && distance(world.turkey.x, world.turkey.y, world.farmer.x, world.farmer.y) < world.farmer.radius + world.turkey.radius - 4) {
    if (hurtTurkey(world.turkey, world.farmer.x, world.farmer.y, effects)) {
      setBanner(world, 'Caught by the farmer!', '#ff3b30', 1.4);
      checkCaught(world);
    }
  }

  // The carving knife.
  for (const knife of world.knives) {
    if (world.turkey.alive && knifeHitsTurkey(knife, world.turkey)) {
      if (hurtTurkey(world.turkey, knife.x, knife.y, effects)) {
        setBanner(world, 'The carving knife!', '#ff3b30', 1.4);
        checkCaught(world);
      }
    }
  }

  // The gate: only when it stands open.
  if (world.gateOpen && world.turkey.alive) {
    const gate = world.layout.gate;
    if (circleHitsRect(world.turkey.x, world.turkey.y, world.turkey.radius - 2, gate)) {
      const timeBonus = Math.max(0, 300 - Math.floor(world.time * 2));
      const lifeBonus = 50 * world.turkey.lives;
      world.score += 300 + timeBonus + lifeBonus;
      world.outcome = 'escaped';
      world.state = 'over';
      world.events.push(WORLD_EVENTS.ESCAPED);
      addParticles(world, 'spark', world.turkey.x, world.turkey.y, 24, '#7ed957', 140, 5, 1);
    }
  }

  // Ambient oven embers keep the yard alive.
  if (world.rng() < dt * 10) {
    addParticles(world, 'ember', world.layout.oven.glowX + (world.rng() - 0.5) * 40, world.layout.oven.glowY + (world.rng() - 0.5) * 20, 1, '#ff9a3c', 24, 3, 1.1);
  }

  updateParticles(world, dt);
}

function checkCaught(world) {
  if (!world.turkey.alive) {
    world.outcome = 'caught';
    world.state = 'over';
    world.events.push(WORLD_EVENTS.CAUGHT);
  }
}

/** How close the turkey is to the gate, 0 (far) to 1 (at it). */
export function gateProgress(world) {
  const gate = world.layout.gate;
  const dist = distance(world.turkey.x, world.turkey.y, gate.x + 20, gate.y + 40);
  return Math.max(0, Math.min(1, 1 - dist / world.maxGateDistance));
}

/** The escape bonus line for the end screen. */
export function escapeBonus(world) {
  const timeBonus = Math.max(0, 300 - Math.floor(world.time * 2));
  return { base: 300, timeBonus, lifeBonus: 50 * Math.max(0, world.turkey.lives) };
}

/** Staging helpers for the deterministic screenshot scenes. */
export function forceChase(world) {
  world.farmer.state = 'chase';
  world.farmer.alert = 1;
  world.farmer.lostSightTimer = 0;
  world.farmer.targetX = world.turkey.x;
  world.farmer.targetY = world.turkey.y;
  setBanner(world, 'SPOTTED!', '#ff3b30', 99);
}

/** Place the turkey at the gate with every cob taken: a valid escaped state. */
export function forceEscaped(world) {
  for (const cob of world.corn) cob.taken = true;
  world.cornCollected = CORN.total;
  world.gateOpen = true;
  world.turkey.alive = true;
  world.turkey.lives = Math.max(1, world.turkey.lives);
  world.turkey.invulnerable = 0;
  world.turkey.x = world.layout.gate.x + 8;
  world.turkey.y = world.layout.gate.y + 40;
  world.turkey.angle = 0;
  world.heat = 0;
  world.flash = 0;
  world.shake = 0;
  world.banner = null;
  world.score = 480;
  world.time = 74;
  world.outcome = 'escaped';
  world.state = 'over';
  addParticles(world, 'spark', world.turkey.x, world.turkey.y, 24, '#7ed957', 140, 5, 1);
}

export { STEP, LIVES, LEVEL_COUNT };
