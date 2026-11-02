import { baseBoard, baseFactions, baseMats, sampleEncounters } from '@scythe/content';
import { applyAction, newGame, type GameState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { gainsBetween } from './gains';

// Nordic at an encounter on A4 with sample-02: free: 2 power; 2 coins: 2 workers on A4.
const atEncounter = (card: string) => {
  const state = newGame({
    seed: 1,
    board: baseBoard,
    encounters: sampleEncounters,
    players: [
      { faction: baseFactions[0]!, mat: baseMats[0]! },
      { faction: baseFactions[1]!, mat: baseMats[1]! },
    ],
  });
  return { ...state, turn: { step: 'encounter', section: 2, hex: 'A4', card, picked: [], todo: [] } } as GameState;
};

describe('what an encounter gave', () => {
  it('lists gains, not costs', () => {
    const before = atEncounter('sample-02');
    expect(gainsBetween(before, applyAction(before, { type: 'encounterOption', option: 0 }), 0)).toEqual([{ kind: 'power', amount: 2 }]);
    // Paid 2 coins: only the workers show.
    expect(gainsBetween(before, applyAction(before, { type: 'encounterOption', option: 1 }), 0)).toEqual([{ kind: 'worker', amount: 2 }]);
  });

  it('includes resources put on the hex', () => {
    const before = atEncounter('sample-01');
    expect(gainsBetween(before, applyAction(before, { type: 'encounterOption', option: 0 }), 0)).toEqual([{ kind: 'food', amount: 2 }]);
  });
});
