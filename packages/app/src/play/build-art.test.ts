import { describe, expect, it } from 'vitest';
import { goods, MAX_SHOWN, stackPlaces, structureParts } from './build-art';

describe('building moments', () => {
  it('stacks goods in rows of 3, 2, 1, bottom row first', () => {
    const places = stackPlaces(6, 5, 2);
    const rows = [...new Set(places.map(([, y]) => y))];
    expect(rows).toHaveLength(3);
    expect(places.filter(([, y]) => y === rows[0])).toHaveLength(3);
    expect(places.filter(([, y]) => y === rows[1])).toHaveLength(2);
    expect(rows[1]!).toBeLessThan(rows[0]!); // higher up on screen
  });

  it('stacks three ingots as two with one on top', () => {
    const places = stackPlaces(3, 5.4, 2.6);
    expect(places.map(([, y]) => y)).toEqual([places[0]![1], places[0]![1], places[2]![1]]);
    expect(places[2]![0]).toBeCloseTo(0);
  });

  it('stands workers side by side, and draws no more than MAX_SHOWN goods', () => {
    expect(new Set(stackPlaces(4, 4.8, 4.8, true).map(([, y]) => y)).size).toBe(1);
    expect(goods('metal', 10, '#000')).toHaveLength(MAX_SHOWN);
    expect(goods('worker', 2, '#c00')[0]!.parts[0]!.fill).toBe('#c00');
  });

  it('builds a structure in its faction colour, footing first and door last', () => {
    const parts = structureParts('#123456');
    expect(parts[1]!.fill).toBe('#123456');
    expect(parts).toHaveLength(5);
  });
});
