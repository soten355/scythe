import { validateFaction } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { formatFactions, homeBaseClashes, newFaction } from './model';

describe('faction editor model', () => {
  it('starts a new faction that is already valid', () => {
    const f = newFaction('f1', 'w');
    expect(f).toMatchObject({ id: 'f1', homeBase: 'w', stars: 6 });
    expect(f.mechAbilities).toHaveLength(4);
    expect(validateFaction(f)).toEqual([]);
  });

  it('flags two factions sharing a home base', () => {
    const a = newFaction('a', 'w');
    const b = newFaction('b', 'w');
    const c = newFaction('c', 'e');
    expect(homeBaseClashes([a, b, c])).toEqual(['W is used by more than one faction']);
    expect(homeBaseClashes([a, c])).toEqual([]);
  });

  it('exports factions as text that parses back to the same data', () => {
    const list = [newFaction('a', 'w'), newFaction('b', 'e')];
    expect(JSON.parse(formatFactions(list))).toEqual(list);
  });
});
