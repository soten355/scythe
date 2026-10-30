// Scenario tests for movement and production details, on the small test
// board (see test-fixtures.ts). A4 and C1 are tunnels; a river runs A1|B1.
// Player 0 uses mat A: section 1 is Produce (2 hexes), section 2 is Move (2 units).
import { describe, expect, it } from 'vitest';
import { applyAction, legalActions, newGame, type Action, type GameState, type PlayerState, type ResourcePile } from './game';
import { produceCost } from './top-actions';
import { testSetup } from './test-fixtures';

const play = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);

function game(patch: Partial<PlayerState> = {}, resources: Record<string, ResourcePile> = {}, other: Partial<PlayerState> = {}): GameState {
  const state = newGame(testSetup);
  return { ...state, players: [{ ...state.players[0]!, ...patch }, { ...state.players[1]!, ...other }], resources };
}

const choose = (section: number): Action => ({ type: 'chooseSection', section });
const p0 = (state: GameState) => state.players[0]!;
const worker = (index: number) => ({ kind: 'worker' as const, index });
const mech = (index: number) => ({ kind: 'mech' as const, index });
const destinations = (state: GameState, unit: object) =>
  legalActions(state, 0)
    .filter((a) => a.type === 'moveUnit' && JSON.stringify(a.unit) === JSON.stringify(unit))
    .map((a) => (a as { to: string }).to)
    .sort();

describe('tunnels and the mine', () => {
  it('lets a unit on a tunnel move to any other tunnel', () => {
    const state = play(game({ workers: ['A4', 'A2'] }), choose(2));
    expect(destinations(state, worker(0))).toEqual(['A3', 'B4', 'C1']);
  });

  it('treats your mine as a tunnel, for your units only', () => {
    const state = play(game({ workers: ['A4', 'A2'], structures: { mine: 'A2' } }), choose(2));
    expect(destinations(state, worker(1))).toEqual(['A1', 'A3', 'A4', 'B3', 'C1']);
    expect(destinations(state, worker(0))).toContain('A2');
    // Player 1's mine on C4 does nothing for player 0.
    const theirs = play(game({ workers: ['A4', 'A2'] }, {}, { structures: { mine: 'C4' } }), choose(2));
    expect(destinations(theirs, worker(0))).not.toContain('C4');
  });

  it("can't tunnel onto another player's units", () => {
    const state = play(game({ workers: ['A4', 'A2'] }, {}, { workers: ['C1', 'C2'] }), choose(2));
    expect(destinations(state, worker(0))).toEqual(['A3', 'B4']);
  });
});

