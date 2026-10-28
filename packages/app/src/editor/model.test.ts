import { baseBoardLayout } from '@scythe/content';
import { buildBoard, neighbors, type BoardLayout } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import {
  addCol,
  addRow,
  edgeKey,
  formatLayout,
  fromLayout,
  labelOf,
  slotsTouch,
  toLayout,
  toggleHome,
  toggleRiver,
} from './model';

// Builds a board with rivers in a fixed order, so boards can be compared.
const board = (layout: BoardLayout) => {
  const b = buildBoard(layout);
  return { ...b, rivers: b.rivers.map((pair) => [...pair].sort().join('|')).sort() };
};

describe('map editor model', () => {
  it('round-trips the base layout unchanged', () => {
    const layout = toLayout(fromLayout(baseBoardLayout));
    expect(board(layout)).toEqual(board(baseBoardLayout));
  });

  it('keeps the map identical when rows and columns are added on every side', () => {
    let map = fromLayout(baseBoardLayout);
    map = addRow(map, 'top');
    map = addRow(map, 'bottom');
    map = addCol(map, 'left');
    map = addCol(map, 'right');
    expect(board(toLayout(map))).toEqual(board(baseBoardLayout));
  });

  it('labels hexes as they will be exported, even with an empty row on top', () => {
    const map = addRow(fromLayout(baseBoardLayout), 'top');
    expect(labelOf(map, '1,0')).toBe('A1');
    expect(labelOf(map, '0,0')).toBeNull();
  });

  it('records the row shift when the top row is trimmed away', () => {
    let map = fromLayout({ rows: ['-- --', 'Fa Fo', 'Mo Tu'], rivers: [], homeBases: {} });
    const layout = toLayout(map);
    expect(layout.rows).toEqual(['Fa Fo', 'Mo Tu']);
    expect(layout.shiftEvenRows).toBe(true);
    // Geometry is preserved: old B1 (now A1) still touches old C1 and C2.
    const trimmed = buildBoard(layout);
    expect([...neighbors(trimmed, 'A1')].sort()).toEqual(['A2', 'B1', 'B2']);
    map = addRow(map, 'top');
    expect(buildBoard(toLayout(map))).toEqual(trimmed);
  });

  it('toggles rivers only between touching slots, and drops ones by empty slots', () => {
    let map = fromLayout({ rows: ['Fa Fo Mo'], rivers: [], homeBases: {} });
    expect(slotsTouch(map, '0,0', '0,1')).toBe(true);
    expect(slotsTouch(map, '0,0', '0,2')).toBe(false);
    map = toggleRiver(map, '0,0', '0,1');
    expect(map.rivers).toEqual([edgeKey('0,0', '0,1')]);
    expect(toLayout(map).rivers).toEqual(['A1|A2']);
    map = toggleRiver(map, '0,1', '0,0');
    expect(map.rivers).toEqual([]);
    map = toggleRiver(map, '0,1', '0,2');
    delete map.cells['0,2'];
    expect(toLayout(map).rivers).toEqual([]);
  });

  it('toggles which hexes a home base borders', () => {
    let map = fromLayout({ rows: ['Fa Fo'], rivers: [], homeBases: { w: [] } });
    map = toggleHome(map, 'w', '0,0');
    map = toggleHome(map, 'w', '0,1');
    map = toggleHome(map, 'w', '0,0');
    expect(toLayout(map).homeBases).toEqual({ w: ['A2'] });
  });

  it('formats the export so it can be pasted straight into the content file', () => {
    const text = formatLayout(toLayout(fromLayout(baseBoardLayout)));
    expect(text).toContain("/* A */ 'Fo  Mo  Fa  Vi* Fo  Tu  Vi',");
    expect(text).toContain("nw: ['A2', 'A3'],");
    expect(text).not.toContain('shiftEvenRows');
  });
});
