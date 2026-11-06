// Skins: a whole look for the game, kept and switched as one. A skin is a
// theme (pictures, colours, fonts) and its own words: names and colours for
// factions, wording for their abilities, and names for mats and maps. Words
// are keyed by the neutral IDs underneath, so a skin changes how the game
// looks and reads, never how it plays: every number and rule stays, and bots
// keep each faction's personality.
//
// "Original" is the built-in look (the drawn pieces and emoji) and can't be
// changed; a device can keep any number of skins of its own beside it. Skins
// go between devices as one file (.scythe-skin.json), which can also carry
// the player's own encounter, Factory and objective cards (with the encounter
// cards' pictures), to use on the device it's opened on.
import type { Ability, EncounterCard, FactoryCard, ObjectiveCard } from '@scythe/engine';
import { contentFileText, parseContentFile, type Library } from '../content/library';
import { picturesFor } from '../content/card-pictures';
import type { Catalog } from '../menu/setup';
import { DEFAULT_THEME, readTheme, type Theme } from '../theme/theme';

/** Words for an ability: a new name, a new wording, or both (blank keeps the original). */
export interface AbilityWords {
  name?: string;
  description?: string;
}

/** A faction's story, only for reading in the Codex: who its character is, and its capital city, history and goals. */
export interface FactionLore {
  characterName?: string;
  characterBio?: string;
  capital?: string;
  history?: string;
  goals?: string;
}

/** The parts of a faction's story, as the editors ask for them. */
export const LORE_CARDS: { title: string; fields: { key: keyof FactionLore; label: string; long: boolean }[] }[] = [
  {
    title: 'The character',
    fields: [
      { key: 'characterName', label: 'Name', long: false },
      { key: 'characterBio', label: 'Bio', long: true },
    ],
  },
  {
    title: 'The faction',
    fields: [
      { key: 'capital', label: 'Capital city', long: false },
      { key: 'history', label: 'History', long: true },
      { key: 'goals', label: 'Goals', long: true },
    ],
  },
];

export interface FactionWords {
  name?: string;
  color?: string;
  ability?: AbilityWords;
  /** The four mech abilities, in order. */
  mechAbilities?: AbilityWords[];
  lore?: FactionLore;
}

export interface SkinWords {
  factions: Record<string, FactionWords>;
  mats: Record<string, { name?: string }>;
  maps: Record<string, { name?: string }>;
}

export interface Skin {
  id: string;
  name: string;
  theme: Theme;
  words: SkinWords;
}

export const NO_WORDS: SkinWords = { factions: {}, mats: {}, maps: {} };

export const ORIGINAL: Skin = { id: 'original', name: 'Original', theme: DEFAULT_THEME, words: NO_WORDS };

