// The four screenshot scenes, staged deterministically from one seed, so the
// same seed always takes the same pictures: the title over a live yard, a
// stealth run in play, a chase with the farmer on the turkey's tail, and the
// escape at the forest gate. The autopilot plays the game for real — it
// steers for the nearest corn, sidesteps out of the farmer's vision cone
// before he spots the turkey, flees a chasing farmer, dodges the knife and
// shies away from the oven — and the end scene falls back to a constructed
// escaped state only if the autopilot has not escaped on its own in 150 s,
// which is still rendered by the game's own code from a valid world state.

import { CORN, FARMER, STEP } from './config.js';
import { createWorld, forceChase, forceEscaped, stepAmbient, stepWorld } from './world.js';
import { angleDifference, distance, segmentBlocked } from './geometry.js';

function nearestTarget(world) {
  const turkey = world.turkey;
  let best = null;
  let bestDistance = Infinity;
  for (const cob of world.corn) {
    if (cob.taken) continue;
    const dist = distance(turkey.x, turkey.y, cob.x, cob.y);
    if (dist < bestDistance) {
      bestDistance = dist;
      best = cob;
    }
  }
  if (best) return best;
  return { x: world.layout.gate.x + 20, y: world.layout.gate.y + 40 };
}

function autopilotInput(world, stuck) {
  const turkey = world.turkey;
  const farmer = world.farmer;
  const target = nearestTarget(world);
  let mx = target.x - turkey.x;
  let my = target.y - turkey.y;

  // Sidestep out of the farmer's vision cone before he finishes spotting
  // the turkey: slip sideways across his line of sight, not toward him.
  const farmerDistance = distance(turkey.x, turkey.y, farmer.x, farmer.y);
  const angleToTurkey = Math.atan2(turkey.y - farmer.y, turkey.x - farmer.x);
  const inCone =
    farmerDistance < farmer.visionRange + 40 &&
    Math.abs(angleDifference(farmer.angle, angleToTurkey)) < FARMER.visionHalfAngle + 0.15 &&
    !segmentBlocked(farmer.x, farmer.y, turkey.x, turkey.y, world.layout);
  if (inCone && farmer.alert > 0.12 && farmer.state !== 'chase') {
    const perpendicular = farmer.angle + Math.PI / 2;
    const side = Math.sign(angleDifference(farmer.angle, angleToTurkey)) || 1;
    mx = Math.cos(perpendicular) * side * 2 + (target.x - turkey.x) * 0.002;
    my = Math.sin(perpendicular) * side * 2 + (target.y - turkey.y) * 0.002;
  }

  // A chasing farmer outranks the corn: run away, and drift toward the gate.
  if ((farmer.state === 'chase' || farmer.alert > 0.25) && farmerDistance < 200) {
    mx = turkey.x - farmer.x + (world.layout.gate.x - turkey.x) * 0.3;
    my = turkey.y - farmer.y + (world.layout.gate.y + 40 - turkey.y) * 0.3;
  }
  // Step sideways out of a sweeping knife's path.
  for (const knife of world.knives) {
    const knifeDistance = distance(turkey.x, turkey.y, knife.x, knife.y);
    if (knifeDistance < 90) {
      if (knife.horizontal) my += (turkey.y - knife.y) * 1.4;
      else mx += (turkey.x - knife.x) * 1.4;
    }
  }
  // Keep out of the oven's glow.
  const oven = world.layout.oven;
  const ovenDistance = distance(turkey.x, turkey.y, oven.glowX, oven.glowY);
  if (ovenDistance < 120) {
    mx += (turkey.x - oven.glowX) * 1.6;
    my += (turkey.y - oven.glowY) * 1.6;
  }
  // When wedged against a fence, try the perpendicular way for a while.
  if (stuck.detour > 0) {
    stuck.detour -= 1;
    const swap = mx;
    mx = -my;
    my = swap;
  }
  const length = Math.hypot(mx, my) || 1;
  return {
    mx: mx / length,
    my: my / length,
    dash: (farmer.state === 'chase' || farmer.alert > 0.6) && turkey.dashCooldown <= 0,
  };
}

/**
 * Play the world with the autopilot for up to `seconds`. Returns 'survived'
 * when the time ran out with the turkey still free, 'escaped' when the run
 * ended at the gate, or 'caught' when the turkey ran out of lives.
 */
