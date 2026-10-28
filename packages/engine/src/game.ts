// Game state, actions and the turn structure.
//
// A turn: choose a section of your player mat (not the one you used last
// turn), then optionally take its top-row action, then optionally its
// bottom-row action, in that order. Then the next player goes.
//
// takeTop / takeBottom are placeholders until the real top- and bottom-row
// actions (with costs and rewards) are added.
import { seedRng, type RngState } from './rng';

export type SectionIndex = 0 | 1 | 2 | 3;
export const SECTIONS: SectionIndex[] = [0, 1, 2, 3];

export interface GameSetup {
  seed: number;
  /** Number of seats, 1-7, in turn order. */
  players: number;
}

export interface PlayerState {
  /** Section used on this player's previous turn; null before their first. */
  lastSection: SectionIndex | null;
}

/** Where the current player is within their turn. */
export type TurnStep =
  | { step: 'chooseSection' }
  | { step: 'top'; section: SectionIndex }
  | { step: 'bottom'; section: SectionIndex };

export interface GameState {
  setup: GameSetup;
  rng: RngState;
  players: PlayerState[];
  currentPlayer: number;
  turn: TurnStep;
  /** Completed turns, across all players. */
  turnsTaken: number;
}

export type Action =
  | { type: 'chooseSection'; section: number }
  | { type: 'takeTop' }
  | { type: 'skipTop' }
  | { type: 'takeBottom' }
  | { type: 'skipBottom' };

export function newGame(setup: GameSetup): GameState {
  if (!Number.isInteger(setup.players) || setup.players < 1 || setup.players > 7) {
    throw new Error(`a game needs 1-7 players, not ${setup.players}`);
  }
  return {
    setup,
    rng: seedRng(setup.seed),
    players: Array.from({ length: setup.players }, () => ({ lastSection: null })),
    currentPlayer: 0,
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
      return [{ type: 'takeTop' }, { type: 'skipTop' }];
    case 'bottom':
      return [{ type: 'takeBottom' }, { type: 'skipBottom' }];
  }
}

const sameAction = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);

/** Returns the next state; throws if the action isn't legal for the current player. */
export function applyAction(state: GameState, action: Action): GameState {
  if (!legalActions(state, state.currentPlayer).some((a) => sameAction(a, action))) {
    throw new Error(`action ${JSON.stringify(action)} is not legal now`);
  }
  const turn = state.turn;
  switch (action.type) {
    case 'chooseSection':
      return { ...state, turn: { step: 'top', section: action.section as SectionIndex } };
    case 'takeTop':
    case 'skipTop':
      if (turn.step !== 'top') throw new Error('unreachable');
      return { ...state, turn: { step: 'bottom', section: turn.section } };
    case 'takeBottom':
    case 'skipBottom':
      if (turn.step !== 'bottom') throw new Error('unreachable');
      return endTurn(state, turn.section);
  }
}

function endTurn(state: GameState, section: SectionIndex): GameState {
  const players = state.players.map((p, i) => (i === state.currentPlayer ? { ...p, lastSection: section } : p));
  return {
    ...state,
    players,
    currentPlayer: (state.currentPlayer + 1) % state.players.length,
    turn: { step: 'chooseSection' },
    turnsTaken: state.turnsTaken + 1,
  };
}

/** Rebuilds a game from its setup and action log. */
export function replay(setup: GameSetup, log: Action[]): GameState {
  return log.reduce(applyAction, newGame(setup));
}

/** Game end (the sixth star) arrives in Phase 2. */
export function isGameOver(_state: GameState): boolean {
  return false;
}
