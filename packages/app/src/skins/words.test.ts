import { describe, expect, it } from 'vitest';
import { NO_WORDS } from './skin';
import { setAbilityWord, setFactionWord, setNameWord } from './words';

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

  it('names mats and maps', () => {
    let w = setNameWord(NO_WORDS, 'mats', 'industrial', 'Guild');
    w = setNameWord(w, 'maps', 'standard', 'The Reach');
    expect(w).toEqual({ factions: {}, mats: { industrial: { name: 'Guild' } }, maps: { standard: { name: 'The Reach' } } });
    expect(setNameWord(w, 'mats', 'industrial', '').mats).toEqual({});
  });
});
