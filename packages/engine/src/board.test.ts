import { describe, expect, it } from 'vitest';
import { buildBoard, hasRiver, homeBaseNeighbors, neighbors, type BoardLayout } from './board';

// A tiny 3-row board:
//   A1 A2 A3
//     B1 B2 B3      (odd rows sit half a hex to the right)
//   C1 C2 C3
const tiny: BoardLayout = {
  rows: ['Fa Fo* Mo', 'Tu FF ~~', 'ViT -- Fa'],
  rivers: ['A1|A2', 'B2|C3'],
  homeBases: { west: ['A1', 'B1'] },
};

describe('buildBoard', () => {
  const board = buildBoard(tiny);

  it('reads terrain, tunnels and encounters from the row codes', () => {
    expect(board.hexes.A1).toMatchObject({ terrain: 'farm', tunnel: false, encounter: false });
    expect(board.hexes.A2).toMatchObject({ terrain: 'forest', encounter: true });
    expect(board.hexes.B2?.terrain).toBe('factory');
    expect(board.hexes.B3?.terrain).toBe('lake');
    expect(board.hexes.C1).toMatchObject({ terrain: 'village', tunnel: true });
  });

  it('skips empty slots', () => {
    expect(board.hexes.C2).toBeUndefined();
    expect(Object.keys(board.hexes)).toHaveLength(8);
  });

  it('finds the six neighbors of a hex, accounting for the row offset', () => {
    expect([...neighbors(board, 'B2')].sort()).toEqual(['A2', 'A3', 'B1', 'B3', 'C3'].sort());
    expect([...neighbors(board, 'A1')].sort()).toEqual(['A2', 'B1'].sort());
    expect([...neighbors(board, 'C1')].sort()).toEqual(['B1'].sort());
  });

  it('reports rivers in both directions, and only where listed', () => {
    expect(hasRiver(board, 'A1', 'A2')).toBe(true);
    expect(hasRiver(board, 'A2', 'A1')).toBe(true);
    expect(hasRiver(board, 'C3', 'B2')).toBe(true);
    expect(hasRiver(board, 'A2', 'A3')).toBe(false);
  });

  it('lists the hexes next to a home base', () => {
    expect(homeBaseNeighbors(board, 'west')).toEqual(['A1', 'B1']);
  });

  it('produces plain JSON data', () => {
    expect(JSON.parse(JSON.stringify(board))).toEqual(board);
  });
});

describe('buildBoard with even rows shifted', () => {
  //   A1 A2     (row A sits half a hex to the right)
  // B1 B2
  const board = buildBoard({ rows: ['Fa Fo', 'Mo Tu'], rivers: [], homeBases: {}, shiftEvenRows: true });

  it('offsets row A instead of row B', () => {
    expect([...neighbors(board, 'B1')].sort()).toEqual(['A1', 'B2']);
    expect([...neighbors(board, 'B2')].sort()).toEqual(['A1', 'A2', 'B1']);
  });
});

describe('home base positions', () => {
  // @w marks where home base "w" sits on the grid; it is not a hex.
  const board = buildBoard({ rows: ['@w Fa Fo'], rivers: [], homeBases: { w: ['A2'] } });

  it('records the position without making it a hex', () => {
    expect(board.homeBasePositions.w).toEqual({ q: 1, r: 0 });
    expect(board.hexes.A1).toBeUndefined();
    expect(board.hexes.A2?.terrain).toBe('farm');
    expect([...neighbors(board, 'A2')]).toEqual(['A3']);
  });

  it('rejects a home base placed twice', () => {
    expect(() => buildBoard({ rows: ['@w Fa @w'], rivers: [], homeBases: {} })).toThrow(/home base w is placed twice/);
  });
});

describe('buildBoard rejects bad layouts', () => {
  const bad = (patch: Partial<BoardLayout>) => () => buildBoard({ ...tiny, ...patch });

  it('unknown terrain code', () => {
    expect(bad({ rows: ['Fa Xx'] })).toThrow(/unknown terrain code "Xx" at A2/);
  });
  it('river between hexes that do not touch', () => {
    expect(bad({ rivers: ['A1|A3'] })).toThrow(/river A1\|A3/);
  });
  it('river naming a missing hex', () => {
    expect(bad({ rivers: ['A1|C2'] })).toThrow(/river A1\|C2/);
  });
  it('home base next to a lake or a missing hex', () => {
    expect(bad({ homeBases: { east: ['B3'] } })).toThrow(/home base east/);
    expect(bad({ homeBases: { east: ['Z9'] } })).toThrow(/home base east/);
  });
});
