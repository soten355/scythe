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
import { neighbors } from './board';
import { controlledHexes, onBoard, placeStar, updatePlayer } from './state';

/** Something counted for a condition: met when the count is at least `atLeast` and at most `atMost` (either may be left out). */
interface Bounds {
  atLeast?: number;
  atMost?: number;
}

export type ObjectiveStat = 'power' | 'popularity' | 'coins' | 'combatCards';
export type ObjectiveUnit = 'character' | 'mech' | 'worker' | 'any';
export type ObjectiveProgress = 'upgrades' | 'mechs' | 'structures' | 'recruits' | 'workers' | 'factoryCards' | 'fightsWon';
/** Things that happened during the current turn. */
export type ObjectiveEvent = 'workersSentHome';

/** Something to find on a single territory (see the `oneTerritory` condition). */
export type TerritoryCheck =
  /** Your units of one kind (or any) there. */
  | ({ kind: 'units'; unit: ObjectiveUnit } & Bounds)
  /** Your structures there. */
  | ({ kind: 'structures' } & Bounds)
  /** Your tokens there: character, mechs, workers and structures together. */
  | ({ kind: 'tokens' } & Bounds)
  /** Resources there: of these kinds (every kind if none listed), in all. */
  | ({ kind: 'resources'; resources?: Resource[] } & Bounds)
  /** At least so many of each of these kinds of resources there. */
  | { kind: 'eachResource'; resources: Resource[]; atLeast: number };

export type ObjectiveCheck =
  /** Power, popularity, coins or combat cards in hand. */
  | ({ kind: 'stat'; stat: ObjectiveStat } & Bounds)
  /**
   * Resources on hexes the player controls: of these kinds (every kind if none listed), in all;
   * or, with `oneKind`, the most of any single one of those kinds.
   */
  | ({ kind: 'resources'; resources?: Resource[]; oneKind?: boolean } & Bounds)
  /** At least so many of each of these kinds of resources, on hexes the player controls. */
  | { kind: 'eachResource'; resources: Resource[]; atLeast: number }
  /** The player's units on the board, of one kind or any, on one terrain or any. */
  | ({ kind: 'units'; unit: ObjectiveUnit; terrain?: Terrain } & Bounds)
  /**
   * Territories the player controls: of one terrain, or only tunnels, or all of them
   * (the Factory counting three when nothing narrows it down).
   */
  | ({ kind: 'territories'; terrain?: Terrain; tunnel?: boolean } & Bounds)
  /**
   * Upgrades made, mechs deployed, structures built, recruits enlisted, workers,
   * Factory cards held or fights won (a combat star for each).
   */
  | ({ kind: 'progress'; what: ObjectiveProgress } & Bounds)
  /** Territories the player controls next to one hex of a terrain (the most around any one lake, say). */
  | ({ kind: 'around'; terrain: Terrain } & Bounds)
  /** A territory the player controls where every one of these holds. */
  | { kind: 'oneTerritory'; checks: TerritoryCheck[] }
  /** Two counts the same (as many workers as recruits). */
  | { kind: 'same'; what: [ObjectiveProgress, ObjectiveProgress] }
  /** As much as any other player has, or more (ties are fine). */
  | { kind: 'highest'; stat: ObjectiveStat }
  /** Something done during this turn: enemy workers sent home by your move or a fight you started. */
  | ({ kind: 'thisTurn'; what: ObjectiveEvent } & Bounds);

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
export const OBJECTIVE_PROGRESS: ObjectiveProgress[] = ['upgrades', 'mechs', 'structures', 'recruits', 'workers', 'factoryCards', 'fightsWon'];
export const OBJECTIVE_EVENTS: ObjectiveEvent[] = ['workersSentHome'];
export const OBJECTIVE_TERRAINS: Terrain[] = ['farm', 'forest', 'mountain', 'tundra', 'village', 'lake', 'factory'];
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
  factoryCards: (p) => (p.factoryCard ? 1 : 0),
  fightsWon: (p) => p.stars.filter((s) => s === 'combat').length,
};

