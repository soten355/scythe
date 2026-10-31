import { describe, expect, it } from 'vitest';
import { activeSeat, applyAction, isGameOver, legalActions, newGame, replay, type Action, type GameState } from './game';
import { nextInt, seedRng } from './rng';
import { MAX_POPULARITY, MAX_WORKERS, unitHexes } from './state';
import { factionA, factionB, testMatA, testMatB, testSetup as setup } from './test-fixtures';
import { MAX_POWER } from './faction';
import { COMBAT_DECK } from './combat';

/** Plays a list of actions for whoever's turn it is. */
const play = (state: GameState, actions: Action[]) => actions.reduce(applyAction, state);

const fullTurn = (section: number): Action[] => [
  { type: 'chooseSection', section },
  { type: 'skipTop' },
  { type: 'skipBottom' },
];

describe('setup', () => {
  it('starts each player with their mat and faction values and pieces', () => {
    const [a, b] = newGame(setup).players;
    expect(a).toMatchObject({ coins: 4, popularity: 2, power: 3, character: 'home', workers: ['A1', 'A2'], mechs: [] });
    expect(a!.combatCards).toHaveLength(2);
    expect(b).toMatchObject({ coins: 5, workers: ['C2', 'C3'] });
  });

  it('lets the lowest mat turn order go first', () => {
    const swapped = { ...setup, players: [{ faction: factionA, mat: testMatB }, { faction: factionB, mat: testMatA }] };
    expect(newGame(swapped).currentPlayer).toBe(1);
  });

  it('rejects player counts outside 1-7 and shared home bases', () => {
    expect(() => newGame({ ...setup, players: [] })).toThrow();
    expect(() => newGame({ ...setup, players: Array(8).fill(setup.players[0]) })).toThrow();
    expect(() => newGame({ ...setup, players: [setup.players[0]!, setup.players[0]!] })).toThrow(/home base/);
  });
});

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
    expect(legalActions(state, 0)).toContainEqual({ type: 'gainCoins' });
    expect(legalActions(state, 0)).toContainEqual({ type: 'skipTop' });
    state = applyAction(state, { type: 'gainCoins' });
    expect(state.turn).toEqual({ step: 'bottom', section: 2, paid: 0 });
    expect(legalActions(state, 0)).toContainEqual({ type: 'skipBottom' });
  });

  it('passes the turn to the next player after the bottom row', () => {
    const state = play(newGame(setup), fullTurn(1));
    expect(state.currentPlayer).toBe(1);
    expect(state.turn).toEqual({ step: 'chooseSection' });
    expect(state.players[0]?.lastSection).toBe(1);
  });

  it('forbids choosing the same section as on your previous turn', () => {
    const state = play(newGame(setup), [...fullTurn(1), ...fullTurn(1)]);
    // Player 1 may pick section 1 (it was player 0 who used it).
    expect(state.currentPlayer).toBe(0);
    expect(legalActions(state, 0)).toEqual([0, 2, 3].map((section) => ({ type: 'chooseSection', section })));
  });

  it('goes around the table and back to the first player', () => {
    const state = play(newGame(setup), [...fullTurn(0), ...fullTurn(0)]);
    expect(state.currentPlayer).toBe(0);
    expect(state.turnsTaken).toBe(2);
  });

  it('rejects actions that are not legal right now', () => {
    const state = newGame(setup);
    expect(() => applyAction(state, { type: 'skipTop' })).toThrow(/not legal/);
    expect(() => applyAction(state, { type: 'chooseSection', section: 4 })).toThrow(/not legal/);
    const later = play(state, fullTurn(2));
    expect(() => play(later, [...fullTurn(0), { type: 'chooseSection', section: 2 }])).toThrow(/not legal/);
  });

  it('accepts an action whatever order its fields are written in', () => {
    const state = play(newGame(setup), [{ type: 'chooseSection', section: 2 }]);
    const reordered = { to: 'A1', unit: { kind: 'character' }, type: 'moveUnit' } as Action;
    expect(applyAction(state, reordered).players[0]!.character).toBe('A1');
  });

  it('never changes the state it was given', () => {
    const state = newGame(setup);
    const before = JSON.stringify(state);
    applyAction(state, { type: 'chooseSection', section: 0 });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('is not over yet (game end comes in Phase 2)', () => {
    expect(isGameOver(newGame(setup))).toBe(false);
  });
});

describe('replay', () => {
  it('rebuilds the same state from setup plus the action log', () => {
    const log: Action[] = [...fullTurn(1), { type: 'chooseSection', section: 2 }, { type: 'bolster', gain: 'power' }];
    expect(replay(setup, log)).toEqual(play(newGame(setup), log));
  });

  it('keeps state as plain JSON', () => {
    const state = replay(setup, fullTurn(3));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

/** Rule invariants that must hold after every action. */
function checkInvariants(state: GameState) {
  const board = state.setup.board;
  for (const p of state.players) {
    for (const n of [p.coins, p.power, p.popularity]) expect(n).toBeGreaterThanOrEqual(0);
    expect(p.power).toBeLessThanOrEqual(MAX_POWER);
    expect(p.popularity).toBeLessThanOrEqual(MAX_POPULARITY);
    expect(p.workers.length).toBeLessThanOrEqual(MAX_WORKERS);
    expect(p.mechs.length).toBeLessThanOrEqual(4);
    expect(new Set(p.mechAbilities).size).toBe(p.mechAbilities.length);
    expect(Object.keys(p.structures).length).toBeLessThanOrEqual(4);
    expect(p.recruits.length).toBeLessThanOrEqual(4);
    for (const hex of unitHexes(p)) expect(board.hexes[hex]?.terrain).not.toBe('lake');
  }
  state.players.forEach((p, seat) => {
    expect(p.stars.length).toBeLessThanOrEqual(state.setup.players[seat]!.faction.stars);
    expect(p.stars.filter((s) => s === 'combat').length).toBeLessThanOrEqual(2);
    expect(new Set(p.stars.filter((s) => s !== 'combat')).size).toBe(p.stars.filter((s) => s !== 'combat').length);
  });
  // No two players' units share a hex, except during a move and the fights after it.
  if (state.turn.step !== 'moving' && state.turn.step !== 'combat') {
    const owners = state.players.map(unitHexes);
    owners.forEach((a, i) => owners.slice(i + 1).forEach((b) => expect([...a].filter((h) => b.has(h))).toEqual([])));
  }
  // Every combat card is in the deck, the discard pile or someone's hand.
  const cards = [...state.combatDeck, ...state.combatDiscard, ...state.players.flatMap((p) => p.combatCards)];
  expect(cards.sort()).toEqual([...COMBAT_DECK].sort());
  for (const pile of Object.values(state.resources)) {
    for (const n of Object.values(pile)) expect(n).toBeGreaterThan(0);
  }
}

describe('fuzz: random legal games', () => {
  it('always offers a choice, never repeats a section and keeps every invariant', () => {
    for (let game = 0; game < 40; game++) {
      let rng = seedRng(game);
      let players: number;
      [players, rng] = nextInt(rng, 2);
      let state = newGame({ ...setup, seed: game, players: setup.players.slice(0, players + 1) });
      const lastChosen: (number | null)[] = Array(players + 1).fill(null);

      for (let step = 0; step < 400; step++) {
        const seat = activeSeat(state);
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
        checkInvariants(state);
      }
    }
  }, 30_000);
});
