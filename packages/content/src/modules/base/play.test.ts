import { activeSeat, applyAction, isGameOver, legalActions, newGame, nextInt, seedRng } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { baseBoard } from './board';
import { baseFactions } from './factions';
import { baseMats } from './mats';
import { sampleEncounters } from './encounters';

describe('a game with the base content', () => {
  const setup = (seed: number) => ({
    seed,
    board: baseBoard,
    players: [
      { faction: baseFactions[0]!, mat: baseMats[0]! },
      { faction: baseFactions[1]!, mat: baseMats[1]! },
    ],
  });

  it('starts each faction with workers beside its home base', () => {
    const state = newGame(setup(1));
    expect(state.players[0]!.workers).toEqual(baseBoard.homeBases.ne);
    expect(state.players[1]!.workers).toEqual(baseBoard.homeBases.e);
  });

  it('plays random legal actions on the real board without errors', () => {
    for (let seed = 0; seed < 10; seed++) {
      let state = newGame(setup(seed));
      let rng = seedRng(seed);
      for (let step = 0; step < 300; step++) {
        const options = legalActions(state, state.currentPlayer);
        expect(options.length).toBeGreaterThan(0);
        let pick: number;
        [pick, rng] = nextInt(rng, options.length);
        state = applyAction(state, options[pick]!);
      }
    }
  });

  it('plays random legal games with encounters and all five factions, keeping every count in bounds', () => {
    let encounters = 0;
    for (let seed = 0; seed < 10; seed++) {
      let state = newGame({
        seed,
        board: baseBoard,
        encounters: sampleEncounters,
        players: baseFactions.map((faction, i) => ({ faction, mat: baseMats[i]! })),
      });
      expect(state.encounterTokens).toHaveLength(11);
      let rng = seedRng(seed);
      for (let step = 0; step < 1500 && !isGameOver(state); step++) {
        const options = legalActions(state, activeSeat(state));
        expect(options.length).toBeGreaterThan(0);
        let pick: number;
        [pick, rng] = nextInt(rng, options.length);
        const tokens = state.encounterTokens.length;
        state = applyAction(state, options[pick]!);
        if (state.encounterTokens.length < tokens) encounters++;
        for (const p of state.players) {
          expect(Math.min(p.coins, p.power, p.popularity)).toBeGreaterThanOrEqual(0);
          expect(p.workers.length).toBeLessThanOrEqual(8);
        }
        expect(state.encounterDeck.length + state.encounterDiscard.length).toBeLessThanOrEqual(sampleEncounters.length);
      }
    }
    expect(encounters).toBeGreaterThan(0);
  });
});

describe('the sample encounter deck', () => {
  it('has a unique ID and three options for every card', () => {
    expect(new Set(sampleEncounters.map((c) => c.id)).size).toBe(sampleEncounters.length);
    for (const c of sampleEncounters) expect(c.options, c.id).toHaveLength(3);
  });
});
