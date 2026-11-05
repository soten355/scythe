import { describe, expect, it } from 'vitest';
import { baseFactions, baseMats } from '@scythe/content';
import { BUILT_IN } from '../content/catalog';
import { DEFAULT_THEME, setPicture } from '../theme/theme';
import { applyWords, cardsToShare, freeName, newSkin, ORIGINAL, parseSkinCards, parseSkinFile, skinFileName, skinFileText, useSkinCards, type Skin } from './skin';
import { EMPTY_LIBRARY } from '../content/library';

const nordic = baseFactions[0]!;
const words: Skin['words'] = {
  factions: {
    [nordic.id]: {
      name: 'Frostwake',
      color: '#88aacc',
      ability: { name: 'Ice Stride', description: 'Your workers cross rivers.' },
      mechAbilities: [{ name: 'Glide' }, {}, { description: 'Our own words.' }, {}],
    },
  },
  mats: { [baseMats[0]!.id]: { name: 'Guild' } },
  maps: { standard: { name: 'The Frozen Reach' } },
};

describe('skins', () => {
  it('the Original skin is the usual look, with no words changed', () => {
    expect(ORIGINAL.id).toBe('original');
    expect(ORIGINAL.theme).toEqual(DEFAULT_THEME);
    expect(applyWords(BUILT_IN, ORIGINAL.words)).toEqual(BUILT_IN);
  });

  it('renames factions, mats and maps and rewords abilities, keeping every rule', () => {
    const skinned = applyWords(BUILT_IN, words);
    const f = skinned.factions.find((x) => x.id === nordic.id)!;
    expect(f.name).toBe('Frostwake');
    expect(f.color).toBe('#88aacc');
    expect(f.ability).toEqual({ ...nordic.ability, name: 'Ice Stride', description: 'Your workers cross rivers.' });
    expect(f.mechAbilities[0]).toEqual({ ...nordic.mechAbilities[0], name: 'Glide' });
    expect(f.mechAbilities[1]).toEqual(nordic.mechAbilities[1]);
    expect(f.mechAbilities[2]).toEqual({ ...nordic.mechAbilities[2], description: 'Our own words.' });
    // Everything else the same: ID, home, power, cards, stars, recruit bonuses, the abilities' rules.
    const { name: _n, color: _c, ability: _a, mechAbilities: _m, ...rest } = f;
    const { name: _n2, color: _c2, ability: _a2, mechAbilities: _m2, ...was } = nordic;
    expect(rest).toEqual(was);
    expect(skinned.factions.filter((x) => x.id !== nordic.id)).toEqual(BUILT_IN.factions.filter((x) => x.id !== nordic.id));
    expect(skinned.mats.find((m) => m.id === baseMats[0]!.id)!.name).toBe('Guild');
    expect(skinned.maps[0]!.name).toBe('The Frozen Reach');
    expect(skinned.maps[0]!.board).toBe(BUILT_IN.maps[0]!.board);
  });

  it('a blank word keeps the original', () => {
    const skinned = applyWords(BUILT_IN, { factions: { [nordic.id]: { name: '  ', ability: { name: '' } } }, mats: {}, maps: {} });
    expect(skinned.factions[0]).toEqual(nordic);
  });

  it('a new skin copies another under a new name and ID', () => {
    const from = { ...ORIGINAL, theme: setPicture(DEFAULT_THEME, 'ui.menu', 'data:image/png;base64,AAAA'), words };
    const copy = newSkin('Iron Tide', from, 'abc');
    expect(copy).toEqual({ id: 'abc', name: 'Iron Tide', theme: from.theme, words });
  });

  it('gives a skin a name not taken yet', () => {
    expect(freeName('Iron Tide', [])).toBe('Iron Tide');
    expect(freeName('Iron Tide', ['Iron Tide'])).toBe('Iron Tide (2)');
    expect(freeName('Iron Tide', ['Iron Tide', 'Iron Tide (2)'])).toBe('Iron Tide (3)');
    expect(freeName('Original', [])).toBe('Original (2)');
  });

  it('saves to a file and reads it back, as a new skin on this device', () => {
    const skin: Skin = { id: 'x1', name: 'Iron Tide', theme: setPicture(DEFAULT_THEME, 'faction.nordic.crest', 'data:image/png;base64,AAAA'), words };
    expect(skinFileName(skin)).toBe('scythe-skin-iron-tide.scythe-skin.json');
    const back = parseSkinFile(skinFileText(skin), 'y2');
    expect(back).toEqual({ ...skin, id: 'y2' });
  });

  it('keeps only words it knows, as plain text, and only colours that are colours', () => {
    const text = JSON.stringify({
      format: 'scythe-skin',
      formatVersion: 1,
      name: 'Odd',
      theme: { pictures: { 'ui.menu': 'https://example.com/x.png' } },
      words: {
        factions: { nordic: { name: 7, color: 'red; background: url(x)', ability: { name: 'Fine' }, mechAbilities: [{ name: 'A' }, 'junk'], power: 99 } },
        mats: { m: { name: 'M', coins: 50 } },
        maps: 'nope',
      },
    });
    const skin = parseSkinFile(text, 'z');
    expect(skin.theme.pictures).toEqual({});
    expect(skin.words).toEqual({ factions: { nordic: { ability: { name: 'Fine' }, mechAbilities: [{ name: 'A' }, {}] } }, mats: { m: { name: 'M' } }, maps: {} });
  });

  it("says plainly when a file isn't a skin", () => {
    expect(() => parseSkinFile('{"format":"scythe-theme"}', 'a')).toThrow("This file isn't a Scythe skin.");
    expect(() => parseSkinFile('not json', 'a')).toThrow("This file isn't a Scythe skin.");
    expect(() => parseSkinFile('{"format":"scythe-skin","formatVersion":99}', 'a')).toThrow(/newer version/);
  });

  describe('with its cards', () => {
    const encounter = { ...BUILT_IN.encounters![0]!, id: 'my-e1', name: 'My card', picture: 'pic-abc' };
    const factory = { ...BUILT_IN.factory![0]!, id: 'my-f1', name: 'My Factory card' };
    const objective = { ...BUILT_IN.objectives![0]!, id: 'my-o1', name: 'My objective' };
    const library = { ...EMPTY_LIBRARY, encounters: [encounter], factory: [factory], objectives: [objective] };
    const kept = { 'pic-abc': 'data:image/jpeg;base64,AAAA', 'pic-unused': 'data:image/jpeg;base64,BBBB' };
    const skin: Skin = { id: 'x1', name: 'Iron Tide', theme: DEFAULT_THEME, words };

    it("shares the player's own decks, with only the pictures they use (never the made-up samples)", () => {
      expect(cardsToShare(library, kept)).toEqual({ encounters: [encounter], factory: [factory], objectives: [objective], pictures: { 'pic-abc': kept['pic-abc'] } });
      expect(cardsToShare(EMPTY_LIBRARY, kept)).toBeUndefined();
    });

    it('carries them in the file, and reads them back', () => {
      const text = skinFileText(skin, cardsToShare(library, kept));
      expect(parseSkinFile(text, 'y')).toEqual({ ...skin, id: 'y' });
      expect(parseSkinCards(text)).toEqual(cardsToShare(library, kept));
      expect(parseSkinCards(skinFileText(skin))).toBeUndefined();
    });

    it('turns down cards that are not complete', () => {
      const text = skinFileText(skin, { encounters: [{ ...encounter, options: [] } as never], factory: [], objectives: [], pictures: {} });
      expect(() => parseSkinCards(text)).toThrow(/My card can't be used/);
    });

    it('its decks take the place of the ones new games use; decks it lacks stay', () => {
      const mine = { ...EMPTY_LIBRARY, encounters: [{ ...encounter, id: 'old' }], factory: [{ ...factory, id: 'old-f' }] };
      const next = useSkinCards(mine, { encounters: [encounter], factory: [], objectives: [objective], pictures: {} });
      expect(next.encounters).toEqual([encounter]);
      expect(next.factory).toEqual(mine.factory);
      expect(next.objectives).toEqual([objective]);
    });
  });
});
