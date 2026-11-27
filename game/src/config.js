// Every tuning number and colour in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. Top-down dusk farmyard: warm grass, dirt paths, a red
// barn, a cream farmhouse and a glowing brick oven.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const TURKEY = {
  radius: 16,
  walkSpeed: 205,
  dashSpeed: 430,
  dashTime: 0.18,
  dashCooldown: 1.0,
  invulnerable: 1.6,
};

export const LIVES = 3;

export const FARMER = {
  radius: 18,
  patrolSpeed: 78,
  chaseSpeed: 226,
  searchSpeed: 120,
  visionRange: 280,
  /** Half-angle of the vision cone, in radians. */
  visionHalfAngle: 0.96,
  /** Seconds of continuous sight before the farmer gives chase. */
  spotTime: 0.55,
  /** Seconds without sight before a chase gives up. */
  loseSightTime: 1.6,
  /** Seconds a suspicious farmer investigates before going back to patrol. */
  investigateTime: 2.5,
  /** Seconds a searching farmer looks around before going back to patrol. */
  searchTime: 3.0,
};

export const KNIFE = {
  /** Pixels the blade travels per second while sweeping. */
  sweepSpeed: 520,
  /** Seconds the blade waits at each end of its rail. */
  pause: 0.9,
  width: 64,
  height: 16,
};

export const OVEN = {
  /** Radius of the heat zone around the oven's mouth. */
  radius: 82,
  /** Heat built per second standing in the zone; 1.0 costs a life. */
  heatRate: 0.85,
  /** Heat lost per second outside the zone. */
  coolRate: 0.55,
};

export const CORN = {
  radius: 15,
  points: 100,
  total: 3,
};

export const CLOSE_CALL_POINTS = 25;

/** How much harder the yard gets each time a corn cob is taken. */
export const ESCALATION = {
  farmerSpeed: 0.09,
  visionRange: 12,
  knifeSpeed: 0.06,
};

/** Best score is kept between visits (this browser only). */
export const BEST_KEY = 'gobble-escape.best';

export const PALETTE = {
  backdrop: '#20261c',
  grass: '#7d9b52',
  grassDark: '#6d8a47',
  grassLight: '#8aa862',
  dirt: '#b98d5f',
  dirtDark: '#a67c50',
  barn: '#a63d2f',
  barnRoof: '#7e2d22',
  barnTrim: '#e8dcc0',
  farmhouse: '#e8dcc0',
  farmhouseRoof: '#8a5a3b',
  ovenBrick: '#8a4a32',
  ovenGlow: '#ff7a1a',
  hay: '#d9a441',
  hayDark: '#b9832f',
  fence: '#7a5a38',
  fenceDark: '#5d4429',
  gate: '#6b4a2c',
  tree: '#4d7a3a',
  treeDark: '#3c6130',
  corn: '#f2c94c',
  cornHusk: '#5d8a3c',
  turkeyBody: '#8a5230',
  turkeyDark: '#6b3f24',
  tail: ['#a0522d', '#c96a1e', '#e8a33c', '#d2691e', '#8a4a2a'],
  turkeyHead: '#c9d2e3',
  wattle: '#e5534b',
  beak: '#e8a33c',
  farmerShirt: '#b03a2e',
  farmerOveralls: '#3d5a80',
  farmerHat: '#d9b36c',
  farmerSkin: '#e8b98a',
  knifeBlade: '#d7dce3',
  knifeEdge: '#f4f6f9',
  knifeHandle: '#5d3a22',
  rail: '#5a5f6b',
  panel: '#232a1e',
  panelEdge: '#3d4a34',
  text: '#f4efe2',
  muted: '#b9bfae',
  accent: '#f2c94c',
  danger: '#ff5a3c',
  calm: '#ffd94d',
  suspicious: '#ff9f1c',
  chase: '#ff3b30',
  good: '#7ed957',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
