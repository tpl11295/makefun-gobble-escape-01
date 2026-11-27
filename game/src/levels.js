// The farmyard, one level at a time. Each level is a fixed, hand-placed layout
// (walls, hay bales, trees, the oven, the knife rail, the corn, the gate and
// the farmer's patrol), so the same level always plays the same. Only the
// grass speckles and fallen leaves come from the seeded generator.
//
// Walls are solid rectangles (barn, farmhouse, fences, the oven's body).
// Hay bales and trees are solid circles, and they block the farmer's sight.
// The gate sits on the right edge: locked until every corn cob is taken.

import { FIELD } from './config.js';

function speckleField(random, count) {
  const speckles = [];
  for (let index = 0; index < count; index += 1) {
    speckles.push({
      x: random() * FIELD.width,
      y: random() * FIELD.height,
      r: 2 + random() * 5,
      dark: random() < 0.5,
    });
  }
  return speckles;
}

function fallenLeaves(random, count) {
  const colors = ['#c96a1e', '#d9a441', '#a63d2f', '#8a5a2b'];
  const leaves = [];
  for (let index = 0; index < count; index += 1) {
    leaves.push({
      x: random() * FIELD.width,
      y: random() * FIELD.height,
      angle: random() * Math.PI * 2,
      color: colors[Math.floor(random() * colors.length)],
    });
  }
  return leaves;
}

const LEVELS = [
  {
    name: 'Dusk',
    walls: [
      { x: 60, y: 60, w: 240, h: 170, kind: 'barn' },
      { x: 980, y: 50, w: 240, h: 150, kind: 'farmhouse' },
      { x: 896, y: 170, w: 96, h: 84, kind: 'oven' },
      { x: 480, y: 300, w: 140, h: 14, kind: 'fence' },
      { x: 700, y: 300, w: 120, h: 14, kind: 'fence' },
      { x: 820, y: 300, w: 14, h: 180, kind: 'fence' },
    ],
    hay: [
      { x: 430, y: 180, r: 34 },
      { x: 700, y: 520, r: 34 },
      { x: 350, y: 540, r: 30 },
      { x: 880, y: 470, r: 30 },
    ],
    trees: [
      { x: 90, y: 330, r: 26 },
      { x: 1180, y: 640, r: 26 },
    ],
    oven: { x: 896, y: 170, w: 96, h: 84, glowX: 944, glowY: 212 },
    knifeRails: [{ x1: 320, y1: 430, x2: 960, y2: 430 }],
    cornSpots: [
      { x: 220, y: 600 },
      { x: 640, y: 140 },
      { x: 1090, y: 560 },
    ],
    gate: { x: 1240, y: 300, w: 40, h: 80 },
    farmerWaypoints: [
      { x: 300, y: 300 },
      { x: 640, y: 240 },
      { x: 900, y: 330 },
      { x: 640, y: 470 },
      { x: 300, y: 430 },
    ],
    turkeyStart: { x: 140, y: 620 },
    paths: [
      { x: 120, y: 596, w: 1000, h: 44 },
      { x: 600, y: 120, w: 44, h: 480 },
    ],
  },
  {
    name: 'Night',
    walls: [
      { x: 60, y: 60, w: 240, h: 170, kind: 'barn' },
      { x: 980, y: 50, w: 240, h: 150, kind: 'farmhouse' },
      { x: 1000, y: 520, w: 96, h: 84, kind: 'oven' },
      { x: 560, y: 180, w: 14, h: 200, kind: 'fence' },
      { x: 560, y: 420, w: 14, h: 140, kind: 'fence' },
      { x: 760, y: 520, w: 180, h: 14, kind: 'fence' },
    ],
    hay: [
      { x: 300, y: 200, r: 34 },
      { x: 800, y: 300, r: 34 },
      { x: 520, y: 600, r: 30 },
      { x: 1080, y: 300, r: 30 },
    ],
    trees: [
      { x: 90, y: 330, r: 26 },
      { x: 640, y: 660, r: 26 },
    ],
    oven: { x: 1000, y: 520, w: 96, h: 84, glowX: 1048, glowY: 562 },
    knifeRails: [{ x1: 640, y1: 200, x2: 640, y2: 560 }],
    cornSpots: [
      { x: 340, y: 640 },
      { x: 900, y: 120 },
      { x: 1120, y: 420 },
    ],
    gate: { x: 1240, y: 300, w: 40, h: 80 },
    farmerWaypoints: [
      { x: 280, y: 420 },
      { x: 700, y: 180 },
      { x: 1000, y: 420 },
      { x: 700, y: 600 },
      { x: 420, y: 520 },
    ],
    turkeyStart: { x: 140, y: 620 },
    paths: [
      { x: 120, y: 596, w: 1000, h: 44 },
      { x: 280, y: 200, w: 44, h: 420 },
    ],
  },
  {
    name: 'Dawn',
    walls: [
      { x: 60, y: 60, w: 240, h: 170, kind: 'barn' },
      { x: 980, y: 50, w: 240, h: 150, kind: 'farmhouse' },
      { x: 896, y: 170, w: 96, h: 84, kind: 'oven' },
      { x: 420, y: 240, w: 14, h: 240, kind: 'fence' },
      { x: 860, y: 240, w: 14, h: 240, kind: 'fence' },
    ],
    hay: [
      { x: 300, y: 520, r: 34 },
      { x: 980, y: 520, r: 34 },
      { x: 640, y: 120, r: 30 },
    ],
    trees: [
      { x: 90, y: 330, r: 26 },
      { x: 1180, y: 660, r: 26 },
    ],
    oven: { x: 896, y: 170, w: 96, h: 84, glowX: 944, glowY: 212 },
    knifeRails: [
      { x1: 300, y1: 360, x2: 980, y2: 360 },
      { x1: 700, y1: 140, x2: 700, y2: 580 },
    ],
    cornSpots: [
      { x: 180, y: 640 },
      { x: 1100, y: 120 },
      { x: 640, y: 640 },
    ],
    gate: { x: 1240, y: 300, w: 40, h: 80 },
    farmerWaypoints: [
      { x: 320, y: 300 },
      { x: 640, y: 200 },
      { x: 960, y: 300 },
      { x: 960, y: 520 },
      { x: 640, y: 600 },
      { x: 320, y: 520 },
    ],
    turkeyStart: { x: 140, y: 620 },
    paths: [
      { x: 120, y: 596, w: 1000, h: 44 },
      { x: 600, y: 120, w: 44, h: 480 },
    ],
  },
];

/** Build the layout for a level (1-based; cycles past the last). */
export function buildLevel(level, random) {
  const base = LEVELS[(level - 1) % LEVELS.length];
  return {
    name: base.name,
    level,
    walls: base.walls,
    hay: base.hay,
    trees: base.trees,
    oven: base.oven,
    knifeRails: base.knifeRails,
    cornSpots: base.cornSpots,
    gate: base.gate,
    farmerWaypoints: base.farmerWaypoints,
    turkeyStart: base.turkeyStart,
    paths: base.paths,
    speckles: speckleField(random, 90),
    leaves: fallenLeaves(random, 42),
  };
}

export const LEVEL_COUNT = LEVELS.length;
