import { validateFaction } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { baseFactions } from '@scythe/content';
import { NO_WORDS } from '../skins/skin';
import { formatFactions, homeBaseClashes, newFaction, withBuiltIns, wordsFromCopy } from './model';

describe("the editor's saved list and the built-in factions", () => {
  const saxony = baseFactions.find((f) => f.id === 'saxony')!;

  it('leaves a list that already has them all as it is, with its own factions after', () => {
    const mine = newFaction('mine', 'w');
    const { factions, strays } = withBuiltIns([mine, ...baseFactions], baseFactions);
    expect(factions.map((f) => f.id)).toEqual([...baseFactions.map((f) => f.id), 'mine']);
    expect(strays).toEqual([]);
  });

  it('adds a built-in faction missing from the list', () => {
    const { factions, strays } = withBuiltIns(baseFactions.filter((f) => f !== saxony), baseFactions);
    expect(factions.map((f) => f.id)).toEqual(baseFactions.map((f) => f.id));
    expect(strays).toEqual([]);
  });

  it('gives an old copy under another ID the built-in ID, and says so, so its pictures can follow', () => {
    const copy = { ...saxony, id: 'saxon', name: ' saxony ' };
    const { factions, strays } = withBuiltIns([...baseFactions.filter((f) => f !== saxony), copy], baseFactions);
    expect(factions.map((f) => f.id)).toEqual(baseFactions.map((f) => f.id));
    expect(factions.find((f) => f.id === 'saxony')!.name).toBe('Saxony');
    expect(strays).toEqual([{ from: 'saxon', to: 'saxony' }]);
  });

  it("keeps the player's own factions: a duplicate, another name, or the same name with other numbers", () => {
    const duplicate = { ...saxony, id: 'saxony-copy', name: 'Saxony (copy)' };
    const renamed = { ...saxony, id: 'mine', name: 'Blackmoor' };
    const stronger = { ...saxony, id: 'strong', name: 'Saxony', power: saxony.power + 3 };
    const { factions, strays } = withBuiltIns([...baseFactions.filter((f) => f !== saxony), duplicate, renamed, stronger], baseFactions);
    expect(factions.map((f) => f.id)).toEqual([...baseFactions.map((f) => f.id), 'saxony-copy', 'mine', 'strong']);
    expect(strays).toEqual([]);
  });

  it('leaves a same-named copy alone when the built-in is already there', () => {
    const copy = { ...saxony, id: 'saxon' };
    const { factions, strays } = withBuiltIns([...baseFactions, copy], baseFactions);
    expect(factions.map((f) => f.id)).toEqual([...baseFactions.map((f) => f.id), 'saxon']);
    expect(strays).toEqual([]);
  });
});

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
