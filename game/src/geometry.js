// Small 2D geometry helpers the rules use: moving circles that slide along
// walls, and the line-of-sight test behind the farmer's vision cone.

import { FIELD } from './config.js';

/** Distance between two points. */
export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** Shortest distance from a point to a segment. */
export function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  let t = 0;
  if (lengthSquared > 0) t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Does the segment a→b cross any solid rectangle or circle of the layout? */
export function segmentBlocked(ax, ay, bx, by, layout) {
  for (const wall of layout.walls) {
    if (segmentHitsRect(ax, ay, bx, by, wall)) return true;
  }
  for (const circle of [...layout.hay, ...layout.trees]) {
    if (pointSegmentDistance(circle.x, circle.y, ax, ay, bx, by) < circle.r) return true;
  }
  return false;
}

/** Slab test: does the segment cross the rectangle? */
export function segmentHitsRect(ax, ay, bx, by, rect) {
  const dx = bx - ax;
  const dy = by - ay;
  let tMin = 0;
  let tMax = 1;
  for (const [origin, delta, lo, hi] of [
    [ax, dx, rect.x, rect.x + rect.w],
    [ay, dy, rect.y, rect.y + rect.h],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < lo || origin > hi) return false;
    } else {
      let t1 = (lo - origin) / delta;
      let t2 = (hi - origin) / delta;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

/** Is the point inside the rectangle (with a margin)? */
export function pointInRect(x, y, rect, margin = 0) {
  return x >= rect.x - margin && x <= rect.x + rect.w + margin && y >= rect.y - margin && y <= rect.y + rect.h + margin;
}

/**
 * Move a circle by (dx, dy), sliding along walls and hay bales instead of
 * sticking: each axis is tried on its own, so a diagonal push along a wall
 * still glides. Returns true when the circle actually moved.
 */
export function moveCircle(entity, dx, dy, layout) {
  let moved = false;
  const nextX = entity.x + dx;
  if (!circleBlocked(nextX, entity.y, entity.radius, layout)) {
    entity.x = nextX;
    moved = true;
  }
  const nextY = entity.y + dy;
  if (!circleBlocked(entity.x, nextY, entity.radius, layout)) {
    entity.y = nextY;
    moved = true;
  }
  entity.x = Math.max(entity.radius, Math.min(FIELD.width - entity.radius, entity.x));
  entity.y = Math.max(entity.radius, Math.min(FIELD.height - entity.radius, entity.y));
  return moved;
}

/** Would a circle at (x, y) overlap a wall, hay bale or tree? */
export function circleBlocked(x, y, radius, layout) {
  for (const wall of layout.walls) {
    const nearestX = Math.max(wall.x, Math.min(x, wall.x + wall.w));
    const nearestY = Math.max(wall.y, Math.min(y, wall.y + wall.h));
    if (Math.hypot(x - nearestX, y - nearestY) < radius) return true;
  }
  for (const circle of [...layout.hay, ...layout.trees]) {
    if (Math.hypot(x - circle.x, y - circle.y) < radius + circle.r) return true;
  }
  return false;
}

/** Does a circle overlap a rectangle? */
export function circleHitsRect(x, y, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  return Math.hypot(x - nearestX, y - nearestY) < radius;
}

/** Smallest signed turn from angle a to angle b, in (-PI, PI]. */
export function angleDifference(a, b) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff <= -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** Turn `angle` toward `target` by at most `maxStep` radians. */
export function turnToward(angle, target, maxStep) {
  const diff = angleDifference(angle, target);
  if (Math.abs(diff) <= maxStep) return target;
  return angle + Math.sign(diff) * maxStep;
}
