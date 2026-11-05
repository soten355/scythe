// The codex: everything new games use (maps, factions, mats, and the encounter,
// Factory and objective decks and the structure bonus tiles), browsed one at
// a time from the main menu. This file turns each into what the codex shows,
// in the words the game uses; Codex.svelte draws it.
import { newGame, type GameState } from '@scythe/engine';
import type { Board, EncounterCard, Faction, FactoryCard, ObjectiveCard, PlayerMat, RecruitBonus, StructureBonusTile, Terrain, Upgradeable } from '@scythe/engine';
import type { Catalog } from './setup';
import { costText, gainText, moveText } from '../play/prompt';
import { objectiveText } from '../play/objective-text';
import { countText } from '../play/structure-bonus-text';

export type CodexKind = 'maps' | 'factions' | 'mats' | 'encounters' | 'factory' | 'objectives' | 'structureBonuses';

export const CODEX_TABS: { kind: CodexKind; label: string; icon: string }[] = [
  { kind: 'maps', label: 'Maps', icon: '🗺️' },
  { kind: 'factions', label: 'Factions', icon: '🛡️' },
  { kind: 'mats', label: 'Mats', icon: '🗂️' },
  { kind: 'encounters', label: 'Encounters', icon: '⭐' },
  { kind: 'factory', label: 'Factory', icon: '🏭' },
  { kind: 'objectives', label: 'Objectives', icon: '🎯' },
  { kind: 'structureBonuses', label: 'Bonus tiles', icon: '🏛️' },
];

