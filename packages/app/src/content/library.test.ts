import { describe, expect, it } from 'vitest';
import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import type { GameSetup } from '@scythe/engine';
import type { Catalog } from '../menu/setup';
import { createSave, saveFileText } from '../saves/save';
import { addToLibrary, catalogWith, contentFileName, contentFileText, EMPTY_LIBRARY, parseContentFile, removeFromLibrary, type Library } from './library';

const builtIn: Catalog = {
  maps: [{ id: 'standard', name: 'Standard map', board: baseBoard }],
  factions: baseFactions,
  mats: baseMats,
};
const nordic = baseFactions[0]!;
const firstMat = baseMats[0]!;
const myFaction = { ...nordic, id: 'wolves', name: 'Wolves', color: '#445566', power: 4 };
const myMat = { ...firstMat, id: 'odd', name: 'Odd', coins: 8 };
const myMap = { id: 'island', name: 'Island', board: { ...baseBoard, rivers: [] } };

describe('adding to the library', () => {
  it('adds new maps, factions and mats, and says what was added', () => {
    const { library, added } = addToLibrary(EMPTY_LIBRARY, builtIn, { maps: [myMap], factions: [myFaction], mats: [myMat] });
    expect(library).toEqual({ maps: [myMap], factions: [myFaction], mats: [myMat] });
    expect(added).toEqual(['Island', 'Wolves', 'Odd']);
  });

  it('skips anything exactly like a built-in one or one already added', () => {
    const once = addToLibrary(EMPTY_LIBRARY, builtIn, { maps: [], factions: [myFaction], mats: [] }).library;
    const { library, added } = addToLibrary(once, builtIn, { maps: [builtIn.maps[0]!], factions: [nordic, myFaction], mats: [firstMat] });
    expect(library).toEqual(once);
    expect(added).toEqual([]);
  });

  it('a renamed copy of a built-in one is added', () => {
    const { library, added } = addToLibrary(EMPTY_LIBRARY, builtIn, { maps: [{ ...builtIn.maps[0]!, id: 'copy', name: 'Copy' }], factions: [], mats: [] });
    expect(library.maps.map((m) => m.name)).toEqual(['Copy']);
    expect(added).toEqual(['Copy']);
  });

  it('a changed built-in one is added alongside it, marked custom', () => {
    const changed = { ...nordic, power: 6 };
    const { library } = addToLibrary(EMPTY_LIBRARY, builtIn, { maps: [], factions: [changed], mats: [] });
    expect(library.factions).toEqual([{ ...changed, id: `${nordic.id}-custom`, name: `${nordic.name} (custom)` }]);
  });

  it('a newer version of one already added replaces it', () => {
    const once = addToLibrary(EMPTY_LIBRARY, builtIn, { maps: [], factions: [myFaction], mats: [] }).library;
    const newer = { ...myFaction, power: 2 };
    const { library, added } = addToLibrary(once, builtIn, { maps: [], factions: [newer], mats: [] });
    expect(library.factions).toEqual([newer]);
    expect(added).toEqual(['Wolves']);
  });

  it('changing a built-in one twice keeps one custom version', () => {
    let lib: Library = EMPTY_LIBRARY;
    lib = addToLibrary(lib, builtIn, { maps: [], factions: [{ ...nordic, power: 6 }], mats: [] }).library;
    lib = addToLibrary(lib, builtIn, { maps: [], factions: [{ ...nordic, power: 1 }], mats: [] }).library;
    expect(lib.factions.map((f) => [f.id, f.power])).toEqual([[`${nordic.id}-custom`, 1]]);
  });

  it('a different one with a name already used gets a number', () => {
    const { library } = addToLibrary(EMPTY_LIBRARY, builtIn, { maps: [], factions: [{ ...myFaction, id: 'other', name: nordic.name }], mats: [] });
    expect(library.factions[0]!.name).toBe(`${nordic.name} (2)`);
  });

  it('removes', () => {
    const lib = addToLibrary(EMPTY_LIBRARY, builtIn, { maps: [myMap], factions: [myFaction], mats: [myMat] }).library;
    expect(removeFromLibrary(lib, 'factions', 'wolves').factions).toEqual([]);
    expect(removeFromLibrary(lib, 'maps', 'island').maps).toEqual([]);
    expect(removeFromLibrary(lib, 'mats', 'odd').mats).toEqual([]);
  });

  it('the new game screen offers built-in ones first, then the library', () => {
    const lib = addToLibrary(EMPTY_LIBRARY, builtIn, { maps: [myMap], factions: [myFaction], mats: [myMat] }).library;
    const all = catalogWith(builtIn, lib);
    expect(all.maps.map((m) => m.id)).toEqual(['standard', 'island']);
    expect(all.factions.at(-1)).toEqual(myFaction);
    expect(all.mats.at(-1)).toEqual(myMat);
  });
});

describe('content files', () => {
  it('round-trips maps, factions and mats', () => {
    const content = { maps: [myMap], factions: [myFaction], mats: [myMat] };
    expect(parseContentFile(contentFileText(content))).toEqual(content);
  });

  it('names the file after what is in it', () => {
    expect(contentFileName({ maps: [], factions: [myFaction], mats: [] })).toBe('scythe-wolves.scythe-content.json');
    expect(contentFileName({ maps: [myMap], factions: [myFaction], mats: [myMat] })).toBe('scythe-content.scythe-content.json');
  });

  it("takes a save file's map, factions and mats", () => {
    const setup: GameSetup = { seed: 1, board: myMap.board, players: [{ faction: myFaction, mat: myMat }, { faction: baseFactions[1]!, mat: baseMats[1]! }] };
    const content = parseContentFile(saveFileText(createSave(setup, 'g', new Date('2026-11-01T00:00:00Z'), 'Island')));
    expect(content.maps).toEqual([{ id: expect.stringMatching(/^map-/), name: 'Island', board: myMap.board }]);
    expect(content.factions).toEqual([myFaction, baseFactions[1]]);
    expect(content.mats).toEqual([myMat, baseMats[1]]);
  });

  it('a save without a map name names it after the game', () => {
    const setup: GameSetup = { seed: 1, board: myMap.board, players: [{ faction: myFaction, mat: myMat }, { faction: baseFactions[1]!, mat: baseMats[1]! }] };
    const content = parseContentFile(saveFileText(createSave(setup, 'g', new Date('2026-11-01T00:00:00Z'))));
    expect(content.maps[0]!.name).toBe(`Map from Wolves, ${baseFactions[1]!.name} game`);
  });

  it('rejects files that are neither', () => {
    expect(() => parseContentFile('nope')).toThrow(/isn't a Scythe content or save file/);
    expect(() => parseContentFile('{"a":1}')).toThrow(/isn't a Scythe content or save file/);
  });

  it('rejects broken factions, mats and maps, naming them', () => {
    const bad = (c: object) => () => parseContentFile(JSON.stringify({ format: 'scythe-content', formatVersion: 1, maps: [], factions: [], mats: [], ...c }));
    expect(bad({ factions: [{ ...myFaction, power: -3 }] })).toThrow(/Wolves/);
    expect(bad({ mats: [{ ...myMat, coins: 1.5 }] })).toThrow(/Odd/);
    expect(bad({ maps: [{ ...myMap, board: { ...myMap.board, homeBases: { x: ['Z99'] } } }] })).toThrow(/Island/);
    expect(bad({ maps: [{ id: 'm', name: 'Empty', board: { hexes: {} } }] })).toThrow(/Empty/);
  });
});
