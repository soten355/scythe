import { baseFactions } from '@scythe/content';
import { describe, expect, it } from 'vitest';
import { inkOn, isLight } from './ink';

describe('text on a faction colour', () => {
  it('is black on the light base factions (Polonia, Crimea) and white on the others', () => {
    const light = baseFactions.filter((f) => isLight(f.color)).map((f) => f.id);
    expect(light.sort()).toEqual(['crimea', 'polonia']);
  });

  it('reads short colours, and falls back to white for anything it cannot read', () => {
    expect(inkOn('#fff')).toBe('#1e1a16');
    expect(inkOn('#000')).toBe('#ffffff');
    expect(inkOn('tomato')).toBe('#ffffff');
  });
});
