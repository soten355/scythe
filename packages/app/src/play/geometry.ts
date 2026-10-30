// Where hexes, home bases and river edges sit on the drawn board.
// Pointy-top hexes in axial coordinates (see packages/engine/src/board.ts).
import type { Board, HexId, Location } from '@scythe/engine';

export const SIZE = 30;

export type Point = [number, number];

export const center = ({ q, r }: { q: number; r: number }): Point => [SIZE * Math.sqrt(3) * (q + r / 2), SIZE * 1.5 * r];

export function corners(c: Point, size = SIZE): Point[] {
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return [c[0] + size * Math.cos(a), c[1] + size * Math.sin(a)];
  });
}

export const points = (pts: Point[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** The two corners of the edge shared by touching hexes a and b. */
export function sharedEdge(board: Board, a: HexId, b: HexId): [Point, Point] {
  const cb = center(board.hexes[b]!);
  const [p1, p2] = corners(center(board.hexes[a]!)).sort(
    (p, q) => Math.hypot(p[0] - cb[0], p[1] - cb[1]) - Math.hypot(q[0] - cb[0], q[1] - cb[1]),
  );
  return [p1!, p2!];
}

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The smallest rectangle around some points, with a margin. */
function areaAround(pts: Point[], pad: number): Area {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

/** Every hex and home base, with a margin. */
export function boardArea(board: Board): Area {
  const pts = [...Object.values(board.hexes), ...Object.values(board.homeBasePositions)].flatMap((h) => corners(center(h)));
  return areaAround(pts, SIZE * 0.3);
}

/** Some hexes (and "home": the given home base), with room around them. */
export function spotsArea(board: Board, spots: Location[], home: { q: number; r: number } | undefined): Area | null {
  const pts = spots.flatMap((s) => {
    const at = s === 'home' ? home : board.hexes[s];
    return at ? corners(center(at)) : [];
  });
  return pts.length ? areaAround(pts, SIZE * 0.8) : null;
}
