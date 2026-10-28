// Seeded, deterministic RNG (mulberry32). Its state is a plain number so it
// can live inside JSON game state. Functions never mutate; they return the
// next state alongside the value.

export type RngState = number;

export function seedRng(seed: number): RngState {
  return seed >>> 0;
}

/** Returns a float in [0, 1) and the next RNG state. */
export function nextFloat(state: RngState): [number, RngState] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Returns an integer in [0, maxExclusive) and the next RNG state. */
export function nextInt(state: RngState, maxExclusive: number): [number, RngState] {
  const [f, next] = nextFloat(state);
  return [Math.floor(f * maxExclusive), next];
}
