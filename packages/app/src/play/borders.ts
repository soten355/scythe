// What runs along each hex edge when a skin draws the map's borders
// (Carcassonne style: the owner's Reap skin). Between two land hexes, a
// road; where the map has a river, the river; between land and a lake, the
// shore. Edges on the outside of the map, and between two lakes, get
// nothing. Rivers can run along a lake (their bank is then only on the land
// side), and where one stops among land it ends in a round pool short of the
// corner, so a road junction there stays whole. Painted in baked-map.ts.
import type { Board, HexId } from '@scythe/engine';
import { center, corners, sharedEdge, type Point } from './geometry';

export type BorderKind = 'road' | 'river' | 'shore';

export interface BorderEdge {
  kind: BorderKind;
  a: Point;
  b: Point;
  /** The middle of the land hex beside it, for a shore or a river along a lake (which side the bank goes). */
  land?: Point;
  /** A river that stops here among land: it ends short of this corner, in a pool. */
  endA?: boolean;
  endB?: boolean;
}

/** A corner's key: corners are worked out from each hex, so round off the tiny differences. */
const key = ([x, y]: Point) => `${Math.round(x * 100)},${Math.round(y * 100)}`;

export function mapBorders(board: Board): BorderEdge[] {
  const isLake = (id: HexId) => board.hexes[id]?.terrain === 'lake';
  const river = new Set(board.rivers.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));

  // Which hexes meet at each corner.
  const at = new Map<string, HexId[]>();
  for (const h of Object.values(board.hexes)) for (const c of corners(center(h))) at.set(key(c), [...(at.get(key(c)) ?? []), h.id]);

  const edges: BorderEdge[] = [];
  for (const h of Object.values(board.hexes)) {
    for (const n of board.adjacent[h.id] ?? []) {
      if (!board.hexes[n] || n < h.id) continue;
      const [a, b] = sharedEdge(board, h.id, n);
      const lake = isLake(h.id) ? h.id : isLake(n) ? n : null;
      const landHex = lake === h.id ? n : h.id;
      if (river.has(`${h.id}|${n}`)) edges.push({ kind: 'river', a, b, ...(lake && !isLake(landHex) && { land: center(board.hexes[landHex]!) }) });
      else if (lake && isLake(landHex)) continue;
      else if (lake) edges.push({ kind: 'shore', a, b, land: center(board.hexes[landHex]!) });
      else edges.push({ kind: 'road', a, b });
    }
  }

  // A river stops at a corner it reaches alone, among land, inside the map (three hexes meet there).
  const riverCount = new Map<string, number>();
  for (const e of edges) if (e.kind === 'river') for (const p of [e.a, e.b]) riverCount.set(key(p), (riverCount.get(key(p)) ?? 0) + 1);
  const stops = (p: Point) => riverCount.get(key(p)) === 1 && (at.get(key(p)) ?? []).length === 3 && !at.get(key(p))!.some(isLake);
  for (const e of edges) {
    if (e.kind !== 'river') continue;
    if (stops(e.a)) e.endA = true;
    if (stops(e.b)) e.endB = true;
  }
  return edges;
}

/** Where a river edge's water actually runs: short of a corner it stops at (a third of the way back when both ends stop). */
export function riverSpan(e: BorderEdge): [Point, Point] {
  const lerp = (t: number): Point => [e.a[0] + (e.b[0] - e.a[0]) * t, e.a[1] + (e.b[1] - e.a[1]) * t];
  const short = e.endA && e.endB ? 0.3 : 0.45;
  return [e.endA ? lerp(short) : e.a, e.endB ? lerp(1 - short) : e.b];
}