/** What a tab lists, in order, and whether it's the made-up sample deck (no deck of your own added yet). */
export function codexList(catalog: Catalog, builtIn: Catalog, kind: CodexKind): { items: { id: string; name: string }[]; sample: boolean } {
  const all = (kind === 'mats' ? [...catalog.mats].sort((a, b) => a.turnOrder - b.turnOrder) : (catalog[kind] ?? [])) as { id: string; name: string }[];
  const deck = kind !== 'maps' && kind !== 'factions' && kind !== 'mats';
  return { items: all.map(({ id, name }) => ({ id, name })), sample: deck && all.length > 0 && all === builtIn[kind] };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
const BONUS: Record<RecruitBonus, string> = { power: 'power', coins: 'coin', popularity: 'popularity', combatCard: 'combat card' };

export function factionFacts(f: Faction, board: Board) {
  const next = board.homeBases[f.homeBase]?.[0];
  const terrain: Terrain = (next && board.hexes[next]?.terrain) || 'tundra';
  return {
    terrain,
    start: [`${f.power} power`, plural(f.combatCards, 'combat card'), `${f.stars} stars to place`],
    ability: f.ability,
    mechAbilities: f.mechAbilities,
    recruits: f.recruitBonuses.map((r) => `+${r.amount} ${r.amount === 1 ? BONUS[r.bonus] : BONUS[r.bonus] === 'popularity' || BONUS[r.bonus] === 'power' ? BONUS[r.bonus] : `${BONUS[r.bonus]}s`}`),
  };
}

const TERRAIN_NAMES: Record<Terrain, string> = { farm: 'Farms', forest: 'Forests', mountain: 'Mountains', tundra: 'Tundra', village: 'Villages', lake: 'Lakes', factory: 'Factory' };
const ORDER: Terrain[] = ['farm', 'forest', 'mountain', 'tundra', 'village', 'lake', 'factory'];
const PLACES: Record<string, string> = { n: 'North', ne: 'North-east', e: 'East', se: 'South-east', s: 'South', sw: 'South-west', w: 'West', nw: 'North-west' };

/** What a map holds: each kind of land, rivers, tunnels, encounter spots, and who starts at each home base. */
export function mapFacts(board: Board, factions: Faction[]) {
  const hexes = Object.values(board.hexes);
  return {
    terrains: ORDER.map((terrain) => ({ terrain, name: TERRAIN_NAMES[terrain], count: hexes.filter((h) => h.terrain === terrain).length })).filter((t) => t.count > 0),
    hexes: hexes.filter((h) => h.terrain !== 'lake').length,
    rivers: board.rivers.length,
    tunnels: hexes.filter((h) => h.tunnel).length,
    encounters: hexes.filter((h) => h.encounter).length,
    homes: Object.keys(board.homeBases).map((id) => ({
      id,
      place: PLACES[id] ?? id.toUpperCase(),
      factions: factions.filter((f) => f.homeBase === id).map(({ name, color }) => ({ name, color })),
    })),
  };
}

/**
 * The map as a game on it starts: every faction with a home base on it (the
 * first for each home base) with its character at home and its workers out,
 * and the encounter tokens down. With no faction to start there, just the map.
 */
export function mapStart(board: Board, factions: Faction[], mats: PlayerMat[], encounters?: EncounterCard[]): GameState {
  const seated = factions.filter((f, i) => board.homeBases[f.homeBase] && factions.findIndex((g) => g.homeBase === f.homeBase) === i);
  const sorted = [...mats].sort((a, b) => a.turnOrder - b.turnOrder);
  const players = seated.slice(0, sorted.length).map((faction, i) => ({ faction, mat: sorted[i]! }));
  if (players.length) return newGame({ seed: 1, board, players, ...(encounters?.length && { encounters }) });
  // No one to start: a game needs a player, so set one aside afterwards.
  const stand = factions[0] && sorted[0] && Object.keys(board.homeBases)[0];
  if (!stand) throw new Error('a map to show needs a faction, a mat and a home base');
  const game = newGame({ seed: 1, board, players: [{ faction: { ...factions[0]!, homeBase: stand }, mat: sorted[0]! }], ...(encounters?.length && { encounters }) });
  return { ...game, players: [] };
}

const NAMES = { move: 'Move', trade: 'Trade', produce: 'Produce', bolster: 'Bolster', upgrade: 'Upgrade', deploy: 'Deploy', build: 'Build', enlist: 'Enlist' } as const;
const STRUCTURE = { mine: 'Mine', mill: 'Mill', armory: 'Armory', monument: 'Monument' } as const;
const RESOURCE = { upgrade: 'oil', deploy: 'metal', build: 'wood', enlist: 'food' } as const;

/** "2 units (3 upgraded)": the value, and what an upgrade raises it to. */
const value = (u: Upgradeable, what: string) => `${what}${u.upgraded > u.base ? ` (${u.upgraded} upgraded)` : ''}`;

export function matFacts(mat: PlayerMat) {
  return {
    title: mat.name,
    start: [`goes ${ordinal(mat.turnOrder)}`, `${mat.popularity} popularity`, plural(mat.coins, 'coin'), plural(mat.objectiveCards, 'objective card')],
    sections: mat.sections.map(({ top, bottom }) => {
      let topLines: string[];
      if (top.action === 'move') topLines = [value(top.units, plural(top.units.base, 'unit')), value(top.coins, `+${plural(top.coins.base, 'coin')}`)];
      else if (top.action === 'trade') topLines = [`pay ${plural(top.cost, 'coin')}`, `${plural(top.resources, 'resource')}, or ${value(top.popularity, `${top.popularity.base} popularity`)}`];
      else if (top.action === 'produce') topLines = [value(top.hexes, plural(top.hexes.base, 'hex').replace('hexs', 'hexes'))];
      else topLines = [`pay ${plural(top.cost, 'coin')}`, `${value(top.power, `${top.power.base} power`)}, or ${value(top.combatCards, plural(top.combatCards.base, 'combat card'))}`];
      const lowest = bottom.cost - bottom.upgradeSpaces;
      return {
        top: NAMES[top.action],
        topLines,
        structure: STRUCTURE[top.structure],
        bottom: NAMES[bottom.action],
        bottomLines: [`pay ${bottom.cost} ${RESOURCE[bottom.action]}${bottom.upgradeSpaces ? ` (down to ${lowest} with upgrades)` : ''}`, `get ${plural(bottom.coins, 'coin')}`],
        recruit: BONUS[bottom.recruitBonus],
      };
    }),
  };
}

export function encounterFacts(card: EncounterCard) {
  return { options: card.options.map((o) => ({ text: o.text, cost: costText(o.cost), gain: gainText(o.gain, 'the hex') })) };
}

export function factoryFacts(card: FactoryCard) {
  const move = moveText(card);
  return { top: `${costText(card.cost)} → ${gainText(card.gain, '')}`, move: move[0]!.toUpperCase() + move.slice(1) };
}

export function objectiveFacts(card: ObjectiveCard) {
  return { text: objectiveText(card), endOfTurn: !!card.endOfTurn, ...(card.story && { story: card.story }) };
}

export function tileFacts(tile: StructureBonusTile) {
  return { count: countText(tile.count), pays: tile.pays.map((s) => `${s.atLeast}+ → ${plural(s.coins, 'coin')}`) };
}
