// The renderer: every pixel of the game, drawn on a canvas in a fixed 1280x720
// logical field that main.js scales to the window. The yard is drawn in layers
// — ground, light, the farmer's vision cone, buildings and cover, the actors,
// then the HUD and panels — so a hay bale can hide the turkey and a wall can
// cut the farmer's cone short, which is what makes the stealth read.

import { CLOSE_CALL_POINTS, CORN, FIELD, FONT, LIVES, OVEN, PALETTE } from './config.js';
import { escapeBonus, gateProgress } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function pointBlocked(x, y, layout) {
  for (const wall of layout.walls) {
    if (x >= wall.x && x <= wall.x + wall.w && y >= wall.y && y <= wall.y + wall.h) return true;
  }
  for (const circle of [...layout.hay, ...layout.trees]) {
    if (Math.hypot(x - circle.x, y - circle.y) < circle.r) return true;
  }
  return false;
}

function text(ctx, value, x, y, size, color, weight = 700, align = 'center') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

function shadowedText(ctx, value, x, y, size, color, weight = 800, align = 'center') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(20, 24, 16, 0.65)';
  ctx.fillText(value, x + 2, y + 3);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function drawGround(ctx, world) {
  const { layout } = world;
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  for (const speckle of layout.speckles) {
    ctx.fillStyle = speckle.dark ? PALETTE.grassDark : PALETTE.grassLight;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(speckle.x, speckle.y, speckle.r, speckle.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const path of layout.paths) {
    ctx.fillStyle = PALETTE.dirt;
    roundRect(ctx, path.x, path.y, path.w, path.h, 18);
    ctx.fill();
    ctx.fillStyle = PALETTE.dirtDark;
    ctx.globalAlpha = 0.4;
    for (let x = path.x + 14; x < path.x + path.w - 10; x += 46) {
      ctx.beginPath();
      ctx.ellipse(x, path.y + path.h / 2 + ((x * 7) % 13) - 6, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  for (const leaf of layout.leaves) {
    ctx.save();
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate(leaf.angle);
    ctx.fillStyle = leaf.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // The yard's border fence, with a gap where the forest gate stands.
  ctx.strokeStyle = PALETTE.fence;
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, FIELD.width - 8, FIELD.height - 8);
  ctx.fillStyle = PALETTE.fenceDark;
  const gate = layout.gate;
  for (let x = 24; x < FIELD.width; x += 64) {
    ctx.fillRect(x - 3, 1, 6, 12);
    ctx.fillRect(x - 3, FIELD.height - 13, 6, 12);
  }
  for (let y = 24; y < FIELD.height; y += 64) {
    ctx.fillRect(1, y - 3, 12, 6);
    if (y < gate.y - 10 || y > gate.y + gate.h + 10) ctx.fillRect(FIELD.width - 13, y - 3, 12, 6);
  }
}

function drawOvenGlow(ctx, world, time) {
  const oven = world.layout.oven;
  const flicker = 0.75 + Math.sin(time * 7) * 0.1 + Math.sin(time * 13) * 0.05;
  const gradient = ctx.createRadialGradient(oven.glowX, oven.glowY, 8, oven.glowX, oven.glowY, OVEN.radius + 46);
  gradient.addColorStop(0, `rgba(255, 122, 26, ${0.5 * flicker})`);
  gradient.addColorStop(0.55, `rgba(255, 122, 26, ${0.16 * flicker})`);
  gradient.addColorStop(1, 'rgba(255, 122, 26, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(oven.glowX, oven.glowY, OVEN.radius + 46, 0, Math.PI * 2);
  ctx.fill();
}

function drawGateGlow(ctx, world) {
  if (!world.gateOpen) return;
  const gate = world.layout.gate;
  const gradient = ctx.createRadialGradient(gate.x + 20, gate.y + 40, 6, gate.x + 20, gate.y + 40, 130);
  gradient.addColorStop(0, 'rgba(126, 217, 87, 0.55)');
  gradient.addColorStop(1, 'rgba(126, 217, 87, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(gate.x + 20, gate.y + 40, 130, 0, Math.PI * 2);
  ctx.fill();
}

function drawVisionCone(ctx, world) {
  const farmer = world.farmer;
  const { layout } = world;
  const color =
    farmer.state === 'chase'
      ? 'rgba(255, 59, 48, 0.24)'
      : farmer.state === 'suspicious' || farmer.state === 'search'
        ? 'rgba(255, 159, 28, 0.18)'
        : 'rgba(255, 217, 77, 0.12)';
  const rays = 28;
  const half = 0.96;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(farmer.x, farmer.y);
  for (let index = 0; index <= rays; index += 1) {
    const angle = farmer.angle - half + (2 * half * index) / rays;
    let reach = farmer.visionRange;
    for (let step = 10; step <= farmer.visionRange; step += 8) {
      const x = farmer.x + Math.cos(angle) * step;
      const y = farmer.y + Math.sin(angle) * step;
      if (pointBlocked(x, y, layout)) {
        reach = Math.max(0, step - 8);
        break;
      }
    }
    ctx.lineTo(farmer.x + Math.cos(angle) * reach, farmer.y + Math.sin(angle) * reach);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color.replace(/0\.\d+\)$/, '0.5)');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(farmer.x, farmer.y);
  ctx.lineTo(farmer.x + Math.cos(farmer.angle - half) * farmer.visionRange * 0.9, farmer.y + Math.sin(farmer.angle - half) * farmer.visionRange * 0.9);
  ctx.moveTo(farmer.x, farmer.y);
  ctx.lineTo(farmer.x + Math.cos(farmer.angle + half) * farmer.visionRange * 0.9, farmer.y + Math.sin(farmer.angle + half) * farmer.visionRange * 0.9);
  ctx.stroke();
}

function drawBarn(ctx, wall) {
  ctx.fillStyle = PALETTE.barn;
  ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  ctx.fillStyle = PALETTE.barnRoof;
  ctx.beginPath();
  ctx.moveTo(wall.x - 8, wall.y);
  ctx.lineTo(wall.x + wall.w / 2, wall.y - 44);
  ctx.lineTo(wall.x + wall.w + 8, wall.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = PALETTE.barnTrim;
  ctx.lineWidth = 5;
  ctx.strokeRect(wall.x + 8, wall.y + 8, wall.w - 16, wall.h - 16);
  ctx.beginPath();
  ctx.moveTo(wall.x + 8, wall.y + 8);
  ctx.lineTo(wall.x + wall.w - 8, wall.y + wall.h - 8);
  ctx.moveTo(wall.x + wall.w - 8, wall.y + 8);
  ctx.lineTo(wall.x + 8, wall.y + wall.h - 8);
  ctx.stroke();
  ctx.fillStyle = PALETTE.barnTrim;
  ctx.fillRect(wall.x + wall.w / 2 - 26, wall.y + wall.h - 58, 52, 50);
  ctx.fillStyle = PALETTE.barnRoof;
  ctx.fillRect(wall.x + wall.w / 2 - 20, wall.y + wall.h - 52, 40, 44);
  text(ctx, 'BARN', wall.x + wall.w / 2, wall.y + 34, 20, PALETTE.barnTrim, 800);
}

function drawFarmhouse(ctx, wall) {
  ctx.fillStyle = PALETTE.farmhouse;
  ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  ctx.fillStyle = PALETTE.farmhouseRoof;
  ctx.beginPath();
  ctx.moveTo(wall.x - 8, wall.y);
  ctx.lineTo(wall.x + wall.w / 2, wall.y - 40);
  ctx.lineTo(wall.x + wall.w + 8, wall.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.farmhouseRoof;
  ctx.fillRect(wall.x + wall.w - 52, wall.y - 58, 22, 34);
  ctx.fillStyle = '#5d4a35';
  ctx.fillRect(wall.x + 24, wall.y + 30, 34, 34);
  ctx.fillRect(wall.x + wall.w - 58, wall.y + 30, 34, 34);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(wall.x + 28, wall.y + 34, 26, 26);
  ctx.fillRect(wall.x + wall.w - 54, wall.y + 34, 26, 26);
  ctx.fillStyle = '#7a5a38';
  ctx.fillRect(wall.x + wall.w / 2 - 20, wall.y + wall.h - 56, 40, 56);
}

function drawOven(ctx, world, time) {
  const oven = world.layout.oven;
  ctx.fillStyle = PALETTE.ovenBrick;
  roundRect(ctx, oven.x, oven.y, oven.w, oven.h, 10);
  ctx.fill();
  ctx.strokeStyle = '#6b3524';
  ctx.lineWidth = 3;
  for (let row = 0; row < 3; row += 1) {
    ctx.beginPath();
    ctx.moveTo(oven.x + 4, oven.y + 22 + row * 22);
    ctx.lineTo(oven.x + oven.w - 4, oven.y + 22 + row * 22);
    ctx.stroke();
  }
  const flicker = 0.8 + Math.sin(time * 9) * 0.2;
  const fire = ctx.createRadialGradient(oven.glowX, oven.glowY, 2, oven.glowX, oven.glowY, 30);
  fire.addColorStop(0, `rgba(255, 214, 90, ${0.95 * flicker})`);
  fire.addColorStop(0.6, `rgba(255, 122, 26, ${0.85 * flicker})`);
  fire.addColorStop(1, 'rgba(120, 30, 10, 0.9)');
  ctx.fillStyle = fire;
  ctx.beginPath();
  ctx.arc(oven.glowX, oven.glowY, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a140c';
  ctx.beginPath();
  ctx.arc(oven.glowX, oven.glowY, 13, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'OVEN', oven.x + oven.w / 2, oven.y - 14, 15, '#ffd9a8', 800);
}

function drawFence(ctx, wall) {
  ctx.fillStyle = PALETTE.fence;
  if (wall.w >= wall.h) {
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = PALETTE.fenceDark;
    for (let x = wall.x + 8; x < wall.x + wall.w; x += 34) ctx.fillRect(x, wall.y - 8, 8, wall.h + 16);
  } else {
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = PALETTE.fenceDark;
    for (let y = wall.y + 8; y < wall.y + wall.h; y += 34) ctx.fillRect(wall.x - 8, y, wall.w + 16, 8);
  }
}

function drawHay(ctx, bale) {
  const gradient = ctx.createRadialGradient(bale.x - 8, bale.y - 10, 4, bale.x, bale.y, bale.r + 4);
  gradient.addColorStop(0, '#e8bc55');
  gradient.addColorStop(1, PALETTE.hayDark);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(bale.x, bale.y, bale.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 80, 20, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(bale.x, bale.y, bale.r * 0.62, 0.4, Math.PI * 1.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bale.x, bale.y, bale.r * 0.3, 1.2, Math.PI * 1.9);
  ctx.stroke();
}

function drawTree(ctx, tree) {
  ctx.fillStyle = '#6b4a2c';
  ctx.fillRect(tree.x - 4, tree.y + 6, 8, 16);
  ctx.fillStyle = PALETTE.tree;
  ctx.beginPath();
  ctx.arc(tree.x - 10, tree.y - 4, tree.r * 0.62, 0, Math.PI * 2);
  ctx.arc(tree.x + 10, tree.y - 4, tree.r * 0.62, 0, Math.PI * 2);
  ctx.arc(tree.x, tree.y - 14, tree.r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.treeDark;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(tree.x + 6, tree.y + 2, tree.r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawGate(ctx, world, time) {
  const gate = world.layout.gate;
  ctx.fillStyle = PALETTE.gate;
  ctx.fillRect(gate.x - 8, gate.y - 10, 12, gate.h + 20);
  ctx.fillRect(gate.x + gate.w - 4, gate.y - 10, 12, gate.h + 20);
  ctx.fillStyle = world.gateOpen ? '#8a6a42' : PALETTE.gate;
  for (let index = 0; index < 4; index += 1) {
    ctx.fillRect(gate.x + 2, gate.y + 6 + index * 18, gate.w - 4, 7);
  }
  ctx.strokeStyle = PALETTE.gate;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(gate.x - 8, gate.y - 10);
  ctx.quadraticCurveTo(gate.x + gate.w / 2, gate.y - 34, gate.x + gate.w + 4, gate.y - 10);
  ctx.stroke();
  if (world.gateOpen) {
    const pulse = 0.7 + Math.sin(time * 4) * 0.3;
    ctx.globalAlpha = pulse;
    text(ctx, 'OPEN', gate.x + gate.w / 2, gate.y + gate.h / 2, 17, '#b9f29a', 900);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(126, 217, 87, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gate.x + gate.w / 2, gate.y - 26);
    ctx.lineTo(gate.x + gate.w / 2, gate.y + gate.h + 26);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(gate.x + gate.w / 2 - 9, gate.y + gate.h / 2 - 7, 18, 14);
    ctx.strokeStyle = '#3a3f4a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(gate.x + gate.w / 2, gate.y + gate.h / 2 - 7, 7, Math.PI, 0);
    ctx.stroke();
    text(ctx, 'LOCKED', 1272, gate.y + gate.h + 18, 13, '#ffd9a8', 800, 'right');
  }
  text(ctx, 'FOREST GATE', 1272, gate.y - 26, 13, '#e8dcc0', 800, 'right');
}

function drawCorn(ctx, cob, time) {
  const pulse = 1 + Math.sin(time * 3 + cob.phase) * 0.12;
  const glow = ctx.createRadialGradient(cob.x, cob.y, 2, cob.x, cob.y, 30 * pulse);
  glow.addColorStop(0, 'rgba(242, 201, 76, 0.5)');
  glow.addColorStop(1, 'rgba(242, 201, 76, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cob.x, cob.y, 30 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.cornHusk;
  ctx.beginPath();
  ctx.ellipse(cob.x - 10, cob.y + 8, 12, 5, -0.7, 0, Math.PI * 2);
  ctx.ellipse(cob.x + 10, cob.y + 8, 12, 5, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.corn;
  ctx.beginPath();
  ctx.ellipse(cob.x, cob.y, 9, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9972e';
  for (let row = -1; row <= 1; row += 1) {
    for (let col = -1; col <= 1; col += 1) {
      ctx.beginPath();
      ctx.arc(cob.x + col * 4, cob.y + row * 7, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawKnife(ctx, knife, time) {
  const rail = knife.rail;
  ctx.strokeStyle = PALETTE.rail;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(rail.x1, rail.y1);
  ctx.lineTo(rail.x2, rail.y2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(220, 225, 235, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(rail.x1, rail.y1);
  ctx.lineTo(rail.x2, rail.y2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (knife.aboutToMove) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rail.x1, rail.y1);
    ctx.lineTo(rail.x2, rail.y2);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(knife.x, knife.y);
  if (!knife.horizontal) ctx.rotate(Math.PI / 2);
  const gradient = ctx.createLinearGradient(-32, 0, 32, 0);
  gradient.addColorStop(0, PALETTE.knifeBlade);
  gradient.addColorStop(0.75, PALETTE.knifeEdge);
  gradient.addColorStop(1, PALETTE.knifeBlade);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-30, -7);
  ctx.lineTo(26, -7);
  ctx.lineTo(34, 0);
  ctx.lineTo(26, 7);
  ctx.lineTo(-30, 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 45, 55, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = PALETTE.knifeHandle;
  roundRect(ctx, -44, -6, 16, 12, 4);
  ctx.fill();
  if (knife.aboutToMove) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(20 + Math.sin(time * 20) * 2, -12, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTurkey(ctx, turkey, time) {
  if (!turkey.alive) return;
  const blink = turkey.invulnerable > 0 && Math.floor(time * 12) % 2 === 0;
  ctx.save();
  ctx.translate(turkey.x, turkey.y);
  ctx.globalAlpha = blink ? 0.45 : 1;
  ctx.rotate(turkey.angle);
  const squash = turkey.squash;
  ctx.scale(1 + squash * 0.18, 1 - squash * 0.12);
  ctx.fillStyle = 'rgba(20, 24, 16, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // The fanned tail, five feathers spread behind the bird.
  for (let index = -2; index <= 2; index += 1) {
    ctx.save();
    ctx.rotate(Math.PI + index * 0.42);
    ctx.fillStyle = PALETTE.tail[index + 2];
    ctx.beginPath();
    ctx.ellipse(-26, 0, 15, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-36, 0, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Feet, alternating as the bird walks.
  const step = turkey.moving ? Math.sin(turkey.stepPhase) * 4 : 0;
  ctx.fillStyle = '#e8a33c';
  ctx.beginPath();
  ctx.ellipse(-4, 12 + step * 0.4, 4, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(8, 12 - step * 0.4, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  const body = ctx.createRadialGradient(-4, -6, 4, 0, 0, 22);
  body.addColorStop(0, '#a86a3e');
  body.addColorStop(1, PALETTE.turkeyDark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wing.
  ctx.fillStyle = 'rgba(80, 45, 22, 0.65)';
  ctx.beginPath();
  ctx.ellipse(-2, 2, 11, 7, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Head, beak, wattle, eye — the bird faces right.
  ctx.fillStyle = PALETTE.turkeyHead;
  ctx.beginPath();
  ctx.arc(17, -4, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.beak;
  ctx.beginPath();
  ctx.moveTo(24, -6);
  ctx.lineTo(32, -3);
  ctx.lineTo(24, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.wattle;
  ctx.beginPath();
  ctx.ellipse(24, 3, 3.5, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20261c';
  ctx.beginPath();
  ctx.arc(19, -7, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFarmer(ctx, farmer, time) {
  const bob = farmer.moving ? Math.sin(farmer.bobPhase) * 2 : 0;
  ctx.save();
  ctx.translate(farmer.x, farmer.y + bob);
  ctx.fillStyle = 'rgba(20, 24, 16, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 6 - bob, 20, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(farmer.angle);
  // Pitchfork, carried over the shoulder.
  ctx.strokeStyle = '#7a5a38';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-8, -14);
  ctx.lineTo(-34, -30);
  ctx.stroke();
  ctx.strokeStyle = '#c9ced6';
  ctx.lineWidth = 2.5;
  for (const offset of [-4, 0, 4]) {
    ctx.beginPath();
    ctx.moveTo(-34 + offset * 0.7, -30 + offset);
    ctx.lineTo(-40 + offset * 0.7, -38 + offset);
    ctx.stroke();
  }
  // Body: red shirt, blue overalls.
  ctx.fillStyle = PALETTE.farmerShirt;
  roundRect(ctx, -14, -13, 28, 22, 9);
  ctx.fill();
  ctx.fillStyle = PALETTE.farmerOveralls;
  roundRect(ctx, -12, -2, 24, 16, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.farmerOveralls;
  ctx.fillRect(-12, -13, 5, 12);
  ctx.fillRect(7, -13, 5, 12);
  // Head and straw hat.
  ctx.fillStyle = PALETTE.farmerSkin;
  ctx.beginPath();
  ctx.arc(15, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.farmerHat;
  ctx.beginPath();
  ctx.ellipse(15, -6, 13, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(15, -8, 7, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#20261c';
  ctx.beginPath();
  ctx.arc(18, -2, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Suspicion and alarm, floating over his head.
  if (farmer.state === 'chase') {
    shadowedText(ctx, '!', farmer.x, farmer.y - 38, 30, '#ff3b30', 900);
  } else if (farmer.state === 'suspicious' || farmer.state === 'search') {
    shadowedText(ctx, '?', farmer.x, farmer.y - 36, 26, '#ff9f1c', 900);
  } else if (farmer.alert > 0.05) {
    ctx.fillStyle = 'rgba(255, 217, 77, 0.9)';
    ctx.beginPath();
    ctx.arc(farmer.x, farmer.y - 34, 3 + farmer.alert * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx, world) {
  for (const particle of world.particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    if (particle.kind === 'feather') {
      ctx.beginPath();
      ctx.ellipse(particle.x, particle.y, particle.size, particle.size * 0.45, particle.life * 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (particle.kind === 'spark') {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  for (const popup of world.popups) {
    ctx.globalAlpha = Math.min(1, popup.life);
    shadowedText(ctx, popup.text, popup.x, popup.y, 19, popup.color, 800);
  }
  ctx.globalAlpha = 1;
}

function drawFeatherIcon(ctx, x, y, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.6);
  ctx.fillStyle = filled ? '#f4efe2' : 'rgba(244, 239, 226, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = filled ? '#8a5230' : 'rgba(244, 239, 226, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(9, 0);
  ctx.stroke();
  ctx.restore();
}

function drawCornIcon(ctx, x, y, filled) {
  ctx.fillStyle = filled ? PALETTE.corn : 'rgba(242, 201, 76, 0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y, 7, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = filled ? PALETTE.cornHusk : 'rgba(93, 138, 60, 0.4)';
  ctx.beginPath();
  ctx.ellipse(x - 6, y + 6, 6, 3, -0.6, 0, Math.PI * 2);
  ctx.ellipse(x + 6, y + 6, 6, 3, 0.6, 0, Math.PI * 2);
  ctx.fill();
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function drawHud(ctx, world) {
  const turkey = world.turkey;
  ctx.fillStyle = 'rgba(24, 28, 20, 0.82)';
  roundRect(ctx, 10, 8, FIELD.width - 20, 48, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 239, 226, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  text(ctx, `SCORE ${String(world.score).padStart(4, '0')}`, 28, 32, 19, PALETTE.text, 800, 'left');
  text(ctx, `BEST ${String(world.best).padStart(4, '0')}`, 168, 32, 15, PALETTE.muted, 700, 'left');
  text(ctx, `${world.layout.name.toUpperCase()} · YARD ${world.level}`, 470, 32, 15, PALETTE.muted, 700);
  for (let index = 0; index < CORN.total; index += 1) {
    drawCornIcon(ctx, 620 + index * 30, 32, index < world.cornCollected);
  }
  const gateLabel = world.gateOpen ? 'GATE OPEN' : 'GATE LOCKED';
  text(ctx, gateLabel, 730, 32, 15, world.gateOpen ? PALETTE.good : PALETTE.muted, 800, 'left');
  const progress = gateProgress(world);
  ctx.fillStyle = 'rgba(244, 239, 226, 0.2)';
  roundRect(ctx, 850, 24, 120, 14, 7);
  ctx.fill();
  ctx.fillStyle = world.gateOpen ? PALETTE.good : PALETTE.accent;
  if (progress > 0.01) {
    roundRect(ctx, 850, 24, 120 * progress, 14, 7);
    ctx.fill();
  }
  text(ctx, 'TO GATE', 852, 52, 11, PALETTE.muted, 700, 'left');
  for (let index = 0; index < LIVES; index += 1) {
    drawFeatherIcon(ctx, FIELD.width - 150 + index * 28, 32, index < turkey.lives);
  }
  text(ctx, formatTime(world.time), FIELD.width - 28, 32, 19, PALETTE.text, 800, 'right');

  // The oven's heat, shown as a bar over the turkey while it builds.
  if (world.heat > 0.03 && turkey.alive) {
    const width = 64;
    ctx.fillStyle = 'rgba(24, 28, 20, 0.8)';
    roundRect(ctx, turkey.x - width / 2, turkey.y - 44, width, 10, 5);
    ctx.fill();
    ctx.fillStyle = '#ff7a1a';
    roundRect(ctx, turkey.x - width / 2 + 2, turkey.y - 42, (width - 4) * world.heat, 6, 3);
    ctx.fill();
    text(ctx, 'HEAT', turkey.x, turkey.y - 54, 11, '#ffb347', 800);
  }
}

function drawBanner(ctx, world) {
  if (!world.banner) return;
  const pop = Math.min(1, 0.4 + world.banner.age * 6);
  ctx.save();
  ctx.translate(FIELD.width / 2, 118);
  ctx.scale(pop, pop);
  shadowedText(ctx, world.banner.text, 0, 0, 34, world.banner.color, 900);
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(24, 28, 20, 0.92)';
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTitle(ctx, world) {
  panel(ctx, 240, 120, 800, 470);
  shadowedText(ctx, 'GOBBLE’S', 640, 178, 62, PALETTE.accent, 900);
  shadowedText(ctx, 'GREAT ESCAPE', 640, 238, 62, PALETTE.text, 900);
  text(ctx, 'One turkey. One farmer. One very hot oven.', 640, 292, 21, PALETTE.muted, 600);
  text(ctx, 'Grab 3 golden corn cobs — then run for the forest gate.', 640, 330, 19, PALETTE.text, 700);
  text(ctx, 'Stay out of the farmer’s sight. Dodge the carving knife.', 640, 358, 19, PALETTE.text, 700);
  text(ctx, 'Keep clear of the oven — its heat will cook you.', 640, 386, 19, PALETTE.text, 700);
  text(ctx, 'WASD / arrows to waddle · SPACE to dash · P to pause', 640, 436, 18, PALETTE.accent, 700);
  const blink = Math.floor(world.time * 2) % 2 === 0;
  if (blink) text(ctx, 'Press SPACE or click to play', 640, 486, 22, PALETTE.text, 800);
  if (world.best > 0) text(ctx, `Best score: ${world.best}`, 640, 526, 17, PALETTE.muted, 700);
  text(ctx, 'A Thanksgiving stealth game · Gobble’s Great Escape', 640, 562, 14, PALETTE.muted, 600);
}

function drawPaused(ctx) {
  panel(ctx, 440, 260, 400, 160);
  shadowedText(ctx, 'PAUSED', 640, 310, 40, PALETTE.text, 900);
  text(ctx, 'Press P or click to keep running', 640, 360, 18, PALETTE.muted, 700);
}

function drawOver(ctx, world) {
  const escaped = world.outcome === 'escaped';
  const bonus = escapeBonus(world);
  panel(ctx, 340, 150, 600, 420);
  if (escaped) {
    shadowedText(ctx, 'ESCAPED!', 640, 206, 56, PALETTE.good, 900);
    text(ctx, world.level >= 3 ? 'Free at last — no Thanksgiving dinner today.' : `Yard ${world.level} cleared — the forest is ahead.`, 640, 258, 20, PALETTE.muted, 600);
    text(ctx, `Corn collected  ${world.stats.cornTaken} × 100`, 640, 316, 19, PALETTE.text, 700);
    text(ctx, `Close calls  ${world.stats.closeCalls} × ${CLOSE_CALL_POINTS}`, 640, 346, 19, PALETTE.text, 700);
    text(ctx, `Escape bonus  ${bonus.base} + ${bonus.timeBonus} time + ${bonus.lifeBonus} lives`, 640, 376, 19, PALETTE.text, 700);
    text(ctx, `Time  ${formatTime(world.time)}`, 640, 406, 19, PALETTE.text, 700);
    shadowedText(ctx, `SCORE  ${world.score}`, 640, 452, 30, PALETTE.accent, 900);
    if (world.score >= world.best && world.best > 0) text(ctx, 'New best score!', 640, 488, 18, PALETTE.good, 800);
    text(ctx, world.level >= 3 ? 'Press R to run it again' : 'Press ENTER for the next yard · R to replay this one', 640, 528, 18, PALETTE.text, 700);
  } else {
    shadowedText(ctx, 'CAUGHT!', 640, 206, 56, PALETTE.danger, 900);
    text(ctx, 'The farmer is already preheating the oven…', 640, 258, 20, PALETTE.muted, 600);
    text(ctx, `Corn collected  ${world.stats.cornTaken} of 3`, 640, 316, 19, PALETTE.text, 700);
    text(ctx, `Close calls  ${world.stats.closeCalls}`, 640, 346, 19, PALETTE.text, 700);
    text(ctx, `Survived  ${formatTime(world.time)}`, 640, 376, 19, PALETTE.text, 700);
    shadowedText(ctx, `SCORE  ${world.score}`, 640, 452, 30, PALETTE.accent, 900);
    text(ctx, 'Press R to run again', 640, 516, 20, PALETTE.text, 800);
  }
}

function drawVignette(ctx) {
  const gradient = ctx.createRadialGradient(640, 360, 320, 640, 360, 820);
  gradient.addColorStop(0, 'rgba(20, 24, 16, 0)');
  gradient.addColorStop(1, 'rgba(20, 24, 16, 0.35)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

/** Draw the whole game into the current transform. */
export function render(ctx, world, time) {
  ctx.save();
  if (world.shake > 0.2) {
    const magnitude = world.shake;
    ctx.translate((world.rng() - 0.5) * magnitude, (world.rng() - 0.5) * magnitude);
  }
  drawGround(ctx, world);
  drawOvenGlow(ctx, world, time);
  drawGateGlow(ctx, world);
  if (world.state !== 'title') drawVisionCone(ctx, world);
  for (const wall of world.layout.walls) {
    if (wall.kind === 'barn') drawBarn(ctx, wall);
    else if (wall.kind === 'farmhouse') drawFarmhouse(ctx, wall);
    else if (wall.kind === 'oven') drawOven(ctx, world, time);
    else drawFence(ctx, wall);
  }
  for (const bale of world.layout.hay) drawHay(ctx, bale);
  for (const tree of world.layout.trees) drawTree(ctx, tree);
  drawGate(ctx, world, time);
  for (const cob of world.corn) {
    if (!cob.taken) drawCorn(ctx, cob, time);
  }
  for (const knife of world.knives) drawKnife(ctx, knife, time);
  drawFarmer(ctx, world.farmer, time);
  drawTurkey(ctx, world.turkey, time);
  drawParticles(ctx, world);
  drawVignette(ctx);
  if (world.state !== 'title') drawHud(ctx, world);
  drawBanner(ctx, world);
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255, 59, 48, ${world.flash * 0.28})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  if (world.state === 'title') drawTitle(ctx, world);
  else if (world.state === 'paused') drawPaused(ctx);
  else if (world.state === 'over') drawOver(ctx, world);
  ctx.restore();
}
