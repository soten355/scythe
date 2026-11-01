import { describe, expect, it } from 'vitest';
import { backdropFor, ridge } from './scenery';

describe('fight backgrounds', () => {
  it('has one for each resource hex and the Factory', () => {
    for (const t of ['forest', 'tundra', 'mountain', 'farm', 'factory'] as const) expect(backdropFor(t)).toBe(t);
  });

  it('uses the farm for villages and anything else', () => {
    expect(backdropFor('village')).toBe('farm');
    expect(backdropFor('lake')).toBe('farm');
  });

  it('draws the same hills every time', () => {
    expect(ridge({ base: 400, height: 200, points: 8, seed: 3 })).toBe(ridge({ base: 400, height: 200, points: 8, seed: 3 }));
  });
});
