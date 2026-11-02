// Objectives: each player is dealt objective cards at setup (as many as their
// mat says) and keeps them hidden. When a card's conditions all hold, on the
// player's own turn, they may complete it: reveal it and place a star. One a
// game: the other card stays in hand but can't be completed (Dominate lifts
// the limit). A card marked "end of turn" can only be completed as the turn
// ends: once the player could end it (before the bottom row, or after it);
// completing one before the bottom row gives up the bottom-row action.
//
// A card is a list of conditions, as data, so the real deck can be entered in
// an editor. A game whose setup has no objective cards (one saved before
// objectives existed) deals none.
import type { HexId, Terrain } from './board';
import { hasRule } from './abilities';
import type { Action, GameState, PlayerState } from './game';
import type { Resource } from './mat';
import { shuffle } from './rng';
import { controlledHexes, onBoard, placeStar, updatePlayer } from './state';

/** Something counted for a condition: met when the count is at least `atLeast` and at most `atMost` (either may be left out). */
interface Bounds {
  atLeast?: number;
  atMost?: number;
}

export type ObjectiveStat = 'power' | 'popularity' | 'coins' | 'combatCards';
export type ObjectiveUnit = 'character' | 'mech' | 'worker' | 'any';
export type ObjectiveProgress = 'upgrades' | 'mechs' | 'structures' | 'recruits' | 'workers';

export type ObjectiveCheck =
  /** Power, popularity, coins or combat cards in hand. */
  | ({ kind: 'stat'; stat: ObjectiveStat } & Bounds)
  /** Resources on hexes the player controls: of these kinds (every kind if none listed), in all. */
  | ({ kind: 'resources'; resources?: Resource[] } & Bounds)
  /** At least so many of each of these kinds of resources, on hexes the player controls. */
  | { kind: 'eachResource'; resources: Resource[]; atLeast: number }
  /** The player's units on the board, of one kind or any, on one terrain or any. */
  | ({ kind: 'units'; unit: ObjectiveUnit; terrain?: Terrain } & Bounds)
  /** Territories the player controls: of one terrain, or all of them (the Factory counting three). */
  | ({ kind: 'territories'; terrain?: Terrain } & Bounds)
  /** Upgrades made, mechs deployed, structures built, recruits enlisted or workers on the board. */
  | ({ kind: 'progress'; what: ObjectiveProgress } & Bounds);

export interface ObjectiveCard {
  /** Neutral ID, e.g. "objective-01". */
  id: string;
  name: string;
  /** What the card says, in your own words (shown with it). */
  story?: string;
  /** Only completed as the player's turn ends. */
  endOfTurn?: boolean;
  /** All must hold. */
  checks: ObjectiveCheck[];
}

export const OBJECTIVE_STATS: ObjectiveStat[] = ['power', 'popularity', 'coins', 'combatCards'];
export const OBJECTIVE_UNITS: ObjectiveUnit[] = ['character', 'mech', 'worker', 'any'];
export const OBJECTIVE_PROGRESS: ObjectiveProgress[] = ['upgrades', 'mechs', 'structures', 'recruits', 'workers'];
const TERRAINS: Terrain[] = ['farm', 'forest', 'mountain', 'tundra', 'village', 'lake', 'factory'];
const RESOURCES: Resource[] = ['oil', 'metal', 'wood', 'food'];

/** Shuffles the objective deck, if the game has one, and deals each player as many cards as their mat says. */
export function setupObjectives(state: GameState): GameState {
  const cards = state.setup.objectives ?? [];
  if (cards.length === 0) return state;
  const [shuffled, rng] = shuffle(state.rng, cards.map((c) => c.id));
  const deck = [...shuffled];
  const players = state.players.map((p, seat) => ({ ...p, objectives: deck.splice(0, state.setup.players[seat]!.mat.objectiveCards) }));
  return { ...state, rng, players, objectiveDeck: deck };
}

export function objectiveCard(state: GameState, id: string): ObjectiveCard {
  const card = state.setup.objectives?.find((c) => c.id === id);
  if (!card) throw new Error(`no objective card ${id}`);
  return card;
}

const within = (n: number, { atLeast, atMost }: Bounds) => (atLeast === undefined || n >= atLeast) && (atMost === undefined || n <= atMost);

function unitsOf(player: PlayerState, unit: ObjectiveUnit): HexId[] {
  const at = { character: [player.character], mech: player.mechs, worker: player.workers, any: [player.character, ...player.mechs, ...player.workers] }[unit];
  return onBoard(at);
}

const PROGRESS: Record<ObjectiveProgress, (p: PlayerState) => number> = {
  upgrades: (p) => p.upgrades.top.length,
  mechs: (p) => p.mechs.length,
  structures: (p) => Object.values(p.structures).filter(Boolean).length,
  recruits: (p) => p.recruits.length,
  workers: (p) => p.workers.length,
};

