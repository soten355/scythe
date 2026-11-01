import { describe, expect, it } from 'vitest';
import { backdropFor, ridge } from './scenery';

describe('fight backgrounds', () => {
  it('has one for each resource hex, the Factory and lakes (Seaworthy and Submerge fights)', () => {
    for (const t of ['forest', 'tundra', 'mountain', 'farm', 'factory', 'lake'] as const) expect(backdropFor(t)).toBe(t);
  });

  it('uses the farm for villages and anything else', () => {
    expect(backdropFor('village')).toBe('farm');
    expect(backdropFor('somewhere')).toBe('farm');
  });

  it('draws the same hills every time', () => {
    expect(ridge({ base: 400, height: 200, points: 8, seed: 3 })).toBe(ridge({ base: 400, height: 200, points: 8, seed: 3 }));
  });
});
