// The player's own maps, factions, mats, cards and structure bonus tiles: made in the
// editors or brought in from files (content files, or what's inside any
// save). Kept on the device and offered on the new game screen next to the
// built-in ones. Games don't depend on the library: each save carries its own
// copies. Encounter, Factory and objective cards each make one deck (the new
// game screen picks the base deck, yours or both: see decks.ts), and the
// tiles one set, used in place of the built-in ones once there are any.
import { validateEncounterCard, validateFaction, validateFactoryCard, validateMat, validateObjectiveCard, validateStructureBonus, type Board, type EncounterCard, type Faction, type FactoryCard, type ObjectiveCard, type PlayerMat, type StructureBonusTile } from '@scythe/engine';
import type { Catalog, MapOption } from '../menu/setup';
import { readPictures } from './card-pictures';

const FORMAT = 'scythe-content';
const FORMAT_VERSION = 1;

export interface Library {
  maps: MapOption[];
  factions: Faction[];
  mats: PlayerMat[];
  encounters: EncounterCard[];
  factory: FactoryCard[];
  objectives: ObjectiveCard[];
  structureBonuses: StructureBonusTile[];
}

export type LibraryKind = keyof Library;

export const EMPTY_LIBRARY: Library = { maps: [], factions: [], mats: [], encounters: [], factory: [], objectives: [], structureBonuses: [] };

/** JSON with object keys sorted, so equal data compares equal whatever order its keys were written in. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v,
  );

/** What makes one item the same as another: everything but its id (a renamed copy is a different one). */
const body = (item: { id: string; name: string }) => canonical({ ...item, id: '' });

/**
 * Adds items to the library. Anything exactly like a built-in or library item
 * is skipped; one with a library item's id replaces it (a newer version); a
 * changed built-in one is kept as "<name> (custom)". Returns the names added.
 */
export function addToLibrary(library: Library, builtIn: Catalog, incoming: Library): { library: Library; added: string[] } {
  const next: Library = { maps: [...library.maps], factions: [...library.factions], mats: [...library.mats], encounters: [...library.encounters], factory: [...library.factory], objectives: [...library.objectives], structureBonuses: [...library.structureBonuses] };
  const added: string[] = [];
  const kinds: LibraryKind[] = ['maps', 'factions', 'mats', 'encounters', 'factory', 'objectives', 'structureBonuses'];
  for (const kind of kinds) {
    const builtIns = (builtIn[kind] ?? []) as { id: string; name: string }[];
    for (const original of (incoming[kind] ?? []) as { id: string; name: string }[]) {
      const mine = next[kind] as { id: string; name: string }[];
      if ([...builtIns, ...mine].some((x) => body(x) === body(original))) continue;
      let item = original;
      const clash = builtIns.find((x) => x.id === item.id);
      if (clash) item = { ...item, id: `${item.id}-custom`, name: item.name === clash.name ? `${item.name} (custom)` : item.name };
      const at = mine.findIndex((x) => x.id === item.id);
      const others = [...builtIns, ...mine.filter((_, i) => i !== at)];
      for (let n = 2, name = item.name; others.some((x) => x.name === item.name); n++) item = { ...item, name: `${name} (${n})` };
      if (at >= 0) mine[at] = item;
      else mine.push(item);
      added.push(item.name);
    }
  }
  return { library: next, added };
}

/** Removes one item, or several at once (a whole deck of cards). */
export function removeFromLibrary(library: Library, kind: LibraryKind, id: string | string[]): Library {
  const ids = typeof id === 'string' ? [id] : id;
  return { ...library, [kind]: (library[kind] as { id: string }[]).filter((x) => !ids.includes(x.id)) };
}

/** Built-in maps, factions and mats first, then the player's own; the player's encounter, Factory and objective cards and structure bonus tiles, if any, else the built-in ones. */
export function catalogWith(builtIn: Catalog, library: Library): Catalog {
  const encounters = library.encounters.length ? library.encounters : builtIn.encounters;
  const factory = library.factory.length ? library.factory : builtIn.factory;
  const objectives = library.objectives.length ? library.objectives : builtIn.objectives;
  const structureBonuses = library.structureBonuses.length ? library.structureBonuses : builtIn.structureBonuses;
  return {
    maps: [...builtIn.maps, ...library.maps],
    factions: [...builtIn.factions, ...library.factions],
    mats: [...builtIn.mats, ...library.mats],
    ...(encounters && { encounters }),
    ...(factory && { factory }),
    ...(objectives && { objectives }),
    ...(structureBonuses && { structureBonuses }),
  };
}

/** A content file: what's given, and the encounter cards' pictures (by reference) if any. */
export function contentFileText(content: Library, pictures: Record<string, string> = {}): string {
  return JSON.stringify({ format: FORMAT, formatVersion: FORMAT_VERSION, ...content, ...(Object.keys(pictures).length && { pictures }) });
}

/** Named after the one thing in it, "scythe-encounters", "scythe-factory", "scythe-objectives" or "scythe-structure-bonuses" for a deck of cards (or the tiles) alone, or "scythe-content" when there are several. */
export function contentFileName(content: Library): string {
  const all = [...content.maps, ...content.factions, ...content.mats, ...content.encounters, ...content.factory, ...content.objectives, ...content.structureBonuses];
  const deck = (['encounters', 'factory', 'objectives', 'structureBonuses'] as const).find((kind) => content[kind].length > 1 && all.length === content[kind].length);
  const name = (deck === 'structureBonuses' ? 'structure-bonuses' : deck) ?? (all.length === 1 ? all[0]!.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'content' : 'content');
  return `scythe-${name}.scythe-content.json`;
}

