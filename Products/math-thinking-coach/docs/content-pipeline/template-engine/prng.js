// Deterministic PRNG (mulberry32) seeded from an arbitrary string/number.
// Same seed + same sequence of calls => same numbers, every time, on any machine.
// This is what makes "same template + same params + same generator version
// reproduces the identical question" true for the candidate-search step.

function hashSeedToUint32(seed) {
  const str = String(seed);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

function createRng(seed) {
  let state = hashSeedToUint32(seed != null ? seed : String(Date.now()));
  return function rng() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Inclusive random integer in [min, max].
function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

module.exports = { createRng, randInt };
