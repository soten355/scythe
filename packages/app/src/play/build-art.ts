// Drawings for the "building" moments (see fly.ts), in the same box as the
// mech's (about 18 by 16 units, centred on 0,0; the ground at y = 6.6): a
// generic structure put together part by part, and the goods a hex produces,
// stacked one by one. Original shapes.
import type { Resource } from '@scythe/engine';
import { MEEPLE } from './shapes';

/** One drawn part: a path, its fill, and an optional stroke of its own (lines drawn over it). */
export type Part = { d: string; fill: string; lines?: { d: string; stroke: string }; /** Drawn this much smaller or larger. */ scale?: number };

/**
 * A structure, in the order it goes up: a stone footing, walls in the
 * faction's colour, a chimney, the roof, then the door (which just appears).
 */
export function structureParts(color: string): Part[] {
  return [
    { d: 'M-7.6 4.6H7.6V6.6H-7.6Z', fill: '#8a8075', lines: { d: 'M-3.8 4.6V6.6M0 4.6V6.6M3.8 4.6V6.6', stroke: '#5e564d' } },
    { d: 'M-6 -1.2H6V4.6H-6Z', fill: color, lines: { d: 'M-6 1.6H6', stroke: 'rgb(0 0 0 / 0.25)' } },
    // The chimney before the roof, so it rises from behind it.
    { d: 'M3 -7.2H5.2V-3H3Z', fill: '#8a8075' },
    { d: 'M-7.6 -1L0 -6.8L7.6 -1Z', fill: '#6b3f2a', lines: { d: 'M-3.8 -3.9H3.8', stroke: 'rgb(0 0 0 / 0.3)' } },
    { d: 'M-1.5 1H1.5V4.6H-1.5Z', fill: '#2a211b' },
  ];
}

/** Each good's look, centred on 0,0, and its size (for stacking). */
type Item = { parts: Part[]; w: number; h: number };

const ITEMS: Record<Resource | 'worker', (color: string) => Item> = {
  // An ingot: a trapezoid with a bright top edge.
  metal: () => ({
    parts: [{ d: 'M-2.7 1.3L-1.9 -1.3H1.9L2.7 1.3Z', fill: '#b8c0ca', lines: { d: 'M-1.7 -0.8H1.7', stroke: '#eef2f6' } }],
    w: 5.4,
    h: 2.6,
  }),
  // A log on its side, its cut end showing rings.
  wood: () => ({
    parts: [
      { d: 'M-2.6 -1.2H2.4V1.2H-2.6A1.2 1.2 0 0 1 -2.6 -1.2Z', fill: '#7a4a24', lines: { d: 'M-1.6 -0.4H1M-2 0.5H0.4', stroke: '#5a3418' } },
      { d: 'M2.4 -1.2A1.1 1.2 0 0 1 2.4 1.2A1.1 1.2 0 0 1 2.4 -1.2Z', fill: '#d2a466', lines: { d: 'M2.4 -0.5A0.45 0.5 0 0 1 2.4 0.5A0.45 0.5 0 0 1 2.4 -0.5Z', stroke: '#8a5a2c' } },
    ],
    w: 5.4,
    h: 2.5,
  }),
  // A barrel standing up: a straight cylinder, its rim showing, with hoops.
  oil: () => ({
    parts: [
      {
        d: 'M-1.8 -1.7V1.7A1.8 0.6 0 0 0 1.8 1.7V-1.7A1.8 0.6 0 0 0 -1.8 -1.7Z',
        fill: '#2c2c2c',
        lines: { d: 'M-1.8 -1.7A1.8 0.6 0 0 0 1.8 -1.7A1.8 0.6 0 0 0 -1.8 -1.7M-1.8 0A1.8 0.6 0 0 0 1.8 0M-1.8 1.3A1.8 0.6 0 0 0 1.8 1.3', stroke: '#8d8d8d' },
      },
    ],
    w: 4.1,
    h: 4.6,
  }),
  // A sack of grain, tied at the top.
  food: () => ({
    parts: [
      {
        d: 'M-1.1 -2.2H1.1L0.7 -1.4Q2.6 -0.7 2.5 1Q2.4 2.2 0 2.2Q-2.4 2.2 -2.5 1Q-2.6 -0.7 -0.7 -1.4Z',
        fill: '#e3c46a',
        lines: { d: 'M-0.9 -1.4H0.9M-1.2 0.4Q0 1 1.2 0.4', stroke: '#9c7a2e' },
      },
    ],
    w: 5,
    h: 4.4,
  }),
  // A worker, in the faction's colour (MEEPLE is about 13 across; shrunk).
  worker: (color) => ({ parts: [{ d: MEEPLE, fill: color, scale: 0.46 }], w: 6.2, h: 6 }),
};

/** At most this many goods are drawn; more show a count. */
export const MAX_SHOWN = 6;

/**
 * Where each of `n` goods sits in a stack (bottom row first, then each row
 * on top of the one below, one fewer each time, as a pyramid); workers
 * stand side by side instead.
 */
export function stackPlaces(n: number, w: number, h: number, side = false): [number, number][] {
  const shown = Math.min(n, MAX_SHOWN);
  const ground = 6.6;
  if (side) {
    // Close enough together to fit the box (16 across), never overlapping more than a little.
    const gap = Math.min(w * 1.05, 16 / Math.max(1, shown - 1));
    return Array.from({ length: shown }, (_, i) => [(i - (shown - 1) / 2) * gap, ground - h / 2]);
  }
  const places: [number, number][] = [];
  let left = shown;
  let row = 0;
  // The narrowest bottom row that makes a pyramid (3 goods: two with one on top; 6: three, two, one).
  let width = 1;
  while ((width * (width + 1)) / 2 < shown) width++;
  while (left > 0) {
    const count = Math.min(left, width);
    for (let i = 0; i < count; i++) places.push([(i - (count - 1) / 2) * (w + 0.35), ground - h / 2 - row * (h + 0.1)]);
    left -= count;
    row++;
    width = Math.max(1, count - 1);
  }
  return places;
}

/** The goods produced, each placed in its stack: one group of parts per good, in the order they go on. */
export function goods(what: Resource | 'worker', n: number, color: string): { at: [number, number]; parts: Part[] }[] {
  const item = ITEMS[what](color);
  return stackPlaces(n, item.w, item.h, what === 'worker').map((at) => ({ at, parts: item.parts }));
}

