// Which encounter, Factory and objective decks a new game uses: the base
// game's, the player's own (from the editors or a file), or both shuffled
// together. Chosen on the new game screen and remembered on the device.
import type { Catalog } from '../menu/setup';
import type { Library } from './library';

export type DeckKind = 'encounters' | 'factory' | 'objectives';
export const DECK_KINDS: DeckKind[] = ['encounters', 'factory', 'objectives'];

/** The base game's deck, the player's own, or both together. */
export type DeckSource = 'base' | 'mine' | 'both';
export type DeckChoice = Record<DeckKind, DeckSource>;

export const DEFAULT_DECKS: DeckChoice = { encounters: 'base', factory: 'base', objectives: 'base' };
const SOURCES: readonly string[] = ['base', 'mine', 'both'];

/** What can be picked for a deck: yours and both only once you have a deck of your own. */
export const deckSources = (library: Library, kind: DeckKind): DeckSource[] => (library[kind].length ? ['base', 'mine', 'both'] : ['base']);

/** The same choice, with the base deck wherever yours is gone. */
export function fitDecks(choice: DeckChoice, library: Library): DeckChoice {
  return Object.fromEntries(DECK_KINDS.map((kind) => [kind, deckSources(library, kind).includes(choice[kind]) ? choice[kind] : 'base'])) as DeckChoice;
}

type Card = { id: string; name: string };

/** The cards of a deck. Combined, a card of yours that shares an ID with a base card gets "-yours" added to its ID, so every ID stays different. */
export function deckOf<K extends DeckKind>(builtIn: Catalog, library: Library, kind: K, source: DeckSource): Library[K] {
  const base = (builtIn[kind] ?? []) as Library[K];
  const mine = library[kind];
  if (source === 'base' || !mine.length) return base;
  if (source === 'mine') return mine;
  const taken = new Set((base as Card[]).map((c) => c.id));
  const yours = (mine as Card[]).map((c) => {
    let id = c.id;
    for (let n = 2; taken.has(id); n++) id = n === 2 ? `${c.id}-yours` : `${c.id}-yours-${n}`;
    taken.add(id);
    return id === c.id ? c : { ...c, id };
  });
  return [...base, ...yours] as Library[K];
}

/** The catalog with the chosen decks in place of the ones it had. */
export function withDecks(catalog: Catalog, builtIn: Catalog, library: Library, choice: DeckChoice): Catalog {
  const fitted = fitDecks(choice, library);
  return {
    ...catalog,
    encounters: deckOf(builtIn, library, 'encounters', fitted.encounters),
    factory: deckOf(builtIn, library, 'factory', fitted.factory),
    objectives: deckOf(builtIn, library, 'objectives', fitted.objectives),
  };
}

const KEY = 'scythe-decks';
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

export function loadDecks(storage: Storage | undefined = globalThis.localStorage): DeckChoice {
  try {
    const kept = JSON.parse(storage?.getItem(KEY) ?? '{}') as Partial<Record<DeckKind, unknown>>;
    return Object.fromEntries(DECK_KINDS.map((kind) => [kind, SOURCES.includes(kept[kind] as string) ? kept[kind] : DEFAULT_DECKS[kind]])) as DeckChoice;
  } catch {
    return { ...DEFAULT_DECKS };
  }
}

export function saveDecks(choice: DeckChoice, storage: Storage | undefined = globalThis.localStorage): void {
  storage?.setItem(KEY, JSON.stringify(choice));
}
