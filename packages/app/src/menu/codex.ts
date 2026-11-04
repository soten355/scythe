// The codex: everything new games use (factions, mats, and the encounter,
// Factory and objective decks and the structure bonus tiles), browsed one at
// a time from the main menu. This file turns each into what the codex shows,
// in the words the game uses; Codex.svelte draws it.
import type { Board, EncounterCard, Faction, FactoryCard, ObjectiveCard, PlayerMat, RecruitBonus, StructureBonusTile, Terrain, Upgradeable } from '@scythe/engine';
import type { Catalog } from './setup';
import { costText, gainText, moveText } from '../play/prompt';
import { objectiveText } from '../play/objective-text';
import { countText } from '../play/structure-bonus-text';

export type CodexKind = 'factions' | 'mats' | 'encounters' | 'factory' | 'objectives' | 'structureBonuses';

export const CODEX_TABS: { kind: CodexKind; label: string; icon: string }[] = [
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
  const deck = kind !== 'factions' && kind !== 'mats';
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
