import { baseBoard, baseFactions, baseMats, sampleEncounters, sampleFactoryCards, sampleObjectives, baseStructureBonuses } from '@scythe/content';
import { activeSeat, applyAction, legalActions, newGame, playerView, type Action, type GameState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { planningBot } from './bot';
import { BALANCED, PERSONALITIES, personalityFor, weightsOf } from './personalities';
import { DEFAULT_WEIGHTS, playerValue } from './score';

const game = (seed: number) =>
  newGame({
    seed,
    board: baseBoard,
    players: baseFactions.map((faction, i) => ({ faction, mat: baseMats[(i + seed) % 5]! })),
    encounters: sampleEncounters,
    factory: sampleFactoryCards,
    objectives: sampleObjectives,
    structureBonuses: baseStructureBonuses,
  });

/** Every action in the first `rounds` rounds, with every seat a bot of the given kind. */
async function opening(state: GameState, personality: 'faction' | 'balanced', rounds: number): Promise<Action[]> {
  const bots = state.players.map(() => planningBot({ personality }));
  const taken: Action[] = [];
  while (state.turnsTaken < rounds * state.players.length) {
    const s = activeSeat(state);
    const action = await bots[s]!.chooseAction(playerView(state, s), legalActions(state, s));
    taken.push(action);
    state = applyAction(state, action);
  }
  return taken;
}

describe('faction personalities', () => {
  it('cover every base faction', () => {
    for (const faction of baseFactions) expect(PERSONALITIES[faction.id], faction.id).toBeDefined();
  });

  it('only tilt weights the score has, and keep boldness between 0 and 1', () => {
    for (const p of Object.values(PERSONALITIES)) {
      for (const key of Object.keys(p.weights)) expect(Object.keys(DEFAULT_WEIGHTS), `${p.id}.${key}`).toContain(key);
      expect(p.boldness).toBeGreaterThanOrEqual(0);
      expect(p.boldness).toBeLessThanOrEqual(1);
      expect(p.summary.length).toBeGreaterThan(0);
    }
  });

  it('give a faction without one (your own) the balanced personality', () => {
    expect(personalityFor('my-own-faction')).toBe(BALANCED);
    expect(weightsOf(BALANCED)).toEqual(DEFAULT_WEIGHTS);
  });

  it('change how the score sees a position: Nordic counts territory extra, Polonia is drawn harder to encounters', () => {
    const state = game(1);
    const nordic = state.setup.players.findIndex((p) => p.faction.id === 'nordic');
    const polonia = state.setup.players.findIndex((p) => p.faction.id === 'polonia');
    expect(playerValue(state, nordic, nordic, weightsOf(PERSONALITIES.nordic!)).parts.territoryBias).toBeGreaterThan(0);
    expect(playerValue(state, nordic, nordic).parts.territoryBias).toBeUndefined();
    const pull = (w = DEFAULT_WEIGHTS) => playerValue(state, polonia, polonia, w).parts.pull!;
    expect(pull(weightsOf(PERSONALITIES.polonia!))).toBeGreaterThan(pull());
  });

  it('make bots play differently from a balanced bot', async () => {
    let differ = 0;
    for (const seed of [1, 2, 3]) {
      const state = game(seed);
      if (JSON.stringify(await opening(state, 'faction', 4)) !== JSON.stringify(await opening(state, 'balanced', 4))) differ++;
    }
    expect(differ).toBeGreaterThan(0);
  }, 60_000);
});