function runAutopilot(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  const stuck = { detour: 0, lastX: world.turkey.x, lastY: world.turkey.y, stillFrames: 0 };
  for (let index = 0; index < steps; index += 1) {
    if (world.state !== 'play') break;
    stepWorld(world, autopilotInput(world, stuck), STEP);
    const moved = distance(world.turkey.x, world.turkey.y, stuck.lastX, stuck.lastY);
    if (moved < 0.5) stuck.stillFrames += 1;
    else stuck.stillFrames = 0;
    if (stuck.stillFrames > 90 && stuck.detour <= 0) {
      stuck.detour = 60;
      stuck.stillFrames = 0;
    }
    if (index % 30 === 0) {
      stuck.lastX = world.turkey.x;
      stuck.lastY = world.turkey.y;
    }
  }
  if (world.state === 'over') return world.outcome === 'escaped' ? 'escaped' : 'caught';
  return 'survived';
}

/** A frame worth picturing: a few seconds in, corn in hand, the farmer calm, the turkey free. */
function isStealthFrame(world) {
  return (
    world.state === 'play' &&
    world.time > 4 &&
    world.cornCollected >= 1 &&
    world.farmer.state === 'patrol' &&
    distance(world.turkey.x, world.turkey.y, world.farmer.x, world.farmer.y) > 150 &&
    world.turkey.invulnerable <= 0
  );
}

/**
 * Stage one named scene. Returns the world and the screen it should be
 * painted on ('title', 'play' or 'over').
 */
export function stageShot(name, seed) {
  if (name === 'start') {
    const world = createWorld(seed, 1);
    world.state = 'title';
    for (let index = 0; index < 5 * 60; index += 1) stepAmbient(world, STEP);
    return { world, screen: 'title' };
  }

  if (name === 'play') {
    // Play until a stealth frame shows up; a run that ends first is thrown
    // away and tried again, so the picture is always a run in play.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const world = createWorld(seed + attempt, 1);
      world.state = 'play';
      const steps = Math.floor(24 / STEP);
      const stuck = { detour: 0, lastX: world.turkey.x, lastY: world.turkey.y, stillFrames: 0 };
      for (let index = 0; index < steps; index += 1) {
        if (world.state !== 'play') break;
        stepWorld(world, autopilotInput(world, stuck), STEP);
        if (isStealthFrame(world)) return { world, screen: 'play' };
        const moved = distance(world.turkey.x, world.turkey.y, stuck.lastX, stuck.lastY);
        if (moved < 0.5) stuck.stillFrames += 1;
        else stuck.stillFrames = 0;
        if (stuck.stillFrames > 90 && stuck.detour <= 0) {
          stuck.detour = 60;
          stuck.stillFrames = 0;
        }
        if (index % 30 === 0) {
          stuck.lastX = world.turkey.x;
          stuck.lastY = world.turkey.y;
        }
      }
    }
    // No attempt produced a stealth frame: stage one by hand from a valid
    // state — the turkey tucked behind the hay bale, the farmer on patrol.
    const world = createWorld(seed, 1);
    world.state = 'play';
    world.turkey.x = 430;
    world.turkey.y = 252;
    world.turkey.angle = Math.PI / 2;
    world.corn[0].taken = true;
    world.cornCollected = 1;
    world.score = CORN.points;
    world.time = 12;
    world.farmer.x = 300;
    world.farmer.y = 300;
    world.farmer.angle = Math.atan2(-60, 340);
    world.farmer.targetX = 640;
    world.farmer.targetY = 240;
    return { world, screen: 'play' };
  }

  if (name === 'chase') {
    const world = createWorld(seed, 1);
    world.state = 'play';
    world.turkey.x = 660;
    world.turkey.y = 280;
    world.turkey.angle = Math.atan2(40, 20);
    world.farmer.x = 640;
    world.farmer.y = 240;
    world.farmer.angle = Math.atan2(40, 20);
    world.farmer.targetX = 640;
    world.farmer.targetY = 240;
    for (let index = 0; index < 20; index += 1) stepWorld(world, { mx: 0, my: 0, dash: false }, STEP);
    forceChase(world);
    for (let index = 0; index < 45; index += 1) {
      stepWorld(world, { mx: 0.9, my: -0.3, dash: index === 0 }, STEP);
    }
    return { world, screen: 'play' };
  }

  if (name === 'end') {
    const world = createWorld(seed, 1);
    world.state = 'play';
    runAutopilot(world, 150);
    if (world.outcome !== 'escaped') forceEscaped(world);
    return { world, screen: 'over' };
  }

  throw new Error(`unknown shot: ${name}`);
}

export { CORN };
