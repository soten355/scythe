// Scenario tests for game end and final scoring, on the small test board
// (see test-fixtures.ts): B2 is a lake, B3 the Factory.
import { describe, expect, it } from 'vitest';
import { applyAction, isGameOver, legalActions, newGame, type Action, type GameState, type PlayerState } from './game';
import { POPULARITY_TIERS, score, standings, territories, tierOf } from './scoring';
import type { StarKind } from './state';
import { testSetup } from './test-fixtures';

function game(p0: Partial<PlayerState> = {}, p1: Partial<PlayerState> = {}): GameState {
  const state = newGame(testSetup);
  return { ...state, players: [{ ...state.players[0]!, ...p0 }, { ...state.players[1]!, ...p1 }] };
}
const stars = (n: number): StarKind[] => (['upgrades', 'mechs', 'structures', 'recruits', 'workers', 'combat'] as StarKind[]).slice(0, n);

describe('the end of the game', () => {
  it('goes on while nobody has placed their sixth star', () => {
    expect(isGameOver(game({ stars: stars(5) }))).toBe(false);
  });

  it('ends the moment a player places their sixth star, even mid-turn', () => {
    // Player 0 has 5 stars and 15 power: bolstering for 2 earns the power star.
    let state = game({ stars: stars(5), power: 15 });
    state = applyAction(state, { type: 'chooseSection', section: 0 });
    state = applyAction(state, { type: 'bolster', gain: 'power' } as Action);
    expect(state.players[0]!.stars).toHaveLength(6);
    expect(isGameOver(state)).toBe(true);
    // Nothing more can be done: not the bottom row, not ending the turn.
    expect(legalActions(state, 0)).toEqual([]);
    expect(() => applyAction(state, { type: 'skipBottom' })).toThrow();
  });
});

describe('popularity tiers', () => {
  it('pays more per star, territory and pair of resources the more popular you are', () => {
    expect(tierOf(0)).toEqual(POPULARITY_TIERS[0]);
    expect(tierOf(6)).toEqual({ star: 3, territory: 2, resources: 1 });
    expect(tierOf(7)).toEqual({ star: 4, territory: 3, resources: 2 });
    expect(tierOf(12)).toEqual({ star: 4, territory: 3, resources: 2 });
    expect(tierOf(13)).toEqual({ star: 5, territory: 4, resources: 3 });
    expect(tierOf(18)).toEqual({ star: 5, territory: 4, resources: 3 });
  });
});

describe('final scoring', () => {
  it('adds coins in hand to coins for stars, territories and resources at your tier', () => {
    const state = {
      ...game(
        // Popularity 8 (middle tier): 4 a star, 3 a territory, 2 per 2 resources.
        { coins: 10, popularity: 8, stars: stars(3), character: 'A2', workers: ['A1', 'A1', 'A3'], mechs: ['home'] },
        { coins: 5, popularity: 2, stars: [], character: 'home', workers: [] },
      ),
      // 5 resources on hexes player 0 controls (2 pairs), and some on a hex nobody controls.
      resources: { A1: { food: 3 }, A3: { metal: 2 }, C4: { wood: 4 } },
    };
    const [a, b] = score(state);
    expect(a).toMatchObject({
      seat: 0,
      coins: 10,
      stars: { count: 3, rate: 4, coins: 12 },
      territories: { count: 3, rate: 3, coins: 9 },
      resources: { count: 5, rate: 2, coins: 4 },
      total: 35,
    });
    expect(b).toMatchObject({ seat: 1, coins: 5, total: 5 });
  });

  it('counts the Factory as three territories, and a lake as one', () => {
    const state = game({ coins: 0, popularity: 0, character: 'B3', mechs: ['B2'], workers: [] });
    expect(score(state)[0]!.territories).toEqual({ count: 4, rate: 2, coins: 8 });
  });

  it('counts territories during the game the same way (for the top bar)', () => {
    const state = game({ coins: 0, popularity: 0, character: 'B3', mechs: ['B2'], workers: [] });
    expect(territories(state, 0)).toBe(4);
  });

  it('counts a structure as a territory when no enemy unit stands on it', () => {
    const base = game({ coins: 0, popularity: 0, character: 'home', workers: [], structures: { mill: 'A4' } }, { character: 'home', workers: [] });
    expect(score(base)[0]!.territories.count).toBe(1);
    const taken = { ...base, players: [base.players[0]!, { ...base.players[1]!, workers: ['A4'] }] };
    expect(score(taken)[0]!.territories.count).toBe(0);
  });

  it('never counts the home base', () => {
    const state = game({ character: 'home', workers: ['home'], mechs: ['home'] });
    expect(score(state)[0]!.territories.count).toBe(0);
  });
});

describe('who wins', () => {
  it('ranks by total coins', () => {
    const state = game({ coins: 3, workers: [] }, { coins: 20, workers: [] });
    expect(standings(state).map((s) => [s.seat, s.place])).toEqual([
      [1, 1],
      [0, 2],
    ]);
  });

  it('breaks a tie by workers, mechs, structures and recruits; then power; then popularity', () => {
    const tied = (p0: Partial<PlayerState>, p1: Partial<PlayerState>) =>
      standings(game({ coins: 10, popularity: 3, power: 2, workers: [], character: 'home', ...p0 }, { coins: 10, popularity: 3, power: 2, workers: [], character: 'home', ...p1 })).map(
        (s) => s.seat,
      );
    expect(tied({ workers: ['home', 'home'] }, { workers: ['home'], recruits: [0] })).toEqual([0, 1]);
    expect(tied({ power: 1 }, { power: 4 })).toEqual([1, 0]);
    expect(tied({ popularity: 4 }, { popularity: 5 })).toEqual([1, 0]);
  });

  it('shares a place when everything is level', () => {
    const state = game({ coins: 10, workers: [], character: 'home' }, { coins: 10, workers: [], character: 'home', popularity: 2, power: 3 });
    const level = { ...state, players: [state.players[0]!, { ...state.players[1]!, popularity: state.players[0]!.popularity, power: state.players[0]!.power }] };
    expect(standings(level).map((s) => s.place)).toEqual([1, 1]);
  });
});
