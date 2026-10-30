// What a player is short of for each half of a section (shown on the mat and in the side panel).
import { describe, expect, it } from 'vitest';
import { shortfall } from './afford';
import { newGame, type GameState, type PlayerState, type ResourcePile } from './game';
import { testSetup } from './test-fixtures';

/** Player 0 (mat A: 0 bolster/upgrade 3 oil, 1 produce/deploy 3 metal, 2 move/build 3 wood, 3 trade/enlist 4 food). */
function game(patch: Partial<PlayerState> = {}, resources: Record<string, ResourcePile> = {}): GameState {
  const state = newGame(testSetup);
  return { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, ...patch } : p)), resources };
}

describe('shortfall', () => {
  it('is nothing when both halves can be paid', () => {
    expect(shortfall(game({}, { A1: { oil: 3 } }), 0, 0)).toEqual({ top: [], bottom: [] });
  });

  it('counts the coins missing for Bolster and Trade', () => {
    expect(shortfall(game({ coins: 0 }), 0, 0).top).toEqual([{ what: 'coins', amount: 1 }]);
    expect(shortfall(game({ coins: 0 }), 0, 3).top).toEqual([{ what: 'coins', amount: 1 }]);
    expect(shortfall(game({ coins: 0 }), 0, 2).top).toEqual([]);
  });

  it("counts Produce's power, popularity and coins once there are enough workers", () => {
    const workers = Array(8).fill('A1');
    expect(shortfall(game({ workers, power: 0, popularity: 0, coins: 0 }), 0, 1).top).toEqual([
      { what: 'power', amount: 1 },
      { what: 'popularity', amount: 1 },
      { what: 'coins', amount: 1 },
    ]);
  });

  it('counts the bottom-row resources missing from hexes you control', () => {
    // A1 has your worker; A3 has nobody, so its oil doesn't count.
    expect(shortfall(game({}, { A1: { oil: 1 }, A3: { oil: 5 } }), 0, 0).bottom).toEqual([{ what: 'oil', amount: 2 }]);
  });
});
