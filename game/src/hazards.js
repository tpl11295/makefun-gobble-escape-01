// The yard's two traps: the carving knife that sweeps its rail, and the brick
// oven whose glow builds heat in any turkey standing too close.
//
// A knife waits at each end of its rail, then sweeps to the other end; the
// telegraph is the rail itself, brightened just before the blade moves. The
// oven is solid brick — the heat zone is the glow around its mouth.

import { ESCALATION, KNIFE, OVEN } from './config.js';
import { circleHitsRect, distance } from './geometry.js';

export function createKnives(rails, escalation) {
  return rails.map((rail) => {
    const length = Math.hypot(rail.x2 - rail.x1, rail.y2 - rail.y1);
    return {
      rail,
      length,
      t: 0.5,
      direction: 1,
      pauseTimer: KNIFE.pause,
      baseSpeed: KNIFE.sweepSpeed * (1 + escalation * ESCALATION.knifeSpeed),
      speed: KNIFE.sweepSpeed * (1 + escalation * ESCALATION.knifeSpeed),
      horizontal: Math.abs(rail.x2 - rail.x1) >= Math.abs(rail.y2 - rail.y1),
      x: (rail.x1 + rail.x2) / 2,
      y: (rail.y1 + rail.y2) / 2,
      aboutToMove: false,
    };
  });
}

export function updateKnives(knives, dt) {
  for (const knife of knives) {
    knife.aboutToMove = false;
    if (knife.pauseTimer > 0) {
      knife.pauseTimer -= dt;
      if (knife.pauseTimer <= 0.3) knife.aboutToMove = true;
      if (knife.pauseTimer <= 0) knife.direction *= -1;
      continue;
    }
    knife.t += (knife.direction * knife.speed * dt) / knife.length;
    if (knife.t >= 1) {
      knife.t = 1;
      knife.pauseTimer = KNIFE.pause;
    } else if (knife.t <= 0) {
      knife.t = 0;
      knife.pauseTimer = KNIFE.pause;
    }
    knife.x = knife.rail.x1 + (knife.rail.x2 - knife.rail.x1) * knife.t;
    knife.y = knife.rail.y1 + (knife.rail.y2 - knife.rail.y1) * knife.t;
  }
}

/** The blade's hit box, as a rectangle the turkey's circle is tested against. */
export function knifeHitBox(knife) {
  if (knife.horizontal) {
    return { x: knife.x - KNIFE.width / 2, y: knife.y - KNIFE.height / 2, w: KNIFE.width, h: KNIFE.height };
  }
  return { x: knife.x - KNIFE.height / 2, y: knife.y - KNIFE.width / 2, w: KNIFE.height, h: KNIFE.width };
}

export function knifeHitsTurkey(knife, turkey) {
  return circleHitsRect(turkey.x, turkey.y, turkey.radius - 4, knifeHitBox(knife));
}

/** Is the turkey standing in the oven's heat? */
export function turkeyInOvenHeat(turkey, oven) {
  return distance(turkey.x, turkey.y, oven.glowX, oven.glowY) < OVEN.radius;
}