describe('carrying', () => {
  it('lets a unit pick up resources from its hex and take them along', () => {
    let state = play(game({}, { A1: { food: 3, wood: 1 } }), choose(2));
    state = play(state, { type: 'carryResource', unit: worker(0), resource: 'food' }, { type: 'carryResource', unit: worker(0), resource: 'food' });
    // While loading, only that unit can load more or move.
    expect(legalActions(state, 0)).toEqual([
      { type: 'carryResource', unit: worker(0), resource: 'wood' },
      { type: 'carryResource', unit: worker(0), resource: 'food' },
      { type: 'moveUnit', unit: worker(0), to: 'A2' },
    ]);
    state = play(state, { type: 'moveUnit', unit: worker(0), to: 'A2' });
    expect(state.resources).toEqual({ A1: { food: 1, wood: 1 }, A2: { food: 2 } });
    expect(state.turn).toMatchObject({ step: 'moving', moved: [worker(0)] });
  });

  it("can't pick up more than is there", () => {
    const state = play(game({}, { A1: { food: 1 } }), choose(2), { type: 'carryResource', unit: worker(0), resource: 'food' });
    expect(legalActions(state, 0).filter((a) => a.type === 'carryResource')).toEqual([]);
  });

  it('lets a mech carry workers from its hex; they move with it and can still move themselves', () => {
    let state = play(game({ mechs: ['A2'], workers: ['A1', 'A2', 'A2'] }), choose(2));
    expect(legalActions(state, 0).filter((a) => a.type === 'carryWorker')).toEqual([
      { type: 'carryWorker', unit: mech(0), worker: 1 },
      { type: 'carryWorker', unit: mech(0), worker: 2 },
    ]);
    state = play(state, { type: 'carryWorker', unit: mech(0), worker: 1 }, { type: 'carryWorker', unit: mech(0), worker: 2 },
      { type: 'moveUnit', unit: mech(0), to: 'A3' });
    expect(p0(state)).toMatchObject({ mechs: ['A3'], workers: ['A1', 'A3', 'A3'] });
    expect(destinations(state, worker(1))).toEqual(['A2', 'A4', 'B3', 'B4']);
  });

  it('only mechs carry workers, and nothing is carried from home', () => {
    const state = play(game({ character: 'A2' }, { A2: { oil: 1 } }), choose(2));
    const carries = legalActions(state, 0).filter((a) => a.type === 'carryWorker' || a.type === 'carryResource');
    expect(carries).toEqual([
      { type: 'carryResource', unit: { kind: 'character' }, resource: 'oil' },
      { type: 'carryResource', unit: worker(1), resource: 'oil' },
    ]);
  });
});

describe('the mill', () => {
  it('produces as one more worker on its hex', () => {
    const state = play(game({ structures: { mill: 'A1' } }), choose(1), { type: 'produce', hex: 'A1' });
    expect(state.resources).toEqual({ A1: { food: 2 } });
  });

  it('produces on its hex even with no workers there', () => {
    const state = play(game({ structures: { mill: 'A3' } }), choose(1), { type: 'produce', hex: 'A3' });
    expect(state.resources).toEqual({ A3: { metal: 1 } });
  });

  it('makes one more worker on a village', () => {
    const state = play(game({ workers: ['B1', 'A2'], structures: { mill: 'B1' } }), choose(1), { type: 'produce', hex: 'B1' });
    expect(p0(state).workers).toEqual(['B1', 'A2', 'B1', 'B1']);
  });

  it("doesn't produce while another player's unit stands on it", () => {
    const state = play(game({ structures: { mill: 'A3' } }, {}, { workers: ['A3', 'C2'] }), choose(1));
    expect(legalActions(state, 0)).not.toContainEqual({ type: 'produce', hex: 'A3' });
  });
});

describe('the cost of producing', () => {
  const workers = (n: number) => Array<string>(n).fill('A1');

  it('rises with workers on the board: power at 4, popularity at 6, a coin at 8', () => {
    const cost = (n: number) => produceCost({ ...p0(game()), workers: workers(n) });
    expect([2, 3, 4, 5, 6, 7, 8].map(cost)).toEqual([
      ...[2, 3].map(() => ({ power: 0, popularity: 0, coins: 0 })),
      ...[4, 5].map(() => ({ power: 1, popularity: 0, coins: 0 })),
      ...[6, 7].map(() => ({ power: 1, popularity: 1, coins: 0 })),
      { power: 1, popularity: 1, coins: 1 },
    ]);
  });

  it('is paid once per Produce action, not per hex', () => {
    const state = play(game({ workers: ['A1', 'A1', 'A2', 'A2', 'A2', 'A2'] }), choose(1),
      { type: 'produce', hex: 'A1' }, { type: 'produce', hex: 'A2' });
    expect(p0(state)).toMatchObject({ power: 3 - 1, popularity: 2 - 1, coins: 4 });
    expect(state.resources).toEqual({ A1: { food: 2 }, A2: { wood: 4 } });
  });

  it("can't produce without paying it", () => {
    const state = play(game({ workers: workers(4), power: 0 }), choose(1));
    expect(legalActions(state, 0)).toEqual([{ type: 'skipTop' }]);
  });
});
