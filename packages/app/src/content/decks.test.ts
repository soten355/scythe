import { baseEncounters, baseFactoryCards, baseObjectives } from '@scythe/content';
import { describe, expect, it } from 'vitest';
import { BUILT_IN } from './catalog';
import { deckOf, deckSources, fitDecks, loadDecks, saveDecks, withDecks, DEFAULT_DECKS } from './decks';
import { catalogWith, EMPTY_LIBRARY, type Library } from './library';

const myCards = [
  { ...baseEncounters[0]!, id: 'card-1', name: 'The bridge' },
  { ...baseEncounters[1]!, id: 'card-2', name: 'The well' },
];
// A Factory card made in the editor can share an ID with a base card (factory-1).
const myFactory = [{ ...baseFactoryCards[0]!, name: 'Gears' }];
const library: Library = { ...EMPTY_LIBRARY, encounters: myCards, factory: myFactory };

describe('choosing the decks for a new game', () => {
  it('offers the base deck, and yours and both once you have your own', () => {
    expect(deckSources(EMPTY_LIBRARY, 'encounters')).toEqual(['base']);
    expect(deckSources(library, 'encounters')).toEqual(['base', 'mine', 'both']);
    expect(deckSources(library, 'objectives')).toEqual(['base']);
  });

  it('gives the base deck, yours, or both together', () => {
    expect(deckOf(BUILT_IN, library, 'encounters', 'base')).toBe(baseEncounters);
    expect(deckOf(BUILT_IN, library, 'encounters', 'mine')).toBe(myCards);
    expect(deckOf(BUILT_IN, library, 'encounters', 'both')).toEqual([...baseEncounters, ...myCards]);
  });

  it('keeps every card ID different when two decks are combined', () => {
    const both = deckOf(BUILT_IN, library, 'factory', 'both');
    expect(both).toHaveLength(baseFactoryCards.length + 1);
    expect(new Set(both.map((c) => c.id)).size).toBe(both.length);
    expect(both.at(-1)).toMatchObject({ id: 'factory-1-yours', name: 'Gears' });
  });

  it('falls back to the base deck when yours is gone', () => {
    expect(fitDecks({ encounters: 'both', factory: 'mine', objectives: 'mine' }, library)).toEqual({ encounters: 'both', factory: 'mine', objectives: 'base' });
    expect(fitDecks({ encounters: 'mine', factory: 'both', objectives: 'base' }, EMPTY_LIBRARY)).toEqual(DEFAULT_DECKS);
  });

  it('puts the chosen decks in what a new game draws from', () => {
    const catalog = catalogWith(BUILT_IN, library);
    const chosen = withDecks(catalog, BUILT_IN, library, { encounters: 'base', factory: 'both', objectives: 'mine' });
    expect(chosen.encounters).toBe(baseEncounters);
    expect(chosen.factory).toHaveLength(baseFactoryCards.length + 1);
    // No deck of your own: the base deck.
    expect(chosen.objectives).toBe(baseObjectives);
    expect(chosen.factions).toBe(catalog.factions);
  });

  it('remembers the choice on the device', () => {
    const kept = new Map<string, string>();
    const storage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) };
    expect(loadDecks(storage)).toEqual(DEFAULT_DECKS);
    saveDecks({ encounters: 'both', factory: 'base', objectives: 'mine' }, storage);
    expect(loadDecks(storage)).toEqual({ encounters: 'both', factory: 'base', objectives: 'mine' });
    kept.set('scythe-decks', '{"encounters":"nonsense"');
    expect(loadDecks(storage)).toEqual(DEFAULT_DECKS);
    kept.set('scythe-decks', '{"encounters":"nonsense"}');
    expect(loadDecks(storage)).toEqual(DEFAULT_DECKS);
  });
});
