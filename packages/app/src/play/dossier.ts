// A player's dossier: everything about one faction in the game, for the
// screen that opens when its name in the top bar is tapped. Only what the
// table could see: combat card values and objectives in hand stay hidden
// (`secret`) unless they belong to whoever holds the device.
import {
  controlledHexes,
  factoryCard,
  MAX_COMBAT_STARS,
  MAX_POPULARITY,
  MAX_POWER,
  MAX_WORKERS,
  POPULARITY_TIERS,
  RESOURCES,
  standings,
  STRUCTURES,
  territories,
  tierOf,
  type BottomActionType,
  type GameState,
  type HexId,
  type RecruitBonus,
  type Resource,
  type StarKind,
  type Structure,
} from '@scythe/engine';
import { objectiveStatus, type ObjectiveStatus } from './objective-text';

export interface Goal {
  kind: StarKind;
  label: string;
  have: number;
  need: number;
  /** Stars placed for it (two can be for fights). */
  earned: number;
}

export interface Dossier {
  seat: number;
  name: string;
  color: string;
  mat: string;
  /** The mat's number: lowest goes first. */
  matNumber: number;
  stars: { placed: number; of: number };
  /** If the game ended now. */
  standing: { place: number; of: number; total: number; lines: { label: string; coins: number }[] };
  stats: {
    coins: number;
    power: number;
    maxPower: number;
    popularity: number;
    maxPopularity: number;
    /** 1-3, and its range and rates in words. */
    tier: { number: number; range: string; rates: string };
    combatCards: number;
    /** Only when not secret, lowest first. */
    cardValues?: number[];
  };
  goals: Goal[];
  units: { character: string; mechs: number; workers: number; territories: number; hexes: number };
  resources: Record<Resource, number>;
  ability: { name: string; description: string };
  mechAbilities: { name: string; description: string; unlocked: boolean }[];
  /** Each mat section's bottom-row action, and the ongoing bonus a recruit there pays. */
  recruits: { action: BottomActionType; bonus: RecruitBonus; placed: boolean }[];
  /** The faction's one-time recruit bonuses. */
  oneTime: { bonus: RecruitBonus; amount: number; taken: boolean }[];
  structures: { kind: Structure; hex: HexId | null }[];
  upgrades: { done: number; of: number };
  factoryCard?: string;
  objectives: { hidden: number; shown: { name: string; text: string; status: ObjectiveStatus }[] };
}

const TIER_RANGES = ['0–6', '7–12', '13–18'];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** `secret`: hide what only the player may see (their combat cards and objectives in hand). */
export function dossierOf(game: GameState, seat: number, { secret }: { secret: boolean }): Dossier {
  const p = game.players[seat]!;
  const { faction, mat } = game.setup.players[seat]!;
  const all = standings(game);
  const mine = all.find((s) => s.seat === seat)!;
  const tier = tierOf(p.popularity);
  const tierNumber = POPULARITY_TIERS.indexOf(tier) + 1;
  const count = (kind: StarKind) => p.stars.filter((k) => k === kind).length;
  const built = STRUCTURES.filter((s) => p.structures[s]).length;
  const goal = (kind: StarKind, label: string, have: number, need: number): Goal => ({ kind, label, have: Math.min(have, need), need, earned: count(kind) });
  const done = p.objectivesDone ?? [];
  const objectives = objectiveStatus(game, seat).map((o, i) => ({ ...o, id: p.objectives[i]! }));
  const resources = Object.fromEntries(RESOURCES.map((r) => [r, 0])) as Record<Resource, number>;
  const hexes = [...controlledHexes(game, seat)];
  for (const hex of hexes) for (const [r, n] of Object.entries(game.resources[hex] ?? {})) resources[r as Resource] += n ?? 0;

  return {
    seat,
    name: faction.name,
    color: faction.color,
    mat: mat.name,
    matNumber: mat.turnOrder,
    stars: { placed: p.stars.length, of: faction.stars },
    standing: {
      place: mine.place,
      of: all.length,
      total: mine.total,
      lines: [
        { label: 'Coins in hand', coins: mine.coins },
        { label: `${plural(mine.stars.count, 'star')} × ${mine.stars.rate}`, coins: mine.stars.coins },
        { label: `${plural(mine.territories.count, 'territory', 'territories')} × ${mine.territories.rate}`, coins: mine.territories.coins },
        { label: `${mine.resources.count} resources (${mine.resources.rate} per 2)`, coins: mine.resources.coins },
        ...(game.structureBonus ? [{ label: 'Structure bonus', coins: mine.structureBonus.coins }] : []),
      ],
    },
    stats: {
      coins: p.coins,
      power: p.power,
      maxPower: MAX_POWER,
      popularity: p.popularity,
      maxPopularity: MAX_POPULARITY,
      tier: { number: tierNumber, range: TIER_RANGES[tierNumber - 1]!, rates: `${tier.star} a star, ${tier.territory} a territory, ${tier.resources} for every 2 resources` },
      combatCards: p.combatCards.length,
      ...(!secret && { cardValues: [...p.combatCards].sort((a, b) => a - b) }),
    },
    goals: [
      goal('upgrades', 'All upgrades', p.upgrades.top.length, 6),
      goal('mechs', 'All mechs', p.mechs.length, 4),
      goal('structures', 'All structures', built, 4),
      goal('recruits', 'All recruits', p.recruits.length, 4),
      goal('workers', 'All workers', p.workers.length, MAX_WORKERS),
      goal('popularity', 'Top popularity', p.popularity, MAX_POPULARITY),
      goal('power', 'Top power', p.power, MAX_POWER),
      goal('combat', 'Fights won', count('combat'), MAX_COMBAT_STARS),
      goal('objective', 'Objective', done.length, Math.max(1, done.length)),
    ],
    units: {
      character: p.character === 'home' ? 'Home base' : p.character,
      mechs: p.mechs.length,
      workers: p.workers.length,
      territories: territories(game, seat),
      hexes: hexes.length,
    },
    resources,
    ability: { name: faction.ability.name, description: faction.ability.description },
    mechAbilities: faction.mechAbilities.map((a, i) => ({ name: a.name, description: a.description, unlocked: p.mechAbilities.includes(i) })),
    recruits: mat.sections.map((s, i) => ({ action: s.bottom.action, bonus: s.bottom.recruitBonus, placed: p.recruits.includes(i as 0) })),
    oneTime: faction.recruitBonuses.map((r) => ({ ...r, taken: p.recruitBonusesTaken.includes(r.bonus) })),
    structures: STRUCTURES.map((kind) => ({ kind, hex: p.structures[kind] ?? null })),
    upgrades: { done: p.upgrades.top.length, of: 6 },
    ...(p.factoryCard && { factoryCard: factoryCard(game, p.factoryCard).name }),
    objectives: {
      hidden: secret ? objectives.filter((o) => !done.includes(o.id)).length : 0,
      shown: objectives.filter((o) => !secret || done.includes(o.id)).map(({ name, text, status }) => ({ name, text, status })),
    },
  };
}
