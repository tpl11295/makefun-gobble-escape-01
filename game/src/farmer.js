// The farmer: a patrolling guard with a vision cone. He walks his waypoints,
// and when he can see the turkey his suspicion grows; at full suspicion he
// gives chase, and when he loses the turkey he searches the spot, then goes
// back to his patrol. Hay bales, trees and walls block his sight.
//
// States: patrol -> suspicious -> chase -> search -> patrol.
// Events raised here: SPOTTED (a chase starts), CLOSE_CALL (a chase ends
// with the turkey still free).

import { ESCALATION, FARMER } from './config.js';
import { angleDifference, moveCircle, segmentBlocked, turnToward } from './geometry.js';

export const FARMER_EVENTS = { SPOTTED: 1, CLOSE_CALL: 2 };

export function createFarmer(layout, escalation) {
  const start = layout.farmerWaypoints[0];
  return {
    x: start.x,
    y: start.y,
    radius: FARMER.radius,
    angle: 0,
    state: 'patrol',
    waypointIndex: 1,
    alert: 0,
    targetX: layout.farmerWaypoints[1].x,
    targetY: layout.farmerWaypoints[1].y,
    lastSeenX: start.x,
    lastSeenY: start.y,
    stateTimer: 0,
    lostSightTimer: 0,
    wanderTimer: 0,
    speedMul: 1 + escalation * ESCALATION.farmerSpeed,
    visionRange: FARMER.visionRange + escalation * ESCALATION.visionRange,
    bobPhase: 0,
    moving: false,
  };
}

/** Can the farmer see the turkey from where he stands, facing where he faces? */
export function farmerSeesTurkey(farmer, turkey, layout) {
  const dx = turkey.x - farmer.x;
  const dy = turkey.y - farmer.y;
  const dist = Math.hypot(dx, dy);
  if (dist > farmer.visionRange) return false;
  const angleTo = Math.atan2(dy, dx);
  if (Math.abs(angleDifference(farmer.angle, angleTo)) > FARMER.visionHalfAngle) return false;
  if (segmentBlocked(farmer.x, farmer.y, turkey.x, turkey.y, layout)) return false;
  return true;
}

function farmerSpeed(farmer) {
  if (farmer.state === 'chase') return FARMER.chaseSpeed * farmer.speedMul;
  if (farmer.state === 'search') return FARMER.searchSpeed * farmer.speedMul;
  return FARMER.patrolSpeed * farmer.speedMul;
}

function walkToward(farmer, tx, ty, dt, layout) {
  const dx = tx - farmer.x;
  const dy = ty - farmer.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return true;
  const speed = farmerSpeed(farmer);
  const step = Math.min(dist, speed * dt);
  farmer.moving = moveCircle(farmer, (dx / dist) * step, (dy / dist) * step, layout);
  farmer.angle = turnToward(farmer.angle, Math.atan2(dy, dx), dt * 6);
  return dist <= speed * dt + 4;
}

export function updateFarmer(farmer, turkey, layout, random, dt, events) {
  const sees = turkey.alive && farmerSeesTurkey(farmer, turkey, layout);
  if (sees) {
    farmer.lastSeenX = turkey.x;
    farmer.lastSeenY = turkey.y;
    farmer.lostSightTimer = 0;
    farmer.alert = Math.min(1, farmer.alert + dt / FARMER.spotTime);
  } else {
    farmer.lostSightTimer += dt;
    farmer.alert = Math.max(0, farmer.alert - dt / 0.8);
  }
  farmer.bobPhase += dt * (farmer.moving ? 9 : 3);
  farmer.stateTimer += dt;

  if (farmer.state === 'patrol') {
    if (farmer.alert >= 1) {
      farmer.state = 'chase';
      farmer.stateTimer = 0;
      events.add(FARMER_EVENTS.SPOTTED);
    } else if (farmer.alert > 0.25 && !sees) {
      farmer.state = 'suspicious';
      farmer.stateTimer = 0;
      farmer.targetX = farmer.lastSeenX;
      farmer.targetY = farmer.lastSeenY;
    } else {
      const arrived = walkToward(farmer, farmer.targetX, farmer.targetY, dt, layout);
      if (arrived) {
        farmer.waypointIndex = (farmer.waypointIndex + 1) % layout.farmerWaypoints.length;
        const next = layout.farmerWaypoints[farmer.waypointIndex];
        farmer.targetX = next.x;
        farmer.targetY = next.y;
      }
    }
  } else if (farmer.state === 'suspicious') {
    if (farmer.alert >= 1) {
      farmer.state = 'chase';
      farmer.stateTimer = 0;
      events.add(FARMER_EVENTS.SPOTTED);
    } else {
      const arrived = walkToward(farmer, farmer.targetX, farmer.targetY, dt, layout);
      if (arrived || farmer.stateTimer > FARMER.investigateTime) {
        farmer.state = 'patrol';
        farmer.stateTimer = 0;
        const next = layout.farmerWaypoints[farmer.waypointIndex];
        farmer.targetX = next.x;
        farmer.targetY = next.y;
      }
    }
  } else if (farmer.state === 'chase') {
    if (sees) {
      farmer.targetX = turkey.x;
      farmer.targetY = turkey.y;
    }
    walkToward(farmer, farmer.targetX, farmer.targetY, dt, layout);
    if (farmer.lostSightTimer > FARMER.loseSightTime) {
      farmer.state = 'search';
      farmer.stateTimer = 0;
      farmer.wanderTimer = 0;
      events.add(FARMER_EVENTS.CLOSE_CALL);
    }
  } else if (farmer.state === 'search') {
    farmer.wanderTimer -= dt;
    if (farmer.wanderTimer <= 0) {
      farmer.targetX = farmer.lastSeenX + (random() - 0.5) * 140;
      farmer.targetY = farmer.lastSeenY + (random() - 0.5) * 140;
      farmer.wanderTimer = 1.2;
    }
    walkToward(farmer, farmer.targetX, farmer.targetY, dt, layout);
    if (farmer.stateTimer > FARMER.searchTime) {
      farmer.state = 'patrol';
      farmer.stateTimer = 0;
      farmer.alert = 0;
      const next = layout.farmerWaypoints[farmer.waypointIndex];
      farmer.targetX = next.x;
      farmer.targetY = next.y;
    }
  }
}