/** A name not taken yet: "Iron Tide", else "Iron Tide (2)", "Iron Tide (3)"... */
export function freeName(name: string, taken: string[]): string {
  const all = new Set([ORIGINAL.name, ...taken]);
  if (!all.has(name)) return name;
  let n = 2;
  while (all.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

/** A new skin: a copy of another under a new name. */
export const newSkin = (name: string, from: Skin, id: string): Skin => ({ id, name, theme: from.theme, words: from.words });

/** A word if it says something, else nothing. */
const said = (s: string | undefined) => (s && s.trim() ? s.trim() : undefined);

function reword(ability: Ability, words: AbilityWords | undefined): Ability {
  const name = said(words?.name);
  const description = said(words?.description);
  return name || description ? { ...ability, ...(name && { name }), ...(description && { description }) } : ability;
}

/** The catalog as the skin tells it: the same factions, mats and maps, renamed and reworded. */
export function applyWords(catalog: Catalog, words: SkinWords): Catalog {
  return {
    ...catalog,
    factions: catalog.factions.map((f) => {
      const w = words.factions[f.id];
      if (!w) return f;
      const name = said(w.name);
      const color = w.color && COLOR.test(w.color) ? w.color : undefined;
      const ability = reword(f.ability, w.ability);
      const mechAbilities = f.mechAbilities.map((m, i) => reword(m, w.mechAbilities?.[i])) as typeof f.mechAbilities;
      const changed = name || color || ability !== f.ability || mechAbilities.some((m, i) => m !== f.mechAbilities[i]);
      return changed ? { ...f, ...(name && { name }), ...(color && { color }), ability, mechAbilities } : f;
    }),
    mats: catalog.mats.map((m) => {
      const name = said(words.mats[m.id]?.name);
      return name ? { ...m, name } : m;
    }),
    maps: catalog.maps.map((m) => {
      const name = said(words.maps[m.id]?.name);
      return name ? { ...m, name } : m;
    }),
  };
}

const FORMAT = 'scythe-skin';
const FORMAT_VERSION = 1;
const COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** Longest name or wording kept from a file. */
export const NAME_MAX = 60;
const TEXT_MAX = 600;
/** Longest bio, history or goals (the editors stop there too). */
export const LORE_MAX = 3000;

/** Card decks that can travel with a skin: the player's own, with the encounter cards' pictures. */
export interface SkinCards {
  encounters: EncounterCard[];
  factory: FactoryCard[];
  objectives: ObjectiveCard[];
  pictures: Record<string, string>;
}

/** The player's own decks to put in a skin file (the made-up samples never go), with only the pictures they use; none if there are none. */
export function cardsToShare(library: Library, kept: Record<string, string>): SkinCards | undefined {
  const { encounters, factory, objectives } = library;
  if (!encounters.length && !factory.length && !objectives.length) return undefined;
  return { encounters, factory, objectives, pictures: picturesFor(encounters, kept) };
}

/** The library with a skin's decks in place of the ones new games use now; a deck the skin lacks stays as it is. */
export function useSkinCards(library: Library, cards: SkinCards): Library {
  return {
    ...library,
    ...(cards.encounters.length && { encounters: cards.encounters }),
    ...(cards.factory.length && { factory: cards.factory }),
    ...(cards.objectives.length && { objectives: cards.objectives }),
  };
}

export const skinFileText = (skin: Skin, cards?: SkinCards) =>
  JSON.stringify({
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    name: skin.name,
    theme: skin.theme,
    words: skin.words,
    // The cards as a content file's (so they're checked the same way when read).
    ...(cards && { cards: JSON.parse(contentFileText({ maps: [], factions: [], mats: [], structureBonuses: [], encounters: cards.encounters, factory: cards.factory, objectives: cards.objectives }, cards.pictures)) }),
  });

/** "scythe-skin-iron-tide.scythe-skin.json" */
export const skinFileName = (skin: Skin) => `scythe-skin-${skin.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skin'}.scythe-skin.json`;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

function readAbility(v: unknown): AbilityWords {
  if (!isRecord(v)) return {};
  const name = text(v.name, NAME_MAX);
  const description = text(v.description, TEXT_MAX);
  return { ...(name && { name }), ...(description && { description }) };
}

function readLore(v: unknown): FactionLore | undefined {
  if (!isRecord(v)) return undefined;
  const lore: FactionLore = {};
  for (const { key, long } of LORE_CARDS.flatMap((c) => c.fields)) {
    const said = text(v[key], long ? LORE_MAX : NAME_MAX);
    if (said) lore[key] = said;
  }
  return Object.keys(lore).length ? lore : undefined;
}

/** Words from plain data, keeping only names, colours and wording, as plain text. */
export function readWords(data: unknown): SkinWords {
  const words: SkinWords = { factions: {}, mats: {}, maps: {} };
  if (!isRecord(data)) return words;
  for (const [id, v] of Object.entries(isRecord(data.factions) ? data.factions : {})) {
    if (!isRecord(v)) continue;
    const name = text(v.name, NAME_MAX);
    const color = typeof v.color === 'string' && COLOR.test(v.color) ? v.color : undefined;
    const ability = isRecord(v.ability) ? readAbility(v.ability) : undefined;
    const mechAbilities = Array.isArray(v.mechAbilities) ? v.mechAbilities.slice(0, 4).map(readAbility) : undefined;
    const lore = readLore(v.lore);
    words.factions[id] = { ...(name && { name }), ...(color && { color }), ...(ability && { ability }), ...(mechAbilities && { mechAbilities }), ...(lore && { lore }) };
  }
  for (const kind of ['mats', 'maps'] as const) {
    for (const [id, v] of Object.entries(isRecord(data[kind]) ? data[kind] : {})) {
      const name = isRecord(v) ? text(v.name, NAME_MAX) : undefined;
      if (name) words[kind][id] = { name };
    }
  }
  return words;
}

/** Reads a skin file as a skin for this device (under `id`). Throws, in plain words, if it's not a skin. */
export function parseSkinFile(fileText: string, id: string): Skin {
  const notSkin = new Error("This file isn't a Scythe skin.");
  let data: unknown;
  try {
    data = JSON.parse(fileText);
  } catch {
    throw notSkin;
  }
  if (!isRecord(data) || data.format !== FORMAT) throw notSkin;
  if (typeof data.formatVersion === 'number' && data.formatVersion > FORMAT_VERSION) throw new Error('This skin was made by a newer version of the app. Update the app to open it.');
  return {
    id,
    name: text(data.name, NAME_MAX) ?? 'My skin',
    theme: readTheme(isRecord(data.theme) ? data.theme : {}),
    words: readWords(data.words),
  };
}

/** The cards a skin file carries, if any, checked like a content file's. Throws, in plain words, if one can't be used. */
export function parseSkinCards(fileText: string): SkinCards | undefined {
  let data: unknown;
  try {
    data = JSON.parse(fileText);
  } catch {
    return undefined;
  }
  if (!isRecord(data) || !isRecord(data.cards)) return undefined;
  const content = parseContentFile(JSON.stringify(data.cards));
  const cards = { encounters: content.encounters, factory: content.factory, objectives: content.objectives, pictures: content.pictures ?? {} };
  return cards.encounters.length || cards.factory.length || cards.objectives.length ? cards : undefined;
}
