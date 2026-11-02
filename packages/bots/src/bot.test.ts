import { baseBoard, baseFactions, baseMats, sampleEncounters, sampleFactoryCards, sampleObjectives, sampleStructureBonuses } from '@scythe/content';
import { applyAction, legalActions, newGame, playerView, standings, type GameSetup, type GameState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { planningBot } from './bot';
import { playMatch, randomSeat } from './match';

const setup = (seed: number, players: number): GameSetup => ({
  seed,
  board: baseBoard,
  players: baseFactions.slice(0, players).map((faction, i) => ({ faction, mat: baseMats[(i + seed) % 5]! })),
  encounters: sampleEncounters,
  factory: sampleFactoryCards,
  objectives: sampleObjectives,
  structureBonuses: sampleStructureBonuses,
});

describe('planning bot', () => {
  it('plays a whole game against a random player, legally, and wins', async () => {
    for (const seed of [1, 2]) {
      const { state, finished } = await playMatch(setup(seed, 2), [planningBot({ width: 4 }), randomSeat(seed)]);
      expect(finished).toBe(true);
      expect(standings(state)[0]!.seat, `game ${seed}`).toBe(0);
    }
  }, 120_000);

  it('plays whole games against other bots, and someone ends them', async () => {
    const { state, finished } = await playMatch(setup(3, 3), [planningBot({ width: 3 }), planningBot({ width: 3 }), planningBot({ width: 3 })]);
    expect(finished).toBe(true);
    // A real game is about 20-30 turns each; well short of random play's hundreds.
    expect(state.turnsTaken / 3).toBeLessThan(80);
  }, 120_000);

  it("doesn't stall: a setup whose games once ran 750 turns now ends", async () => {
    // Saxony against Nordic (seed 704): Saxony sat still to keep the power to produce, and Nordic stopped one star short.
    const s: GameSetup = { ...setup(704, 2), players: [4, 0].map((f, i) => ({ faction: baseFactions[f]!, mat: baseMats[(i + 8) % 5]! })) };
    const { state, finished } = await playMatch(s, [planningBot({ personality: 'balanced', seed: 40 }), planningBot({ personality: 'balanced', seed: 41 })], { maxActions: 20_000 });
    expect(finished).toBe(true);
    expect(state.turnsTaken / 2).toBeLessThan(100);
  }, 120_000);

  it("decides the same whatever the other players' hidden cards are", async () => {
    const start = newGame(setup(1, 2));
    const seat = start.currentPlayer;
    const other = 1 - seat;
    const hand = (cards: number[]): GameState => ({ ...start, players: start.players.map((p, i) => (i === other ? { ...p, combatCards: cards } : p)) });
    const [a, b] = [hand([2, 2]), hand([5, 5])];
    const pick = async (s: GameState) => planningBot().chooseAction(playerView(s, seat), legalActions(s, seat));
    expect(await pick(a)).toEqual(await pick(b));
  });

  it('plays out its plan over several calls, each action legal when it comes', async () => {
    let state = newGame(setup(1, 2));
    const bot = planningBot();
    const seat = state.currentPlayer;
    while (state.currentPlayer === seat) {
      const legal = legalActions(state, seat);
      const action = await bot.chooseAction(playerView(state, seat), legal);
      expect(legal).toContainEqual(action);
      state = applyAction(state, action);
    }
    expect(state.turnsTaken).toBe(1);
  });
});
