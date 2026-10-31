// Game state, actions and the turn structure.
//
// A turn: choose a section of your player mat (not the one you used last
// turn), then optionally take its top-row action, then optionally its
// bottom-row action, in that order. After a bottom-row action the player
// ends the turn themselves (so it can still be undone); skipping the bottom
// row ends it at once. Then the next player goes.
//
// Each action is broken into small steps (move this unit, pay this resource),
// each its own Action. The rules for each top- and bottom-row action live in
// top-actions.ts and bottom-actions.ts.
import type { Board, HexId } from './board';
import { bottomActions, applyBottom } from './bottom-actions';
import { applyCombat, combatActions, combatSeat, COMBAT_DECK, drawCombatCards, type CombatResult } from './combat';
import { awardStars, endTurn, SECTIONS, type StarKind } from './state';
import type { Faction } from './faction';
import type { PlayerMat, RecruitBonus, Resource, Structure } from './mat';
import { seedRng, shuffle, type RngState } from './rng';
import { topActions, applyTop } from './top-actions';

export type SectionIndex = 0 | 1 | 2 | 3;

export interface GameSetup {
  seed: number;
  board: Board;
  /** 1-7 seats, in seating order (clockwise). The lowest mat turn order goes first. */
  players: { faction: Faction; mat: PlayerMat }[];
}

/** Where a unit stands: a hex, or "home" for the player's own home base. */
export type Location = HexId | 'home';

export type UnitRef = { kind: 'character' } | { kind: 'mech' | 'worker'; index: number };

/** What a unit has picked up to carry on its next move: workers (mechs only) and resources. */
export interface Load {
  unit: UnitRef;
  workers: number[];
  resources: ResourcePile;
}

/** A top-row value that an upgrade can improve, e.g. section 0's "power". */
export interface TopUpgrade {
  section: SectionIndex;
  field: string;
}

export interface PlayerState {
  /** Section used on this player's previous turn; null before their first. */
  lastSection: SectionIndex | null;
  coins: number;
  power: number;
  popularity: number;
  /** Combat cards in hand, by value (hidden from the other players). */
  combatCards: number[];
  /** Mechs and workers sent home after losing a fight stand on the home base until they move out. */
  character: Location;
  mechs: Location[];
  workers: Location[];
  structures: Partial<Record<Structure, HexId>>;
  /** Indexes into the faction's mech abilities, in the order unlocked. */
  mechAbilities: number[];
  /** Each upgrade moves one cube from a top-row value to a bottom-row section. */
  upgrades: { top: TopUpgrade[]; bottom: SectionIndex[] };
  /** Sections whose bottom-row action has a recruit on it. */
  recruits: SectionIndex[];
  /** One-time recruit bonuses already used. */
  recruitBonusesTaken: RecruitBonus[];
  /** Stars placed so far, in the order earned (one of each kind but two for combat, and the faction's star count in all). */
  stars: StarKind[];
}

/** Where the current player is within their turn. */
export type TurnStep =
  | { step: 'chooseSection' }
  | { step: 'top'; section: SectionIndex }
  | { step: 'moving'; section: SectionIndex; moved: UnitRef[]; load?: Load }
  | { step: 'trading'; section: SectionIndex; left: number; hex: HexId }
  | { step: 'producing'; section: SectionIndex; produced: HexId[] }
  /** Fights still to come after a move (`left`), and the one under way, if picked. */
  | { step: 'combat'; section: SectionIndex; left: HexId[]; fight: Fight | null }
  | { step: 'bottom'; section: SectionIndex; paid: number }
  /** The bottom-row action is done; only End turn is left. */
  | { step: 'end'; section: SectionIndex };

/** One side of a fight: the cards added so far, and the power dialed once they've chosen (null until then). */
export interface CombatSide {
  seat: number;
  cards: number[];
  power: number | null;
}

export interface Fight {
  hex: HexId;
  attacker: CombatSide;
  defender: CombatSide;
}

export type ResourcePile = Partial<Record<Resource, number>>;

export interface GameState {
  setup: GameSetup;
  rng: RngState;
  players: PlayerState[];
  /** Resources lying on hexes (whoever controls the hex may spend them). */
  resources: Record<HexId, ResourcePile>;
  currentPlayer: number;
  turn: TurnStep;
  /** Completed turns, across all players. */
  turnsTaken: number;
  /** The combat card deck (drawn from the front) and discard pile. */
  combatDeck: number[];
  combatDiscard: number[];
  /** The most recent fight, as both sides revealed it. */
  lastCombat?: CombatResult;
}

