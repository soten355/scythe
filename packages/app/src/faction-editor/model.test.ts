import { validateFaction } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { baseFactions } from '@scythe/content';
import { NO_WORDS } from '../skins/skin';
import { formatFactions, homeBaseClashes, newFaction, wordsFromCopy } from './model';

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

  it("moves name and wording changes made to a built-in faction's copy into the skin's words", () => {
    const nordic = baseFactions[0]!;
    const copy = {
      ...nordic,
      name: 'Frostwake',
      power: 9,
      ability: { ...nordic.ability, description: 'Our words.' },
      mechAbilities: nordic.mechAbilities.map((m, i) => (i === 1 ? { ...m, name: 'Glide' } : m)) as typeof nordic.mechAbilities,
    };
    expect(wordsFromCopy(nordic, copy, NO_WORDS).factions[nordic.id]).toEqual({ name: 'Frostwake', ability: { description: 'Our words.' }, mechAbilities: [{}, { name: 'Glide' }, {}, {}] });
    // What the skin already says wins; an unchanged copy changes nothing.
    const said = { ...NO_WORDS, factions: { [nordic.id]: { name: 'Iceborn' } } };
    expect(wordsFromCopy(nordic, copy, said).factions[nordic.id]!.name).toBe('Iceborn');
    expect(wordsFromCopy(nordic, nordic, NO_WORDS)).toBe(NO_WORDS);
  });
});
