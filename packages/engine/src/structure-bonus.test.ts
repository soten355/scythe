// Scenario tests for structure bonus tiles, on the small test board (see
// test-fixtures.ts): A4 and C1 are tunnels, B2 a lake, A3 and C4 have
// encounter tokens. A2 borders A1, A3, B2 and B3; A3 borders A2, A4, B3 and B4.
import { describe, expect, it } from 'vitest';
import { newGame, type GameState, type PlayerState } from './game';
import { score } from './scoring';
import { structureBonusCount, structureBonusCoins, validateStructureBonus, type StructureBonusTile } from './structure-bonus';
import { testSetup } from './test-fixtures';

const pays = [
  { atLeast: 1, coins: 2 },
  { atLeast: 3, coins: 5 },
];
const tiles: StructureBonusTile[] = [
  { id: 't-tunnels', name: 'Tunnels nearby', count: { kind: 'adjacent', feature: 'tunnel' }, pays },
  { id: 't-lakes', name: 'Lakes nearby', count: { kind: 'adjacent', feature: 'lake' }, pays },
  { id: 't-encounters', name: 'Encounters nearby', count: { kind: 'adjacent', feature: 'encounter' }, pays },
  { id: 't-on-tunnels', name: 'On tunnels', count: { kind: 'on', tunnel: true }, pays },
  { id: 't-on-land', name: 'On farms and tundra', count: { kind: 'on', terrains: ['farm', 'tundra'] }, pays },
  { id: 't-row', name: 'In a row', count: { kind: 'inRow' }, pays },
];
const tile = (id: string) => tiles.find((t) => t.id === id)!;

function game(structures: PlayerState['structures'], bonus?: string): GameState {
  const state = newGame({ ...testSetup, structureBonuses: tiles });
  return { ...state, structureBonus: bonus, players: [{ ...state.players[0]!, structures }, state.players[1]!] };
}
const count = (structures: PlayerState['structures'], id: string) => structureBonusCount(game(structures), 0, tile(id));

describe('setting up', () => {
  it('draws one tile at random, without changing the other decks', () => {
    const state = newGame({ ...testSetup, structureBonuses: tiles });
    expect(tiles.map((t) => t.id)).toContain(state.structureBonus);
    expect(state.combatDeck).toEqual(newGame(testSetup).combatDeck);
  });

  it('has none in a game without tiles (games saved before them)', () => {
    expect(newGame(testSetup).structureBonus).toBeUndefined();
  });
});

describe('what a tile counts', () => {
  it('tunnels, lakes or encounter hexes next to your structures, each hex once', () => {
    expect(count({ mill: 'A3' }, 't-tunnels')).toBe(1);
    expect(count({ mill: 'A2' }, 't-tunnels')).toBe(0);
    expect(count({ mill: 'A2', armory: 'A1' }, 't-lakes')).toBe(1);
    expect(count({ mill: 'A2' }, 't-encounters')).toBe(1);
  });

  it('your structures on tunnels, or on given terrains', () => {
    expect(count({ mine: 'A4', mill: 'A2' }, 't-on-tunnels')).toBe(1);
    expect(count({ mine: 'A4', mill: 'A1', armory: 'A2' }, 't-on-land')).toBe(2);
  });

  it('your longest straight row of structures, side by side', () => {
    expect(count({}, 't-row')).toBe(0);
    expect(count({ mill: 'A1', armory: 'A3' }, 't-row')).toBe(1);
    expect(count({ mill: 'A1', armory: 'A2', mine: 'A3' }, 't-row')).toBe(3);
  });
});

describe('scoring the tile', () => {
  it('pays the coins for the highest step reached', () => {
    expect(structureBonusCoins(tile('t-row'), 0)).toBe(0);
    expect(structureBonusCoins(tile('t-row'), 2)).toBe(2);
    expect(structureBonusCoins(tile('t-row'), 4)).toBe(5);
  });

  it('adds to the final score, whatever your popularity', () => {
    const state = game({ mill: 'A1', armory: 'A2', mine: 'A3' }, 't-row');
    const [mine, theirs] = score(state);
    expect(mine!.structureBonus).toEqual({ count: 3, coins: 5 });
    expect(theirs!.structureBonus).toEqual({ count: 0, coins: 0 });
    const without = score({ ...state, structureBonus: undefined })[0]!;
    expect(without.structureBonus).toEqual({ count: 0, coins: 0 });
    expect(mine!.total - without.total).toBe(5);
  });
});

describe('checking a tile', () => {
  it('is fine when complete', () => {
    for (const t of tiles) expect(validateStructureBonus(t)).toEqual([]);
  });

  it('names what is missing or wrong', () => {
    expect(validateStructureBonus({ id: '', name: '', count: { kind: 'on' }, pays: [] })).toEqual([
      'name is missing',
      'ID is missing',
      'it must count structures on tunnels or on some terrain',
      'it needs at least one payout',
    ]);
    const odd = { id: 'x', name: 'X', count: { kind: 'adjacent', feature: 'river' }, pays: [{ atLeast: 2, coins: 3 }, { atLeast: 2, coins: -1 }] } as unknown as StructureBonusTile;
    expect(validateStructureBonus(odd)).toEqual(['it counts something unknown', 'payouts must be whole numbers of 0 or more, each step higher than the last']);
  });
});