const statOf = (player: PlayerState, stat: ObjectiveStat) => (stat === 'combatCards' ? player.combatCards.length : player[stat]);

/** Resources on a hex, of these kinds (every kind if none listed). */
const resourcesOn = (state: GameState, hex: HexId, kinds?: Resource[]) =>
  (kinds?.length ? kinds : RESOURCES).reduce((n, r) => n + (state.resources[hex]?.[r] ?? 0), 0);

/** Whether one territory has what a part of a `oneTerritory` condition asks for. */
function territoryHas(state: GameState, player: PlayerState, hex: HexId, check: TerritoryCheck): boolean {
  const units = (unit: ObjectiveUnit) => unitsOf(player, unit).filter((h) => h === hex).length;
  const structures = Object.values(player.structures).filter((h) => h === hex).length;
  switch (check.kind) {
    case 'units':
      return within(units(check.unit), check);
    case 'structures':
      return within(structures, check);
    case 'tokens':
      return within(units('any') + structures, check);
    case 'resources':
      return within(resourcesOn(state, hex, check.resources), check);
    case 'eachResource':
      return check.resources.every((r) => resourcesOn(state, hex, [r]) >= check.atLeast);
  }
}

type Counted = Extract<ObjectiveCheck, { atLeast?: number; atMost?: number; kind: 'stat' | 'resources' | 'units' | 'territories' | 'progress' | 'around' | 'thisTurn' }>;

/** How many of a condition's things the player has now. */
function count(state: GameState, seat: number, check: Counted): number {
  const player = state.players[seat]!;
  const board = state.setup.board;
  const terrain = (hex: HexId) => board.hexes[hex]?.terrain;
  switch (check.kind) {
    case 'stat':
      return statOf(player, check.stat);
    case 'resources': {
      const hexes = [...controlledHexes(state, seat)];
      const total = (kinds?: Resource[]) => hexes.reduce((n, hex) => n + resourcesOn(state, hex, kinds), 0);
      if (!check.oneKind) return total(check.resources);
      return Math.max(...(check.resources?.length ? check.resources : RESOURCES).map((r) => total([r])));
    }
    case 'units':
      return unitsOf(player, check.unit).filter((hex) => !check.terrain || terrain(hex) === check.terrain).length;
    case 'territories': {
      const hexes = [...controlledHexes(state, seat)].filter((hex) => (!check.terrain || terrain(hex) === check.terrain) && (!check.tunnel || board.hexes[hex]?.tunnel));
      if (check.terrain || check.tunnel) return hexes.length;
      return hexes.reduce((n, hex) => n + (terrain(hex) === 'factory' ? 3 : 1), 0);
    }
    case 'progress':
      return PROGRESS[check.what](player);
    case 'around': {
      const mine = controlledHexes(state, seat);
      const middles = Object.values(board.hexes).filter((h) => h.terrain === check.terrain);
      return Math.max(0, ...middles.map((h) => neighbors(board, h.id).filter((n) => mine.has(n)).length));
    }
    case 'thisTurn':
      return seat === state.currentPlayer ? (state.workersSentHome ?? 0) : 0;
  }
}

/** Whether one condition holds for this player now. */
function checkMet(state: GameState, seat: number, check: ObjectiveCheck): boolean {
  const player = state.players[seat]!;
  switch (check.kind) {
    case 'eachResource':
      return check.resources.every((r) => count(state, seat, { kind: 'resources', resources: [r] }) >= check.atLeast);
    case 'oneTerritory':
      return [...controlledHexes(state, seat)].some((hex) => check.checks.every((part) => territoryHas(state, player, hex, part)));
    case 'same':
      return PROGRESS[check.what[0]](player) === PROGRESS[check.what[1]](player);
    case 'highest':
      return state.players.every((other) => statOf(player, check.stat) >= statOf(other, check.stat));
    default:
      return within(count(state, seat, check), check);
  }
}

