// A hand-composed scene must not reshuffle itself on reload, so every
// procedural placement — stalks, silos, dust — draws from a seeded stream
// rather than from Math.random.

export type Rng = {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (min: number, max: number) => number;
};

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: number): Rng {
  const next = mulberry32(seed);
  const range = (min: number, max: number): number => min + next() * (max - min);
  return { next, range, int: (min, max) => Math.floor(range(min, max + 1)) };
}

// Smooth 1-D value noise. The lamp flickers on this rather than on white
// noise, so it wanders like a failing arc lamp instead of buzzing like static.
export function noise1d(x: number, seed = 1): number {
  const i = Math.floor(x);
  const f = x - i;
  const smooth = f * f * (3 - 2 * f);
  const at = (n: number): number => mulberry32(n * 374761393 + seed * 668265263)();
  const a = at(i);
  return a + (at(i + 1) - a) * smooth;
}
