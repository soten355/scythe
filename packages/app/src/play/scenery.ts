// Drawing helpers for the fight backgrounds: which one a hex gets, and
// simple generators for treelines and ridges. Seeded so a background looks
// the same every time it's shown.

export type Backdrop = 'forest' | 'tundra' | 'mountain' | 'farm' | 'factory' | 'lake';

const BACKDROPS: readonly string[] = ['forest', 'tundra', 'mountain', 'farm', 'factory', 'lake'];

/** The background for a fight on this terrain: villages (and anything else) use the farm. */
export function backdropFor(terrain: string): Backdrop {
  return BACKDROPS.includes(terrain) ? (terrain as Backdrop) : 'farm';
}

/** A repeatable 0..1 number for a seed. */
export function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** One pine: tiers narrowing to a point, standing on `base` at x. */
function pine(x: number, base: number, h: number): string {
  const w = h * 0.42;
  const tier = (top: number, bottom: number, half: number) => `M${x} ${base - h * top} L${x + w * half} ${base - h * bottom} L${x - w * half} ${base - h * bottom} Z`;
  return [tier(1, 0.55, 0.32), tier(0.75, 0.3, 0.42), tier(0.5, 0.08, 0.55), `M${x - w * 0.06} ${base - h * 0.1} h${w * 0.12} V${base} h${-w * 0.12} Z`].join(' ');
}

/** A row of pines across a 1000-wide scene. */
export function treeline({ base, count, min, max, seed }: { base: number; count: number; min: number; max: number; seed: number }): string {
  return Array.from({ length: count }, (_, i) => {
    const x = (i + 0.2 + rand(seed + i) * 0.6) * (1000 / count);
    return pine(x, base + rand(seed + i * 7) * 10, min + rand(seed + i * 3) * (max - min));
  }).join(' ');
}

/** A filled ridge across a 1000-wide scene: jagged peaks (sharp) or rolling hills. */
export function ridge({ base, height, points, seed, sharp = true }: { base: number; height: number; points: number; seed: number; sharp?: boolean }): string {
  const ys = Array.from({ length: points + 1 }, (_, i) => base - height * (0.35 + rand(seed + i) * 0.65));
  const step = 1000 / points;
  if (sharp) return `M0 ${base + 1} ${ys.map((y, i) => `L${(i * step).toFixed(1)} ${y.toFixed(1)}`).join(' ')} L1000 ${base + 1} Z`;
  // Rolling: smooth curves through the midpoints.
  let d = `M0 ${base + 1} L0 ${ys[0]!.toFixed(1)}`;
  for (let i = 1; i <= points; i++) {
    const mx = (i - 0.5) * step;
    d += ` Q${((i - 1) * step).toFixed(1)} ${ys[i - 1]!.toFixed(1)} ${mx.toFixed(1)} ${((ys[i - 1]! + ys[i]!) / 2).toFixed(1)}`;
  }
  return `${d} L1000 ${ys[points]!.toFixed(1)} L1000 ${base + 1} Z`;
}
