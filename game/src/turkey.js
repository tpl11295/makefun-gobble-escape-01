// The turkey: a round bird that walks, dashes and gets knocked back. Movement
// is 8-way from the keyboard or from a held pointer; Space dashes in the
// direction of travel (or the direction the bird faces), with a short cooldown.
// A dash leaves dust; a hit leaves feathers and a brief window of safety.

import { TURKEY } from './config.js';
import { moveCircle, turnToward } from './geometry.js';

export function createTurkey(start) {
  return {
    x: start.x,
    y: start.y,
    radius: TURKEY.radius,
    angle: -Math.PI / 2,
    alive: true,
    lives: 3,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: -1,
    invulnerable: 0,
    moving: false,
    stepPhase: 0,
    squash: 0,
  };
}

export function updateTurkey(turkey, input, layout, dt, effects) {
  if (!turkey.alive) return;
  turkey.invulnerable = Math.max(0, turkey.invulnerable - dt);
  turkey.dashCooldown = Math.max(0, turkey.dashCooldown - dt);
  turkey.squash = Math.max(0, turkey.squash - dt * 4);

  const length = Math.hypot(input.mx, input.my);
  const moving = length > 0.01;
  turkey.moving = moving;

  if (input.dash && turkey.dashCooldown <= 0 && turkey.dashTimer <= 0) {
    const dirX = moving ? input.mx / length : Math.cos(turkey.angle);
    const dirY = moving ? input.my / length : Math.sin(turkey.angle);
    turkey.dashTimer = TURKEY.dashTime;
    turkey.dashCooldown = TURKEY.dashCooldown;
    turkey.dashX = dirX;
    turkey.dashY = dirY;
    turkey.squash = 1;
    effects.dash(turkey.x, turkey.y);
  }

  let speed = TURKEY.walkSpeed;
  let dirX = 0;
  let dirY = 0;
  if (turkey.dashTimer > 0) {
    turkey.dashTimer -= dt;
    speed = TURKEY.dashSpeed;
    dirX = turkey.dashX;
    dirY = turkey.dashY;
  } else if (moving) {
    dirX = input.mx / length;
    dirY = input.my / length;
  }

  if (dirX !== 0 || dirY !== 0) {
    turkey.moving = moveCircle(turkey, dirX * speed * dt, dirY * speed * dt, layout);
    turkey.angle = turnToward(turkey.angle, Math.atan2(dirY, dirX), dt * 10);
    turkey.stepPhase += dt * (turkey.dashTimer > 0 ? 18 : 10);
  }
}

/** Knock the turkey away from (fromX, fromY) and cost one life. */
export function hurtTurkey(turkey, fromX, fromY, effects) {
  if (!turkey.alive || turkey.invulnerable > 0) return false;
  turkey.lives -= 1;
  turkey.invulnerable = TURKEY.invulnerable;
  const dx = turkey.x - fromX;
  const dy = turkey.y - fromY;
  const dist = Math.hypot(dx, dy) || 1;
  turkey.x += (dx / dist) * 26;
  turkey.y += (dy / dist) * 26;
  turkey.squash = 1;
  effects.hit(turkey.x, turkey.y);
  if (turkey.lives <= 0) turkey.alive = false;
  return true;
}
