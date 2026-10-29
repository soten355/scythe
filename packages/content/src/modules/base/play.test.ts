import { applyAction, legalActions, newGame, nextInt, seedRng } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { baseBoard } from './board';
import { baseFactions } from './factions';
import { baseMats } from './mats';

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
});