/** Whether all of a card's conditions hold for this player now. */
export function objectiveMet(state: GameState, seat: number, card: ObjectiveCard): boolean {
  return card.checks.every((check) => checkMet(state, seat, check));
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

const isAmount = (n: unknown) => n === undefined || (typeof n === 'number' && Number.isInteger(n) && n >= 0);

/** What's wrong with the amounts of a condition (or a part of one), if anything. */
function boundsProblems(which: string, bounds: Bounds): string[] {
  if (![bounds.atLeast, bounds.atMost].every(isAmount)) return [`${which} must use whole numbers of 0 or more`];
  if (bounds.atLeast === undefined && bounds.atMost === undefined) return [`${which} needs an "at least" or "at most"`];
  return [];
}

const knownResources = (kinds: unknown) => kinds === undefined || (Array.isArray(kinds) && kinds.every((r) => RESOURCES.includes(r)));

/** What's wrong with one part of a `oneTerritory` condition. */
function territoryCheckProblems(which: string, c: TerritoryCheck): string[] {
  const known =
    (c.kind === 'units' && OBJECTIVE_UNITS.includes(c.unit)) ||
    c.kind === 'structures' ||
    c.kind === 'tokens' ||
    ((c.kind === 'resources' || c.kind === 'eachResource') && knownResources(c.resources));
  if (!known) return [`${which} counts something unknown`];
  if (c.kind === 'eachResource' && !c.resources?.length) return [`${which} needs at least one kind of resource`];
  return boundsProblems(which, c as Bounds);
}

/** What's wrong with an objective card, in plain words; empty when it's fine. */
export function validateObjectiveCard(card: ObjectiveCard): string[] {
  const problems: string[] = [];
  if (!card.name?.trim()) problems.push('name is missing');
  if (!card.id?.trim()) problems.push('ID is missing');
  if (!Array.isArray(card.checks) || card.checks.length === 0) return [...problems, 'it needs at least one condition'];
  card.checks.forEach((c, i) => {
    const which = `condition ${i + 1}`;
    switch (c.kind) {
      case 'oneTerritory':
        if (!Array.isArray(c.checks) || c.checks.length === 0) problems.push(`${which} needs at least one thing to find on the territory`);
        else c.checks.forEach((part, j) => problems.push(...territoryCheckProblems(`${which}, part ${j + 1}`, part)));
        return;
      case 'same':
        if (!Array.isArray(c.what) || c.what.length !== 2) problems.push(`${which} needs two things to compare`);
        else if (!c.what.every((w) => OBJECTIVE_PROGRESS.includes(w))) problems.push(`${which} counts something unknown`);
        return;
      case 'highest':
        if (!OBJECTIVE_STATS.includes(c.stat)) problems.push(`${which} counts something unknown`);
        return;
    }
    const known =
      (c.kind === 'stat' && OBJECTIVE_STATS.includes(c.stat)) ||
      (c.kind === 'units' && OBJECTIVE_UNITS.includes(c.unit)) ||
      (c.kind === 'progress' && OBJECTIVE_PROGRESS.includes(c.what)) ||
      (c.kind === 'thisTurn' && OBJECTIVE_EVENTS.includes(c.what)) ||
      ((c.kind === 'resources' || c.kind === 'eachResource') && knownResources(c.resources)) ||
      c.kind === 'territories' ||
      c.kind === 'around';
    if (!known) {
      problems.push(`${which} counts something unknown`);
      return;
    }
    const terrain = (c as { terrain?: Terrain }).terrain;
    if ((c.kind === 'units' || c.kind === 'territories' || c.kind === 'around') && (terrain !== undefined || c.kind === 'around') && !OBJECTIVE_TERRAINS.includes(terrain!)) problems.push(`${which} names an unknown terrain`);
    if (c.kind === 'eachResource' && !c.resources?.length) problems.push(`${which} needs at least one kind of resource`);
    problems.push(...boundsProblems(which, c as Bounds));
  });
  return problems;
}
