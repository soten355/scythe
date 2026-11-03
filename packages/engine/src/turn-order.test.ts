// Turn order: the player whose mat has the lowest number goes first, then
// play goes clockwise around the map, by where each faction's home base is.
// Neighbors (for recruit bonuses) are the players just before and after in
// that order. Games saved before this rule keep the order of their seats.
import { describe, expect, it } from 'vitest';
import { buildBoard } from './board';
import { newGame, type GameSetup } from './game';
import { neighborSeats, playOrder } from './state';
import { endTurn } from './state';
import { factionA, testMatA } from './test-fixtures';

//        @n
//   A1  A2  A3
// @w  B1  B2  B3  @e
//   C1  C2  C3
//        @s
const board = buildBoard({
  rows: ['--  @n', 'Fa  Fo  Mo', '@w  Vi  Fa  Tu  @e', 'Fo  Tu  Fa', '--  @s'],
  rivers: [],
  homeBases: { n: ['A1', 'A2'], w: ['B1'], e: ['B3'], s: ['C1', 'C2'] },
});
const faction = (home: string) => ({ ...factionA, id: home, name: home, homeBase: home });
const mat = (n: number) => ({ ...testMatA, id: `mat-${n}`, name: `Mat ${n}`, turnOrder: n });

/** Seats listed west, north, south, east, with mats 3, 2, 4, 1: east has the lowest mat. */
const setup = (turnOrder?: 'map'): GameSetup => ({
  seed: 1,
  board,
  players: [
    { faction: faction('w'), mat: mat(3) },
    { faction: faction('n'), mat: mat(2) },
    { faction: faction('s'), mat: mat(4) },
    { faction: faction('e'), mat: mat(1) },
  ],
  ...(turnOrder && { turnOrder }),
});

const homes = (s: GameSetup, seats: number[]) => seats.map((i) => s.players[i]!.faction.homeBase);

describe('turn order', () => {
  it('goes clockwise around the map, by home base', () => {
    const order = homes(setup('map'), playOrder(setup('map')));
    // Where the list starts doesn't matter (the lowest mat starts): read it from north.
    const n = order.indexOf('n');
    expect([...order.slice(n), ...order.slice(0, n)]).toEqual(['n', 'e', 's', 'w']);
  });

  it('starts with the lowest mat number, then goes clockwise from there', () => {
    let state = newGame(setup('map'));
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      seen.push(state.setup.players[state.currentPlayer]!.faction.homeBase);
      state = endTurn(state);
    }
    expect(seen).toEqual(['e', 's', 'w', 'n', 'e']);
  });

  it('counts as neighbors the players just before and after in that order', () => {
    const s = setup('map');
    const seatOf = (home: string) => s.players.findIndex((p) => p.faction.homeBase === home);
    expect(homes(s, neighborSeats(newGame(s), seatOf('n'))).sort()).toEqual(['e', 'w']);
    expect(homes(s, neighborSeats(newGame(s), seatOf('s'))).sort()).toEqual(['e', 'w']);
  });

  it('keeps the order of the seats in games saved before (no turn order in the setup)', () => {
    expect(playOrder(setup())).toEqual([0, 1, 2, 3]);
    let state = newGame(setup());
    expect(state.currentPlayer).toBe(3);
    state = endTurn(state);
    expect(state.currentPlayer).toBe(0);
  });
});