/** A short, stable id for a map from its layout, so the same map always gets the same id. */
function mapId(board: Board): string {
  let h = 0;
  for (const ch of canonical(board)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return `map-${(h >>> 0).toString(36)}`;
}

const TERRAINS = new Set(['farm', 'forest', 'mountain', 'tundra', 'village', 'lake', 'factory']);

/** What's wrong with a map, in plain words; empty when it's fine. */
export function boardProblems(board: Board): string[] {
  if (!board || typeof board !== 'object' || !board.hexes || typeof board.hexes !== 'object') return ['it has no hexes'];
  const hexes = Object.values(board.hexes);
  if (!hexes.length) return ['it has no hexes'];
  const problems: string[] = [];
  const isHex = (id: unknown) => typeof id === 'string' && id in board.hexes;
  if (hexes.some((h) => !h || !TERRAINS.has(h.terrain) || typeof h.q !== 'number' || typeof h.r !== 'number')) problems.push('a hex has no terrain or place');
  if (!board.adjacent || Object.entries(board.adjacent).some(([id, near]) => !isHex(id) || !Array.isArray(near) || !near.every(isHex))) problems.push('its hexes are joined up wrongly');
  if (!Array.isArray(board.rivers) || !board.rivers.every((r) => Array.isArray(r) && r.length === 2 && r.every(isHex))) problems.push('a river runs along a hex that isn\'t there');
  if (!board.homeBases || !board.homeBasePositions || Object.entries(board.homeBases).some(([id, near]) => !Array.isArray(near) || !near.every(isHex) || !board.homeBasePositions[id]))
    problems.push('a home base borders a hex that isn\'t there');
  return problems;
}

/** Reads a content file, or the map, factions and mats out of a save file. Throws, in plain words, if it's neither or something in it is broken. */
export function parseContentFile(text: string): Library & { pictures?: Record<string, string> } {
  const neither = new Error("This file isn't a Scythe content or save file.");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw neither;
  }
  if (!data || typeof data !== 'object') throw neither;
  let content: Library;
  if (data.format === FORMAT) {
    if ((data.formatVersion as number) > FORMAT_VERSION) throw new Error('This file was made by a newer version of the app. Update the app to open it.');
    content = {
      maps: (data.maps as MapOption[]) ?? [],
      factions: (data.factions as Faction[]) ?? [],
      mats: (data.mats as PlayerMat[]) ?? [],
      encounters: (data.encounters as EncounterCard[]) ?? [],
      factory: (data.factory as FactoryCard[]) ?? [],
      objectives: (data.objectives as ObjectiveCard[]) ?? [],
      structureBonuses: (data.structureBonuses as StructureBonusTile[]) ?? [],
    };
  } else if (data.format === 'scythe-save') {
    const setup = data.setup as { board: Board; players: { faction: Faction; mat: PlayerMat }[]; encounters?: EncounterCard[]; factory?: FactoryCard[]; objectives?: ObjectiveCard[]; structureBonuses?: StructureBonusTile[] } | undefined;
    if (!setup?.board || !Array.isArray(setup.players)) throw neither;
    const name = (data.mapName as string | undefined) ?? `Map from ${setup.players.map((p) => p.faction?.name).join(', ')} game`;
    content = {
      maps: [{ id: mapId(setup.board), name, board: setup.board }],
      factions: setup.players.map((p) => p.faction),
      mats: setup.players.map((p) => p.mat),
      encounters: setup.encounters ?? [],
      factory: setup.factory ?? [],
      objectives: setup.objectives ?? [],
      structureBonuses: setup.structureBonuses ?? [],
    };
  } else {
    throw neither;
  }
  if (![content.maps, content.factions, content.mats, content.encounters, content.factory, content.objectives, content.structureBonuses].every(Array.isArray)) throw neither;
  const check = (item: { id?: unknown; name?: unknown } | undefined, what: string, problems: () => string[]) => {
    const name = typeof item?.name === 'string' && item.name ? item.name : `a ${what}`;
    let found: string[];
    try {
      found = typeof item?.id === 'string' && typeof item.name === 'string' ? problems() : ['it has no name'];
    } catch {
      found = ['it is incomplete'];
    }
    if (found.length) throw new Error(`${name} can't be used: ${found.join('; ')}.`);
  };
  for (const m of content.maps) check(m, 'map', () => boardProblems(m.board));
  for (const f of content.factions) check(f, 'faction', () => validateFaction(f));
  for (const m of content.mats) check(m, 'mat', () => validateMat(m));
  for (const c of content.encounters) check(c, 'encounter card', () => validateEncounterCard(c));
  for (const c of content.factory) check(c, 'Factory card', () => validateFactoryCard(c));
  for (const c of content.objectives) check(c, 'objective card', () => validateObjectiveCard(c));
  for (const t of content.structureBonuses) check(t, 'structure bonus tile', () => validateStructureBonus(t));
  // The encounter cards' pictures travel in content files (never in saves).
  const pictures = data.format === FORMAT ? readPictures(data.pictures) : {};
  return Object.keys(pictures).length ? { ...content, pictures } : content;
}