/** How many of a condition's things the player has now. */
function count(state: GameState, seat: number, check: Exclude<ObjectiveCheck, { kind: 'eachResource' }>): number {
  const player = state.players[seat]!;
  const terrain = (hex: HexId) => state.setup.board.hexes[hex]?.terrain;
  switch (check.kind) {
    case 'stat':
      return check.stat === 'combatCards' ? player.combatCards.length : player[check.stat];
    case 'resources': {
      const kinds = check.resources?.length ? check.resources : RESOURCES;
      return [...controlledHexes(state, seat)].reduce((n, hex) => n + kinds.reduce((m, r) => m + (state.resources[hex]?.[r] ?? 0), 0), 0);
    }
    case 'units':
      return unitsOf(player, check.unit).filter((hex) => !check.terrain || terrain(hex) === check.terrain).length;
    case 'territories': {
      const hexes = [...controlledHexes(state, seat)];
      if (check.terrain) return hexes.filter((hex) => terrain(hex) === check.terrain).length;
      return hexes.reduce((n, hex) => n + (terrain(hex) === 'factory' ? 3 : 1), 0);
    }
    case 'progress':
      return PROGRESS[check.what](player);
  }
}

/** Whether all of a card's conditions hold for this player now. */
export function objectiveMet(state: GameState, seat: number, card: ObjectiveCard): boolean {
  return card.checks.every((check) => {
    if (check.kind !== 'eachResource') return within(count(state, seat, check), check);
    return check.resources.every((r) => count(state, seat, { kind: 'resources', resources: [r] }) >= check.atLeast);
  });
}

/** Whether the current player could end their turn now (as an end-of-turn card needs). */
const turnEnding = (state: GameState) => state.turn.step === 'end' || (state.turn.step === 'bottom' && state.turn.paid === 0);

/** Objectives the current player can complete now (added to whatever else they can do). */
export function objectiveActions(state: GameState, seat: number): Action[] {
  if (seat !== state.currentPlayer) return [];
  const player = state.players[seat]!;
  const done = player.objectivesDone ?? [];
  if (done.length && !hasRule(state, seat, 'unlimitedCombatStars')) return [];
  return player.objectives
    .filter((id) => !done.includes(id))
    .map((id) => objectiveCard(state, id))
    .filter((card) => (!card.endOfTurn || turnEnding(state)) && objectiveMet(state, seat, card))
    .map((card): Action => ({ type: 'completeObjective', card: card.id }));
}

/** Reveals the card and places a star; the turn carries on, except that an end-of-turn card ends it. */
export function completeObjective(state: GameState, id: string): GameState {
  const seat = state.currentPlayer;
  const player = state.players[seat]!;
  let next = placeStar(updatePlayer(state, seat, { objectivesDone: [...(player.objectivesDone ?? []), id] }), seat, 'objective');
  const turn = state.turn;
  if (objectiveCard(state, id).endOfTurn && turn.step === 'bottom') {
    next = { ...next, turn: { step: 'end', section: turn.section, ...(turn.skippedTop && { skippedTop: true }) } };
  }
  return next;
}

/** What's wrong with an objective card, in plain words; empty when it's fine. */
export function validateObjectiveCard(card: ObjectiveCard): string[] {
  const problems: string[] = [];
  const amount = (n: unknown) => n === undefined || (typeof n === 'number' && Number.isInteger(n) && n >= 0);
  if (!card.name?.trim()) problems.push('name is missing');
  if (!card.id?.trim()) problems.push('ID is missing');
  if (!Array.isArray(card.checks) || card.checks.length === 0) return [...problems, 'it needs at least one condition'];
  card.checks.forEach((c, i) => {
    const which = `condition ${i + 1}`;
    const known =
      (c.kind === 'stat' && OBJECTIVE_STATS.includes(c.stat)) ||
      (c.kind === 'units' && OBJECTIVE_UNITS.includes(c.unit)) ||
      (c.kind === 'progress' && OBJECTIVE_PROGRESS.includes(c.what)) ||
      ((c.kind === 'resources' || c.kind === 'eachResource') && (c.resources ?? []).every((r) => RESOURCES.includes(r))) ||
      c.kind === 'territories';
    if (!known) problems.push(`${which} counts something unknown`);
    if ((c.kind === 'units' || c.kind === 'territories') && c.terrain !== undefined && !TERRAINS.includes(c.terrain)) problems.push(`${which} names an unknown terrain`);
    if (c.kind === 'eachResource' && !c.resources?.length) problems.push(`${which} needs at least one kind of resource`);
    const bounds = c as Bounds;
    if (![bounds.atLeast, bounds.atMost].every(amount)) problems.push(`${which} must use whole numbers of 0 or more`);
    else if (bounds.atLeast === undefined && bounds.atMost === undefined) problems.push(`${which} needs an "at least" or "at most"`);
  });
  return problems;
}
