// Helpers shared by the action rules: reading and updating player state,
// control of hexes, resources on hexes and ending the turn.
import type { HexId } from './board';
import { MAX_POWER, type Faction } from './faction';
import type { GameState, PlayerState, ResourcePile, SectionIndex } from './game';
import { BOTTOM_COST_RESOURCE, upgradeables, type PlayerMat, type Resource } from './mat';

export const SECTIONS: SectionIndex[] = [0, 1, 2, 3];
export const MAX_POPULARITY = 18;
export const MAX_WORKERS = 8;

export type StarKind = 'upgrades' | 'mechs' | 'structures' | 'recruits' | 'workers' | 'popularity' | 'power';

/** What earns each star, in the order they're checked. Combat and objective stars arrive with those rules. */
const STAR_GOALS: [StarKind, (p: PlayerState) => boolean][] = [
  ['upgrades', (p) => p.upgrades.top.length >= 6],
  ['mechs', (p) => p.mechs.length >= 4],
  ['structures', (p) => Object.values(p.structures).filter(Boolean).length >= 4],
  ['recruits', (p) => p.recruits.length >= 4],
  ['workers', (p) => p.workers.length >= MAX_WORKERS],
  ['popularity', (p) => p.popularity >= MAX_POPULARITY],
  ['power', (p) => p.power >= MAX_POWER],
];

/** Places a star for each goal this player has newly reached, up to the faction's star count. */
export function awardStars(state: GameState, seat: number): GameState {
  const player = state.players[seat]!;
  const limit = state.setup.players[seat]!.faction.stars;
  const stars = [...player.stars];
  for (const [kind, reached] of STAR_GOALS) {
    if (stars.length < limit && !stars.includes(kind) && reached(player)) stars.push(kind);
  }
  return stars.length === player.stars.length ? state : updatePlayer(state, seat, { stars });
}

/** Records the section used and passes play to the next seat clockwise. */
export function endTurn(state: GameState): GameState {
  const section = state.turn.step === 'chooseSection' ? null : state.turn.section;
  return {
    ...updatePlayer(state, state.currentPlayer, { lastSection: section }),
    currentPlayer: (state.currentPlayer + 1) % state.players.length,
    turn: { step: 'chooseSection' },
    turnsTaken: state.turnsTaken + 1,
  };
}

export function updatePlayer(state: GameState, seat: number, patch: Partial<PlayerState>): GameState {
  return { ...state, players: state.players.map((p, i) => (i === seat ? { ...p, ...patch } : p)) };
}

export function current(state: GameState): { seat: number; player: PlayerState; faction: Faction; mat: PlayerMat } {
  const seat = state.currentPlayer;
  const { faction, mat } = state.setup.players[seat]!;
  return { seat, player: state.players[seat]!, faction, mat };
}

/** Coins, power, popularity and combat cards, with power and popularity capped. */
export function gain(
  player: PlayerState,
  g: Partial<Record<'coins' | 'power' | 'popularity' | 'combatCards', number>>,
): Partial<PlayerState> {
  return {
    coins: player.coins + (g.coins ?? 0),
    power: Math.min(MAX_POWER, player.power + (g.power ?? 0)),
    popularity: Math.min(MAX_POPULARITY, player.popularity + (g.popularity ?? 0)),
    combatCards: player.combatCards + (g.combatCards ?? 0),
  };
}

/** Hexes where this player has at least one unit. */
export function unitHexes(player: PlayerState): Set<HexId> {
  const hexes = new Set<HexId>([...player.mechs, ...player.workers]);
  if (player.character !== 'home') hexes.add(player.character);
  return hexes;
}

/** Hexes where any player other than `seat` has a unit. */
export function enemyUnitHexes(state: GameState, seat: number): Set<HexId> {
  const hexes = new Set<HexId>();
  state.players.forEach((p, i) => {
    if (i !== seat) for (const h of unitHexes(p)) hexes.add(h);
  });
  return hexes;
}

/** You control a hex with your unit on it, or your structure with no enemy unit on it. */
export function controlledHexes(state: GameState, seat: number): Set<HexId> {
  const player = state.players[seat]!;
  const hexes = unitHexes(player);
  const enemies = enemyUnitHexes(state, seat);
  for (const hex of Object.values(player.structures)) {
    if (hex && !enemies.has(hex)) hexes.add(hex);
  }
  return hexes;
}

/** Whether any player has a structure on this hex. */
export function structureOn(state: GameState, hex: HexId): boolean {
  return state.players.some((p) => Object.values(p.structures).includes(hex));
}

export function addResources(state: GameState, hex: HexId, resource: Resource, amount: number): GameState {
  const pile = state.resources[hex] ?? {};
  const next = (pile[resource] ?? 0) + amount;
  const newPile: ResourcePile = { ...pile, [resource]: next };
  if (next === 0) delete newPile[resource];
  const resources = { ...state.resources, [hex]: newPile };
  if (Object.keys(newPile).length === 0) delete resources[hex];
  return { ...state, resources };
}

/** A top-row value (e.g. "power" in a bolster section), including upgrades. */
export function topValue(player: PlayerState, mat: PlayerMat, section: SectionIndex, field: string): number {
  const value = upgradeables(mat.sections[section].top).find(([f]) => f === field)?.[1];
  if (!value) throw new Error(`section ${section} has no upgradeable ${field}`);
  const cubes = player.upgrades.top.filter((u) => u.section === section && u.field === field).length;
  return Math.min(value.upgraded, value.base + cubes);
}

/** A bottom-row action's cost after upgrades, and the resource it's paid in. */
export function bottomCost(player: PlayerState, mat: PlayerMat, section: SectionIndex): { amount: number; resource: Resource } {
  const bottom = mat.sections[section].bottom;
  const cubes = player.upgrades.bottom.filter((s) => s === section).length;
  return { amount: Math.max(0, bottom.cost - cubes), resource: BOTTOM_COST_RESOURCE[bottom.action] };
}
