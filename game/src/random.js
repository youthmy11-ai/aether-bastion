// Deterministic Mulberry32 PRNG and utility helpers for repeatable simulation and shots.

export function createRandom(seed) {
  let state = seed | 0;

  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  next.range = (min, max) => min + next() * (max - min);
  next.int = (min, maxInclusive) => Math.floor(min + next() * (maxInclusive - min + 1));
  next.chance = (probability) => next() < probability;
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}
