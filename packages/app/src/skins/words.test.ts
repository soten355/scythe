import { describe, expect, it } from 'vitest';
import { NO_WORDS } from './skin';
import { copyLore, setAbilityWord, setFactionWord, setLoreWord, setNameWord } from './words';

describe("changing a skin's words", () => {
  it('sets and clears a faction name and colour', () => {
    let w = setFactionWord(NO_WORDS, 'nordic', 'name', ' Frostwake ');
    w = setFactionWord(w, 'nordic', 'color', '#123456');
    expect(w.factions).toEqual({ nordic: { name: 'Frostwake', color: '#123456' } });
    w = setFactionWord(w, 'nordic', 'name', '');
    w = setFactionWord(w, 'nordic', 'color', '');
    expect(w.factions).toEqual({});
  });

  it('sets ability and mech ability words, and takes out what goes blank', () => {
    let w = setAbilityWord(NO_WORDS, 'nordic', 'ability', 'name', 'Ice Stride');
    w = setAbilityWord(w, 'nordic', 2, 'description', 'Our words.');
    expect(w.factions.nordic).toEqual({ ability: { name: 'Ice Stride' }, mechAbilities: [{}, {}, { description: 'Our words.' }, {}] });
    w = setAbilityWord(w, 'nordic', 'ability', 'name', ' ');
    w = setAbilityWord(w, 'nordic', 2, 'description', '');
    expect(w.factions).toEqual({});
  });

  it("sets a faction's story, and takes out what goes blank", () => {
    let w = setLoreWord(NO_WORDS, 'nordic', 'characterName', ' Ingrid ');
    w = setLoreWord(w, 'nordic', 'history', 'Line one.\nLine two.');
    expect(w.factions.nordic).toEqual({ lore: { characterName: 'Ingrid', history: 'Line one.\nLine two.' } });
    w = setLoreWord(w, 'nordic', 'characterName', ' ');
    w = setLoreWord(w, 'nordic', 'history', '');
    expect(w.factions).toEqual({});
  });

  it("keeps a faction's other words when its story changes", () => {
    let w = setFactionWord(NO_WORDS, 'nordic', 'name', 'Frostwake');
    w = setLoreWord(w, 'nordic', 'capital', 'Harrowhold');
    w = setLoreWord(w, 'nordic', 'capital', '');
    expect(w.factions).toEqual({ nordic: { name: 'Frostwake' } });
  });

  it("copies a story to a new ID, or moves it there, and leaves the faction's other words", () => {
    let w = setFactionWord(NO_WORDS, 'mine', 'name', 'Mine');
    w = setLoreWord(w, 'mine', 'goals', 'Win.');
    const copied = copyLore(w, 'mine', 'mine-copy');
    expect(copied.factions).toEqual({ mine: { name: 'Mine', lore: { goals: 'Win.' } }, 'mine-copy': { lore: { goals: 'Win.' } } });
    const moved = copyLore(w, 'mine', 'other', { move: true });
    expect(moved.factions).toEqual({ mine: { name: 'Mine' }, other: { lore: { goals: 'Win.' } } });
    // Nothing to copy: nothing changes.
    expect(copyLore(NO_WORDS, 'mine', 'other')).toBe(NO_WORDS);
  });

  it('names mats and maps', () => {
    let w = setNameWord(NO_WORDS, 'mats', 'industrial', 'Guild');
    w = setNameWord(w, 'maps', 'standard', 'The Reach');
    expect(w).toEqual({ factions: {}, mats: { industrial: { name: 'Guild' } }, maps: { standard: { name: 'The Reach' } } });
    expect(setNameWord(w, 'mats', 'industrial', '').mats).toEqual({});
  });
});
