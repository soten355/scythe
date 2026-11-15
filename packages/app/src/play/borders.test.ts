import { describe, expect, it } from 'vitest';
import { buildBoard } from '@scythe/engine';
import { mapBorders, riverSpan, type BorderEdge } from './borders';
import { center, sharedEdge } from './geometry';

//   A1 A2 A3
//     B1 B2 B3      (B3 is a lake; odd rows sit half a hex to the right)
//   C1 C2 C3
const board = buildBoard({
  rows: ['Fa Fo Mo', 'Tu Vi ~~', 'Fa Fo Mo'],
  // A river from among the land (A2|B2), on along A3|B2 to the lake, and one along the lake's edge (B2|B3).
  rivers: ['A2|B2', 'A3|B2', 'B2|B3'],
  homeBases: {},
});
const borders = mapBorders(board);
const same = (p: number[], q: number[]) => Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!) < 0.01;
/** The border along the edge between two hexes. */
function along(x: string, y: string): BorderEdge | undefined {
  const [p, q] = sharedEdge(board, x, y);
  return borders.find((e) => (same(e.a, p) && same(e.b, q)) || (same(e.a, q) && same(e.b, p)));
}

describe('mapBorders', () => {
  it('puts a road between land hexes', () => {
    expect(along('A1', 'A2')?.kind).toBe('road');
    expect(along('B1', 'C2')?.kind).toBe('road');
  });

  it('puts a shore between land and a lake, with the land side marked', () => {
    const shore = along('A3', 'B3')!;
    expect(shore.kind).toBe('shore');
    expect(same(shore.land!, center(board.hexes.A3!))).toBe(true);
    expect(along('C3', 'B3')?.kind).toBe('shore');
  });

  it('draws rivers where the map has them; one along a lake knows its land side', () => {
    expect(along('A2', 'B2')?.kind).toBe('river');
    const byLake = along('B2', 'B3')!;
    expect(byLake.kind).toBe('river');
    expect(same(byLake.land!, center(board.hexes.B2!))).toBe(true);
    expect(along('A2', 'B2')!.land).toBeUndefined();
  });

  it('draws nothing on the outside of the map: one border per pair of touching hexes', () => {
    const pairs = Object.entries(board.adjacent).reduce((n, [, list]) => n + list.length, 0) / 2;
    expect(borders).toHaveLength(pairs);
  });

  it('stops a river at a corner it reaches alone among land, not where it meets another river or a lake', () => {
    const start = along('A2', 'B2')!;
    // The corner where A2, B1 and B2 meet: the river reaches it alone, so it stops there.
    const near = (c: number[], id: string) => Math.hypot(center(board.hexes[id]!)[0] - c[0]!, center(board.hexes[id]!)[1] - c[1]!) < 31;
    const stopCorner = ['A2', 'B1', 'B2'].every((id) => near(start.a, id)) ? 'a' : 'b';
    expect(stopCorner === 'a' ? start.endA : start.endB).toBe(true);
    expect(stopCorner === 'a' ? start.endB : start.endA).toBeFalsy();
    // Where it runs on into the lake, it doesn't stop.
    expect(along('A3', 'B2')!.endA || along('A3', 'B2')!.endB).toBeFalsy();
    expect(along('B2', 'B3')!.endA || along('B2', 'B3')!.endB).toBeFalsy();
  });

  it("doesn't stop a river at the map's outer edge", () => {
    const edgeRiver = mapBorders(buildBoard({ rows: ['Fa Fo', 'Mo Tu'], rivers: ['A1|A2'], homeBases: {} })).find((e) => e.kind === 'river')!;
    // One corner is inside (A1, A2 and B1 meet), the other on the outside: only the inside one stops.
    expect([edgeRiver.endA, edgeRiver.endB].filter(Boolean)).toHaveLength(1);
  });
});

describe('riverSpan', () => {
  const e: BorderEdge = { kind: 'river', a: [0, 0], b: [100, 0] };
  const xs = (span: number[][]) => span.map((p) => Math.round(p[0]!));
  it('runs the whole edge when it stops at neither corner', () => {
    expect(riverSpan(e)).toEqual([[0, 0], [100, 0]]);
  });
  it('stops short of a corner it ends at', () => {
    expect(xs(riverSpan({ ...e, endB: true }))).toEqual([0, 55]);
    expect(xs(riverSpan({ ...e, endA: true }))).toEqual([45, 100]);
  });
  it('keeps a middle stretch when it stops at both', () => {
    expect(xs(riverSpan({ ...e, endA: true, endB: true }))).toEqual([30, 70]);
  });
});
