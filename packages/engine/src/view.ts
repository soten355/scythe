// Seats and what they see. Every player, human or bot, is a seat: shown the
// game as they could see it at the table, and the actions open to them, it
// picks one.
//
// A seat's view hides what that player couldn't know: the other players'
// combat cards (their number shows, not their values) and objective cards,
// the other side's cards and dial in a fight until both are revealed, the
// order of every deck, and the random seed (so a bot simulating ahead can't
// work out the next shuffle). Everything the seat itself can do is the same
// in its view as in the game.
import type { Action, Fight, GameState } from './game';
import { seedRng } from './rng';

export interface Seat {
  chooseAction(view: GameState, legalActions: Action[]): Promise<Action>;
}

/** Stands in for a combat card whose value this seat can't see. */
export const HIDDEN_CARD = 0;
/** Stands in for an objective card this seat can't see. */
export const HIDDEN_OBJECTIVE = 'hidden';

/** Stands in for each card in the combat deck: about its average, so a simulated draw is neither a gift nor a loss. */
const UNKNOWN_DRAW = 3;

export function playerView(state: GameState, seat: number): GameState {
  const players = state.players.map((p, i) =>
    i === seat
      ? p
      : {
          ...p,
          combatCards: p.combatCards.map(() => HIDDEN_CARD),
          objectives: p.objectives.map((id) => ((p.objectivesDone ?? []).includes(id) ? id : HIDDEN_OBJECTIVE)),
        },
  );
  let turn = state.turn;
  if (turn.step === 'combat' && turn.fight) {
    const fight: Fight = { ...turn.fight };
    for (const side of ['attacker', 'defender'] as const) {
      const s = fight[side];
      if (s.seat !== seat) fight[side] = { ...s, cards: s.cards.map(() => HIDDEN_CARD), power: s.power === null ? null : 0 };
    }
    turn = { ...turn, fight };
  }
  return {
    ...state,
    players,
    turn,
    rng: seedRng(state.turnsTaken * 7 + seat + 1),
    combatDeck: state.combatDeck.map(() => UNKNOWN_DRAW),
    encounterDeck: [...state.encounterDeck].sort(),
    factoryDeck: [...state.factoryDeck].sort(),
    objectiveDeck: [...state.objectiveDeck].sort(),
  };
}
