import { describe, expect, it } from 'vitest';
import { countText, paysText } from './structure-bonus-text';

describe('structure bonus tiles in words', () => {
  it('says what a tile counts', () => {
    expect(countText({ kind: 'adjacent', feature: 'tunnel' })).toBe('Tunnels next to your structures');
    expect(countText({ kind: 'adjacent', feature: 'lake' })).toBe('Lakes next to your structures');
    expect(countText({ kind: 'adjacent', feature: 'encounter' })).toBe('Encounter spots next to your structures');
    expect(countText({ kind: 'on', tunnel: true })).toBe('Your structures on tunnels');
    expect(countText({ kind: 'on', terrains: ['farm', 'tundra'] })).toBe('Your structures on farms or tundras');
    expect(countText({ kind: 'on', tunnel: true, terrains: ['village'] })).toBe('Your structures on tunnels or villages');
    expect(countText({ kind: 'inRow' })).toBe('Your structures in one straight row');
  });

  it('lists its payouts', () => {
    expect(paysText([{ atLeast: 1, coins: 2 }, { atLeast: 3, coins: 5 }])).toBe('1+: 2 coins · 3+: 5 coins');
  });
});