export type Action =
  | { type: 'chooseSection'; section: number }
  | { type: 'skipTop' }
  // Move: move units one hex each, or gain coins instead. Before moving, a
  // unit can pick up resources (and a mech, workers) from its hex, one at a time.
  | { type: 'carryWorker'; unit: UnitRef; worker: number }
  | { type: 'carryResource'; unit: UnitRef; resource: Resource }
  | { type: 'moveUnit'; unit: UnitRef; to: HexId }
  | { type: 'endMove' }
  | { type: 'gainCoins' }
  // Trade: pay coins, then gain resources (one at a time) or popularity.
  | { type: 'tradeResource'; resource: Resource; hex: HexId }
  | { type: 'tradePopularity' }
  // Produce: pick hexes with your workers, one at a time.
  | { type: 'produce'; hex: HexId }
  | { type: 'endProduce' }
  // Bolster: pay coins, gain power or combat cards.
  | { type: 'bolster'; gain: 'power' | 'combatCards' }
  | { type: 'skipBottom' }
  // Combat: the attacker picks which fight is next (if there are several);
  // then each side adds cards one at a time and sets the dial, which locks it in.
  | { type: 'fight'; hex: HexId }
  | { type: 'combatCard'; value: number }
  | { type: 'combatPower'; power: number }
  // Bottom row: pay the cost one resource at a time, then the action itself.
  | { type: 'pay'; hex: HexId }
  | { type: 'upgrade'; top: TopUpgrade; bottom: SectionIndex }
  | { type: 'deploy'; hex: HexId; ability: number }
  | { type: 'build'; structure: Structure; hex: HexId }
  | { type: 'enlist'; section: SectionIndex; bonus: RecruitBonus }
  /** Take the bottom-row action for its coins alone (only when it costs nothing and nothing else is possible). */
  | { type: 'takeBottom' }
  | { type: 'endTurn' };

export function newGame(setup: GameSetup): GameState {
  const n = setup.players.length;
  if (n < 1 || n > 7) throw new Error(`a game needs 1-7 players, not ${n}`);
  const homes = setup.players.map((p) => p.faction.homeBase);
  if (new Set(homes).size !== n) throw new Error('two factions share a home base');
  for (const home of homes) {
    if (!setup.board.homeBases[home]) throw new Error(`home base ${home} is not on the board`);
  }

  const players = setup.players.map(({ faction, mat }): PlayerState => ({
    lastSection: null,
    coins: mat.coins,
    power: faction.power,
    popularity: mat.popularity,
    combatCards: [],
    character: 'home',
    mechs: [],
    // One worker on each land hex bordering the home base.
    workers: [...(setup.board.homeBases[faction.homeBase] ?? [])],
    structures: {},
    mechAbilities: [],
    upgrades: { top: [], bottom: [] },
    recruits: [],
    recruitBonusesTaken: [],
    stars: [],
  }));

  const first = setup.players.reduce((best, p, i) => (p.mat.turnOrder < setup.players[best]!.mat.turnOrder ? i : best), 0);
  const [combatDeck, rng] = shuffle(seedRng(setup.seed), COMBAT_DECK);
  const state: GameState = {
    setup,
    rng,
    players,
    resources: {},
    currentPlayer: first,
    turn: { step: 'chooseSection' },
    turnsTaken: 0,
    combatDeck,
    combatDiscard: [],
  };
  return setup.players.reduce((s, p, seat) => drawCombatCards(s, seat, p.faction.combatCards), state);
}

/** Who must act now: the current player, except while the defender in a fight is choosing. */
export function activeSeat(state: GameState): number {
  return state.turn.step === 'combat' ? combatSeat(state, state.turn) : state.currentPlayer;
}

export function legalActions(state: GameState, seat: number): Action[] {
  if (seat !== activeSeat(state) || isGameOver(state)) return [];
  const turn = state.turn;
  switch (turn.step) {
    case 'chooseSection': {
      const last = state.players[seat]?.lastSection;
      return SECTIONS.filter((s) => s !== last).map((section) => ({ type: 'chooseSection', section }));
    }
    case 'top':
      return [...topActions(state, turn), { type: 'skipTop' }];
    case 'moving':
    case 'trading':
    case 'producing':
      return topActions(state, turn);
    case 'combat':
      return combatActions(state, turn);
    case 'bottom':
      return [...bottomActions(state, turn), ...(turn.paid === 0 ? [{ type: 'skipBottom' } as const] : [])];
    case 'end':
      return [{ type: 'endTurn' }];
  }
}

/** JSON with object keys sorted, so actions compare equal whatever order their keys were written in. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );

/** Returns the next state; throws if the action isn't legal for the current player. */
export function applyAction(state: GameState, action: Action): GameState {
  const key = canonical(action);
  if (!legalActions(state, activeSeat(state)).some((a) => canonical(a) === key)) {
    throw new Error(`action ${JSON.stringify(action)} is not legal now`);
  }
  // Whatever the action, anyone may have earned stars (a defender can gain power, say).
  const next = step(state, action);
  return next.players.reduce((s, _p, seat) => awardStars(s, seat), next);
}

function step(state: GameState, action: Action): GameState {
  const turn = state.turn;
  switch (turn.step) {
    case 'chooseSection':
      return { ...state, turn: { step: 'top', section: (action as { section: SectionIndex }).section } };
    case 'top':
      if (action.type === 'skipTop') return { ...state, turn: { step: 'bottom', section: turn.section, paid: 0 } };
      return applyTop(state, turn, action);
    case 'moving':
    case 'trading':
    case 'producing':
      return applyTop(state, turn, action);
    case 'combat':
      return applyCombat(state, turn, action);
    case 'bottom':
      if (action.type === 'skipBottom') return endTurn(state);
      return applyBottom(state, turn, action);
    case 'end':
      return endTurn(state);
  }
}

/** Rebuilds a game from its setup and action log. */
export function replay(setup: GameSetup, log: Action[]): GameState {
  return log.reduce(applyAction, newGame(setup));
}

/** Game end (the sixth star) arrives in Phase 2. */
export function isGameOver(_state: GameState): boolean {
  return false;
}
