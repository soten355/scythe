import { baseBoard, baseFactions, baseMats, sampleEncounters, sampleFactoryCards, sampleObjectives, sampleStructureBonuses } from '@scythe/content';
import { activeSeat, applyAction, isGameOver, legalActions, neighbors, newGame, nextInt, score, seedRng, standings, type GameState, type HexId, type PlayerState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { planTurns } from './planner';
import { DEFAULT_WEIGHTS, gameLeft, playerValue, positionScore } from './score';

const game = (seed = 1, players = 2) =>
  newGame({
    seed,
    board: baseBoard,
    players: baseFactions.slice(0, players).map((faction, i) => ({ faction, mat: baseMats[i]! })),
    encounters: sampleEncounters,
    factory: sampleFactoryCards,
    objectives: sampleObjectives,
    structureBonuses: sampleStructureBonuses,
  });

const withPlayer = (state: GameState, seat: number, patch: Partial<PlayerState>): GameState => ({
  ...state,
  players: state.players.map((p, i) => (i === seat ? { ...p, ...patch } : p)),
});

const value = (state: GameState, seat: number) => playerValue(state, seat, seat).total;

function randomGame(seed: number, players = 2): GameState {
  let state = game(seed, players);
  let rng = seedRng(seed);
  while (!isGameOver(state)) {
    const options = legalActions(state, activeSeat(state));
    let pick: number;
    [pick, rng] = nextInt(rng, options.length);
    state = applyAction(state, options[pick]!);
  }
  return state;
}

describe('position score', () => {
  const start = game();
  const me = start.currentPlayer;
  const them = 1 - me;

  it('adds up its parts', () => {
    const { total, parts } = playerValue(start, me, me);
    expect(Object.values(parts).reduce((a, b) => a + b, 0)).toBeCloseTo(total);
    expect(Object.keys(parts)).toEqual(expect.arrayContaining(['coins', 'stars', 'territories', 'resources', 'mechs', 'upgrades', 'fuel']));
  });

  it('is higher with more coins, stars, mechs or upgrades', () => {
    const base = value(start, me);
    expect(value(withPlayer(start, me, { coins: 10 }), me)).toBeGreaterThan(base);
    expect(value(withPlayer(start, me, { stars: ['power'] }), me)).toBeGreaterThan(base);
    expect(value(withPlayer(start, me, { mechs: [start.players[me]!.workers[0]!] }), me)).toBeGreaterThan(base);
    expect(value(withPlayer(start, me, { upgrades: { top: [{ section: 0, field: 'power' }], bottom: [1] } }), me)).toBeGreaterThan(base);
  });

  it('has adjustable weights: a weight of 0 drops its part', () => {
    const state = withPlayer(start, me, { mechs: [start.players[me]!.workers[0]!] });
    expect(playerValue(state, me, me).parts.mechs).toBeGreaterThan(0);
    expect(playerValue(state, me, me, { ...DEFAULT_WEIGHTS, mech: 0 }).parts.mechs).toBe(0);
  });

  it('counts the others against you by `rivalry`', () => {
    const richer = withPlayer(start, them, { coins: 30 });
    expect(positionScore(richer, me)).toBeLessThan(positionScore(start, me));
    const noRivals = { ...DEFAULT_WEIGHTS, rivalry: 0 };
    expect(positionScore(richer, me, noRivals)).toBe(positionScore(start, me, noRivals));
    expect(positionScore(start, me, noRivals)).toBe(value(start, me));
  });

  describe('reads only what the seat could know', () => {
    it("counts combat cards by number, not value (anyone's, even a plan's own draws)", () => {
      const low = withPlayer(withPlayer(start, them, { combatCards: [2, 2] }), me, { combatCards: [2] });
      const high = withPlayer(withPlayer(start, them, { combatCards: [5, 5] }), me, { combatCards: [5] });
      expect(positionScore(high, me)).toBe(positionScore(low, me));
    });

    it("ignores the other players' objective cards, but not its own", () => {
      const swapped = withPlayer(start, them, { objectives: [...start.players[me]!.objectives] });
      expect(positionScore(swapped, me)).toBe(positionScore(start, me));
      expect(playerValue(start, me, them).parts.objectives).toBe(0);
    });
  });

  it('once the game is over, is the final score (plus the weights for stars and popularity)', () => {
    for (const seed of [1, 2, 3]) {
      const end = randomGame(seed);
      for (const seat of [0, 1]) {
        const p = end.players[seat]!;
        const extra = p.stars.length * DEFAULT_WEIGHTS.star + p.popularity * DEFAULT_WEIGHTS.popularity;
        expect(value(end, seat)).toBeCloseTo(score(end)[seat]!.total + extra);
      }
    }
  });

  it("judges how much of the game is left from the pace of the player nearest their last star", () => {
    expect(gameLeft(start)).toBe(1);
    // 4 stars in 10 rounds (2 players: 20 turns): 2 more at that pace is 5 rounds, a third of a long game.
    const quick: GameState = { ...withPlayer(start, me, { stars: ['power', 'mechs', 'workers', 'upgrades'] }), turnsTaken: 20 };
    expect(gameLeft(quick)).toBeCloseTo(5 / 15);
    // The same 4 stars over 40 rounds: the game is going slowly, with plenty left.
    expect(gameLeft({ ...quick, turnsTaken: 80 })).toBe(1);
    expect(gameLeft(randomGame(1))).toBe(0);
  });

  it('presses for the last star when ahead: progress toward it counts several times over', () => {
    const five: PlayerState['stars'] = ['power', 'mechs', 'workers', 'upgrades', 'recruits'];
    const ahead = withPlayer(withPlayer(start, me, { stars: five, coins: 40, popularity: 13 }), them, { coins: 0 });
    const behind = withPlayer(withPlayer(start, me, { stars: five, coins: 0, popularity: 13 }), them, { coins: 200 });
    const push = (s: GameState) => playerValue(withPlayer(s, me, { popularity: 14 }), me, me).parts.closestStar! - playerValue(s, me, me).parts.closestStar!;
    expect(push(ahead)).toBeCloseTo(push(behind) * DEFAULT_WEIGHTS.finishing);
  });

  it('prefers producing to sitting still, even when it uses the last of its power', () => {
    // 4 workers: producing costs 1 power, and there's only 1.
    const board = start.setup.board;
    const mountain = Object.values(board.hexes).find((h) => h.terrain === 'mountain')!.id;
    const forest = Object.values(board.hexes).find((h) => h.terrain === 'forest')!.id;
    const before = withPlayer(start, me, { power: 1, workers: [mountain, mountain, forest, forest] });
    const after: GameState = { ...withPlayer(before, me, { power: 0 }), resources: { [mountain]: { metal: 2 }, [forest]: { wood: 2 } } };
    expect(value(after, me)).toBeGreaterThan(value(before, me));
  });

  it('scores a finished game by the result: winning beats anything, losing is worse than anything', () => {
    for (const seed of [1, 2, 3]) {
      const end = randomGame(seed);
      const [winner, loser] = standings(end).map((s) => s.seat) as [number, number];
      expect(positionScore(end, winner)).toBeGreaterThan(500);
      expect(positionScore(end, loser)).toBeLessThan(-500);
      // Rich as could be, but not yet over: still less than having won.
      expect(positionScore(withPlayer(start, me, { coins: 300 }), me)).toBeLessThan(positionScore(end, winner));
    }
  });

  it('counts resources paid toward a bottom-row action as still there, so paying half-way loses nothing', () => {
    const hex = start.players[me]!.workers[0]!;
    const mat = start.setup.players[me]!.mat;
    const upgrade = mat.sections.findIndex((s) => s.bottom.action === 'upgrade');
    let state: GameState = { ...start, resources: { [hex]: { oil: 5 } } };
    state = applyAction(applyAction(state, { type: 'chooseSection', section: upgrade }), { type: 'skipTop' });
    const paid = applyAction(state, { type: 'pay', hex });
    expect(paid.resources[hex]!.oil).toBe(4);
    expect(value(paid, me)).toBeCloseTo(value(state, me));
  });

  it('values resources as fuel only up to what the bottom-row actions still to take can use', () => {
    const hex = start.players[me]!.workers[0]!;
    const fuel = (oil: number) => playerValue({ ...start, resources: { [hex]: { oil } } }, me, me).parts.fuel!;
    expect(fuel(2)).toBeGreaterThan(fuel(0));
    // 6 upgrades at most: once oil covers them all, more adds no fuel.
    expect(fuel(60)).toBe(fuel(40));
  });

  it("values a worker ready to produce a resource that's short", () => {
    const board = start.setup.board;
    const [first, second] = start.players[me]!.workers as [HexId, HexId];
    const mountain = Object.values(board.hexes).find((h) => h.terrain === 'mountain')!.id;
    const onMountain = withPlayer(start, me, { workers: [first, mountain] });
    const produces = (s: GameState) => playerValue(s, me, me).parts.produces!;
    const terrain = (h: HexId) => board.hexes[h]!.terrain;
    // Neither starting worker is on a mountain (no faction starts beside one in the base game).
    expect([terrain(first), terrain(second)]).not.toContain('mountain');
    expect(produces(onMountain)).toBeGreaterThan(produces(withPlayer(start, me, { workers: [first, first] })));
  });

  it('values popularity toward the next tier during the game, and only the tier at the end', () => {
    const at = (popularity: number) => playerValue(withPlayer(start, me, { popularity, stars: ['power'] }), me, me).parts.stars!;
    expect(at(6)).toBeGreaterThan(at(3));
    const end = randomGame(2);
    const seat = end.players.findIndex((p) => p.stars.length > 0);
    const final = (popularity: number) => playerValue(withPlayer(end, seat, { popularity }), seat, seat).parts.stars!;
    expect(final(6)).toBe(final(3));
    expect(final(7)).toBeGreaterThan(final(6));
  });

  it('prefers the character near an encounter or the Factory', () => {
    const board = start.setup.board;
    const token = start.encounterTokens[0]!;
    const near = neighbors(board, token).find((h) => board.hexes[h]!.terrain !== 'lake' && !start.encounterTokens.includes(h))!;
    expect(value(withPlayer(start, me, { character: near }), me)).toBeGreaterThan(value(start, me));
  });

  it('guides the planner to sensible turns: it deploys a mech when it has the metal', () => {
    const hex = start.players[me]!.workers[0]!;
    const state: GameState = { ...start, resources: { [hex]: { metal: 4 } } };
    const plans = planTurns(state, me).plans;
    const best = plans.reduce((a, b) => (positionScore(b.state, me) > positionScore(a.state, me) ? b : a));
    expect(best.actions.some((a) => a.type === 'deploy')).toBe(true);
  });
});
