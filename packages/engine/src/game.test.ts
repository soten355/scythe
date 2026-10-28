import { describe, expect, it } from 'vitest';
import { applyAction, isGameOver, legalActions, newGame, replay, type Action, type GameState } from './game';
import { nextInt, seedRng } from './rng';

const setup = { seed: 1, players: 2 };

/** Plays a list of actions for whoever's turn it is. */
const play = (state: GameState, actions: Action[]) => actions.reduce(applyAction, state);

const fullTurn = (section: number): Action[] => [
  { type: 'chooseSection', section },
  { type: 'takeTop' },
  { type: 'takeBottom' },
];

describe('turn structure', () => {
  it('starts with the first player choosing any of the four sections', () => {
    const state = newGame(setup);
    expect(state.currentPlayer).toBe(0);
    expect(legalActions(state, 0)).toEqual([0, 1, 2, 3].map((section) => ({ type: 'chooseSection', section })));
  });

  it('gives only the current player any choices', () => {
    expect(legalActions(newGame(setup), 1)).toEqual([]);
  });

  it('offers the top-row action, then the bottom-row action, each skippable', () => {
    let state = play(newGame(setup), [{ type: 'chooseSection', section: 2 }]);
    expect(legalActions(state, 0)).toEqual([{ type: 'takeTop' }, { type: 'skipTop' }]);
    state = applyAction(state, { type: 'takeTop' });
    expect(legalActions(state, 0)).toEqual([{ type: 'takeBottom' }, { type: 'skipBottom' }]);
  });

  it('allows the bottom-row action without the top-row action', () => {
    const state = play(newGame(setup), [{ type: 'chooseSection', section: 0 }, { type: 'skipTop' }]);
    expect(legalActions(state, 0)).toContainEqual({ type: 'takeBottom' });
  });

  it('passes the turn to the next player after the bottom row', () => {
    const state = play(newGame(setup), fullTurn(1));
    expect(state.currentPlayer).toBe(1);
    expect(state.turn).toEqual({ step: 'chooseSection' });
    expect(state.players[0]?.lastSection).toBe(1);
  });

  it('allows choosing a section and skipping both actions', () => {
    const state = play(newGame(setup), [{ type: 'chooseSection', section: 3 }, { type: 'skipTop' }, { type: 'skipBottom' }]);
    expect(state.currentPlayer).toBe(1);
    expect(state.players[0]?.lastSection).toBe(3);
  });

  it('forbids choosing the same section as on your previous turn', () => {
    const state = play(newGame(setup), [...fullTurn(1), ...fullTurn(1)]);
    // Player 1 may pick section 1 (it was player 0 who used it).
    expect(state.currentPlayer).toBe(0);
    expect(legalActions(state, 0)).toEqual([0, 2, 3].map((section) => ({ type: 'chooseSection', section })));
  });

  it('goes around the table and back to the first player', () => {
    let state = newGame({ seed: 1, players: 3 });
    state = play(state, [...fullTurn(0), ...fullTurn(0), ...fullTurn(0)]);
    expect(state.currentPlayer).toBe(0);
    expect(state.turnsTaken).toBe(3);
  });

  it('rejects actions that are not legal right now', () => {
    const state = newGame(setup);
    expect(() => applyAction(state, { type: 'takeTop' })).toThrow(/not legal/);
    expect(() => applyAction(state, { type: 'chooseSection', section: 4 })).toThrow(/not legal/);
    const later = play(state, fullTurn(2));
    expect(() => play(later, [...fullTurn(0), { type: 'chooseSection', section: 2 }])).toThrow(/not legal/);
  });

  it('never changes the state it was given', () => {
    const state = newGame(setup);
    const before = JSON.stringify(state);
    applyAction(state, { type: 'chooseSection', section: 0 });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('rejects player counts outside 1-7', () => {
    expect(() => newGame({ seed: 1, players: 0 })).toThrow();
    expect(() => newGame({ seed: 1, players: 8 })).toThrow();
  });

  it('is not over yet (game end comes in Phase 2)', () => {
    expect(isGameOver(newGame(setup))).toBe(false);
  });
});

describe('replay', () => {
  it('rebuilds the same state from setup plus the action log', () => {
    const log = [...fullTurn(1), { type: 'chooseSection', section: 0 } as Action, { type: 'skipTop' } as Action];
    expect(replay(setup, log)).toEqual(play(newGame(setup), log));
  });

  it('keeps state as plain JSON', () => {
    const state = replay(setup, fullTurn(3));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('fuzz: random legal games', () => {
  it('always offers the current player a choice and never repeats a section', () => {
    for (let game = 0; game < 50; game++) {
      let rng = seedRng(game);
      let players: number;
      [players, rng] = nextInt(rng, 7);
      let state = newGame({ seed: game, players: players + 1 });
      const lastChosen: (number | null)[] = Array(players + 1).fill(null);

      for (let step = 0; step < 300; step++) {
        const seat = state.currentPlayer;
        const options = legalActions(state, seat);
        expect(options.length).toBeGreaterThan(0);
        for (let other = 0; other < state.players.length; other++) {
          if (other !== seat) expect(legalActions(state, other)).toEqual([]);
        }
        let pick: number;
        [pick, rng] = nextInt(rng, options.length);
        const action = options[pick]!;
        if (action.type === 'chooseSection') {
          expect(action.section).not.toBe(lastChosen[seat]);
          lastChosen[seat] = action.section;
        }
        state = applyAction(state, action);
      }
    }
  });
});
