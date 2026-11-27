// A small seeded random generator (mulberry32), so the same seed always builds
// the same yard, the same patrol and the same screenshot scenes.

export function createRandom(seed) {
  let value = seed >>> 0;
  return function random() {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [min, max] from the seeded generator. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Pick one element of an array with the seeded generator. */
export function randomPick(random, list) {
  return list[Math.floor(random() * list.length)];
}
