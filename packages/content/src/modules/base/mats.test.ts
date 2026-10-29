import { validateMat } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { baseMats } from './mats';

describe('base player mats', () => {
  it('are all valid mats with unique IDs and turn orders', () => {
    for (const mat of baseMats) expect(validateMat(mat), mat.name).toEqual([]);
    expect(new Set(baseMats.map((m) => m.id)).size).toBe(baseMats.length);
    expect(new Set(baseMats.map((m) => m.turnOrder)).size).toBe(baseMats.length);
  });

  it('include Industrial and Engineering as mats 1 and 2', () => {
    expect(baseMats.find((m) => m.name === 'Industrial')).toMatchObject({ id: 'mat-1', turnOrder: 1 });
    expect(baseMats.find((m) => m.name === 'Engineering')).toMatchObject({ id: 'mat-2', turnOrder: 2, coins: 5 });
  });
});
