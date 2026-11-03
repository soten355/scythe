import { baseBoard, baseFactions, baseMats, sampleEncounters } from '@scythe/content';
import { applyAction, legalActions, newGame, type GameState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { gainsBetween, recruitPayoutsIn } from './gains';

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

describe('recruit bonuses paid out', () => {
  // Three players; each has a recruit on their Upgrade section, and Nordic (seat 0) is about to upgrade, already paid.
  const upgrading = () => {
    const players = [0, 1, 2].map((i) => ({ faction: baseFactions[i]!, mat: baseMats[i]! }));
    const state = newGame({ seed: 1, board: baseBoard, players });
    const upgradeOf = (seat: number) => state.setup.players[seat]!.mat.sections.findIndex((s) => s.bottom.action === 'upgrade') as 0;
    return {
      ...state,
      currentPlayer: 0,
      players: state.players.map((p, seat) => ({ ...p, recruits: [upgradeOf(seat)] })),
      turn: { step: 'bottom', section: upgradeOf(0), paid: 9 },
    } as GameState;
  };

  it('lists everyone paid when a bottom-row action is done: the player and both neighbours', () => {
    const before = upgrading();
    const after = applyAction(before, legalActions(before, 0)[0]!);
    const bonus = (seat: number) => before.setup.players[seat]!.mat.sections.find((s) => s.bottom.action === 'upgrade')!.bottom.recruitBonus;
    const paid = recruitPayoutsIn([before, after]);
    expect(paid.map((p) => p.seat).sort()).toEqual([0, 1, 2]);
    for (const p of paid) expect(p.bonus).toBe(bonus(p.seat));
  });

  it('lists nobody for steps that pay no bottom-row action', () => {
    const before = upgrading();
    const chosen = newGame({ seed: 1, board: baseBoard, players: before.setup.players });
    expect(recruitPayoutsIn([chosen, applyAction(chosen, legalActions(chosen, chosen.currentPlayer)[0]!)])).toEqual([]);
  });
});
