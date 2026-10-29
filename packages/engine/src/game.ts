// Game state, actions and the turn structure.
//
// A turn: choose a section of your player mat (not the one you used last
// turn), then optionally take its top-row action, then optionally its
// bottom-row action, in that order. Then the next player goes.
//
// Each action is broken into small steps (move this unit, pay this resource),
// each its own Action. The rules for each top- and bottom-row action live in
// top-actions.ts and bottom-actions.ts.
import type { Board, HexId } from './board';
import { bottomActions, applyBottom } from './bottom-actions';
import { endTurn, SECTIONS } from './state';
import type { Faction } from './faction';
import type { PlayerMat, RecruitBonus, Resource, Structure } from './mat';
import { seedRng, type RngState } from './rng';
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
  /** Count only for now; the combat card deck arrives with combat in Phase 2. */
  combatCards: number;
  character: Location;
  mechs: HexId[];
  workers: HexId[];
  structures: Partial<Record<Structure, HexId>>;
  /** Indexes into the faction's mech abilities, in the order unlocked. */
  mechAbilities: number[];
  /** Each upgrade moves one cube from a top-row value to a bottom-row section. */
  upgrades: { top: TopUpgrade[]; bottom: SectionIndex[] };
  /** Sections whose bottom-row action has a recruit on it. */
  recruits: SectionIndex[];
  /** One-time recruit bonuses already used. */
  recruitBonusesTaken: RecruitBonus[];
}

/** Where the current player is within their turn. */
export type TurnStep =
  | { step: 'chooseSection' }
  | { step: 'top'; section: SectionIndex }
  | { step: 'moving'; section: SectionIndex; moved: UnitRef[]; load?: Load }
  | { step: 'trading'; section: SectionIndex; left: number }
  | { step: 'producing'; section: SectionIndex; produced: HexId[] }
  | { step: 'bottom'; section: SectionIndex; paid: number };

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
  // Bottom row: pay the cost one resource at a time, then the action itself.
  | { type: 'pay'; hex: HexId }
  | { type: 'upgrade'; top: TopUpgrade; bottom: SectionIndex }
  | { type: 'deploy'; hex: HexId; ability: number }
  | { type: 'build'; structure: Structure; hex: HexId }
  | { type: 'enlist'; section: SectionIndex; bonus: RecruitBonus }
  /** Take the bottom-row action for its coins alone (only when it costs nothing and nothing else is possible). */
  | { type: 'takeBottom' };

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
    combatCards: faction.combatCards,
    character: 'home',
    mechs: [],
    // One worker on each land hex bordering the home base.
    workers: [...(setup.board.homeBases[faction.homeBase] ?? [])],
    structures: {},
    mechAbilities: [],
    upgrades: { top: [], bottom: [] },
    recruits: [],
    recruitBonusesTaken: [],
  }));

  const first = setup.players.reduce((best, p, i) => (p.mat.turnOrder < setup.players[best]!.mat.turnOrder ? i : best), 0);
  return {
    setup,
    rng: seedRng(setup.seed),
    players,
    resources: {},
    currentPlayer: first,
    turn: { step: 'chooseSection' },
    turnsTaken: 0,
  };
}

export function legalActions(state: GameState, seat: number): Action[] {
  if (seat !== state.currentPlayer || isGameOver(state)) return [];
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
    case 'bottom':
      return [...bottomActions(state, turn), ...(turn.paid === 0 ? [{ type: 'skipBottom' } as const] : [])];
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
  if (!legalActions(state, state.currentPlayer).some((a) => canonical(a) === key)) {
    throw new Error(`action ${JSON.stringify(action)} is not legal now`);
  }
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
    case 'bottom':
      if (action.type === 'skipBottom') return endTurn(state);
      return applyBottom(state, turn, action);
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
