// A small seeded random source and the value noise built on it. Everything random in the
// valley — its hills, its trees, its ring courses — comes from one of these, so a seed
// always grows the same world and a staged flight always flies the same sky.

/** mulberry32: a fast 32-bit seeded generator. Returns a function giving [0, 1) floats. */
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random float in [min, max) from the given generator. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Smooth interpolation between lattice values, the classic Perlin easing curve. */
function fade(t) {
  return t * t * (3 - 2 * t);
}

/**
 * 2D value noise over a seeded lattice: `noise2(x, z)` is smooth, in [0, 1), and repeats
 * for no one — the same coordinates always give the same value, on any machine.
 */
export function makeNoise2(seed) {
  const rng = makeRng(seed);
  const lattice = new Float32Array(256 * 256);
  for (let i = 0; i < lattice.length; i += 1) lattice[i] = rng();
  const at = (ix, iz) => lattice[((iz & 255) << 8) | (ix & 255)];
  return function noise2(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = fade(x - ix);
    const fz = fade(z - iz);
    const a = at(ix, iz);
    const b = at(ix + 1, iz);
    const c = at(ix, iz + 1);
    const d = at(ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };
}

/** Fractal noise: a few octaves of value noise summed, for hills that have hills on them. */
export function fbm(noise2, x, z, octaves) {
  let sum = 0;
  let weight = 0.5;
  let total = 0;
  let fx = x;
  let fz = z;
  for (let i = 0; i < octaves; i += 1) {
    sum += noise2(fx, fz) * weight;
    total += weight;
    weight *= 0.5;
    fx *= 2.03;
    fz *= 1.97;
  }
  return sum / total;
}
