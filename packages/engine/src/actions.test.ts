// Scenario tests for the eight top- and bottom-row actions, on the small
// test board (see test-fixtures.ts). Player 0 uses mat A:
//   0 bolster / upgrade (3 oil)   1 produce / deploy (3 metal)
//   2 move / build (3 wood)       3 trade / enlist (4 food)
import { describe, expect, it } from 'vitest';
import { applyAction, legalActions, newGame, type Action, type GameState, type PlayerState, type ResourcePile } from './game';
import { bottomCost, topValue } from './state';
import { testMatA, testSetup } from './test-fixtures';

const play = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);

/** A new game with player `seat` changed, and resources placed on hexes. */
function game(patch: Partial<PlayerState> = {}, resources: Record<string, ResourcePile> = {}, seat = 0): GameState {
  const state = newGame(testSetup);
  return { ...state, players: state.players.map((p, i) => (i === seat ? { ...p, ...patch } : p)), resources };
}

const choose = (section: number): Action => ({ type: 'chooseSection', section });
const p0 = (state: GameState) => state.players[0]!;
const types = (state: GameState) => legalActions(state, state.currentPlayer).map((a) => a.type);

describe('Move', () => {
  it('can gain coins instead of moving', () => {
    expect(p0(play(game(), choose(2), { type: 'gainCoins' })).coins).toBe(4 + 1);
  });

  it('moves units one hex each, not onto lakes or across rivers', () => {
    const state = play(game(), choose(2));
    const moves = legalActions(state, 0).filter((a) => a.type === 'moveUnit');
    // Character from home to A1 or A2; worker on A1 only to A2 (B1 across a river, B2 a lake);
    // worker on A2 to A1, A3 or the Factory (B3).
    expect(moves).toEqual(
      expect.arrayContaining([
        { type: 'moveUnit', unit: { kind: 'character' }, to: 'A1' },
        { type: 'moveUnit', unit: { kind: 'worker', index: 0 }, to: 'A2' },
        { type: 'moveUnit', unit: { kind: 'worker', index: 1 }, to: 'B3' },
      ]),
    );
    expect(moves).toHaveLength(2 + 1 + 3);
  });

  it('moves up to 2 units, each once, then goes to the bottom row', () => {
    let state = play(game(), choose(2), { type: 'moveUnit', unit: { kind: 'worker', index: 1 }, to: 'A3' });
    expect(state.turn.step).toBe('moving');
    expect(legalActions(state, 0).some((a) => a.type === 'moveUnit' && a.unit.kind === 'worker' && a.unit.index === 1)).toBe(false);
    state = play(state, { type: 'moveUnit', unit: { kind: 'character' }, to: 'A2' });
    expect(p0(state)).toMatchObject({ character: 'A2', workers: ['A1', 'A3'] });
    expect(state.turn.step).toBe('bottom');
  });

  it('can stop after moving fewer units', () => {
    const state = play(game(), choose(2), { type: 'moveUnit', unit: { kind: 'character' }, to: 'A1' }, { type: 'endMove' });
    expect(state.turn.step).toBe('bottom');
  });

  it("can't move onto another player's units (until combat exists)", () => {
    const state = play(game({ workers: ['A1', 'A2'] }, {}, 0), choose(2));
    const blocked = { ...state, players: [p0(state), { ...state.players[1]!, workers: ['A3'] }] };
    expect(legalActions(blocked, 0)).not.toContainEqual({ type: 'moveUnit', unit: { kind: 'worker', index: 1 }, to: 'A3' });
  });

  it('moves 3 units and gains 2 coins once upgraded', () => {
    const upgraded = game({ upgrades: { top: [{ section: 2, field: 'units' }, { section: 2, field: 'coins' }], bottom: [0, 1] } });
    expect(p0(play(upgraded, choose(2), { type: 'gainCoins' })).coins).toBe(4 + 2);
    expect(topValue(p0(upgraded), testMatA, 2, 'units')).toBe(3);
  });
});

describe('Trade', () => {
  it('pays 1 coin for 2 resources of any kind, both placed on one hex with your worker', () => {
    let state = play(game(), choose(3));
    expect(legalActions(state, 0)).toContainEqual({ type: 'tradeResource', resource: 'oil', hex: 'A1' });
    expect(legalActions(state, 0)).not.toContainEqual({ type: 'tradeResource', resource: 'oil', hex: 'A3' });
    state = play(state, { type: 'tradeResource', resource: 'oil', hex: 'A1' });
    expect(state.turn).toMatchObject({ step: 'trading', left: 1, hex: 'A1' });
    expect(types(state)).not.toContain('skipBottom');
    // The second resource must go on the same hex.
    expect(legalActions(state, 0)).not.toContainEqual({ type: 'tradeResource', resource: 'food', hex: 'A2' });
    state = play(state, { type: 'tradeResource', resource: 'food', hex: 'A1' });
    expect(state.resources).toEqual({ A1: { oil: 1, food: 1 } });
    expect(p0(state).coins).toBe(3);
    expect(state.turn.step).toBe('bottom');
  });

  it('can gain popularity instead', () => {
    expect(p0(play(game(), choose(3), { type: 'tradePopularity' }))).toMatchObject({ coins: 3, popularity: 3 });
  });

  it("can't be taken without the coin", () => {
    expect(types(play(game({ coins: 0 }), choose(3)))).toEqual(['skipTop']);
  });

  it('gives 1 power with the armory built', () => {
    const state = game({ structures: { armory: 'A1' } });
    expect(p0(play(state, choose(3), { type: 'tradePopularity' })).power).toBe(3 + 1);
    const traded = play(state, choose(3), { type: 'tradeResource', resource: 'oil', hex: 'A1' }, { type: 'tradeResource', resource: 'oil', hex: 'A1' });
    expect(p0(traded).power).toBe(3 + 1);
    expect(traded.resources).toEqual({ A1: { oil: 2 } });
  });

  it('caps popularity at 18', () => {
    expect(p0(play(game({ popularity: 18 }), choose(3), { type: 'tradePopularity' })).popularity).toBe(18);
  });
});

describe('Produce', () => {
  it('produces one resource per worker on up to 2 hexes', () => {
    const state = play(game({ workers: ['A1', 'A2', 'A2', 'A3'] }), choose(1), { type: 'produce', hex: 'A2' }, { type: 'produce', hex: 'A1' });
    expect(state.resources).toEqual({ A1: { food: 1 }, A2: { wood: 2 } });
    expect(state.turn.step).toBe('bottom');
  });

  it("doesn't produce on the same hex twice, and can stop early", () => {
    let state = play(game(), choose(1), { type: 'produce', hex: 'A1' });
    expect(legalActions(state, 0)).toEqual([{ type: 'produce', hex: 'A2' }, { type: 'endProduce' }]);
    state = play(state, { type: 'endProduce' });
    expect(state.resources).toEqual({ A1: { food: 1 } });
  });

  it('makes new workers on a village, up to 8 in all', () => {
    let state = play(game({ workers: ['B1', 'B1'] }), choose(1), { type: 'produce', hex: 'B1' });
    expect(p0(state).workers).toEqual(['B1', 'B1', 'B1', 'B1']);
    state = play(game({ workers: ['B1', 'B1', 'A1', 'A1', 'A1', 'A1', 'A1'] }), choose(1), { type: 'produce', hex: 'B1' });
    expect(p0(state).workers).toHaveLength(8);
  });

  it('has nothing to produce on the Factory', () => {
    expect(legalActions(play(game({ workers: ['B3'] }), choose(1)), 0)).toEqual([{ type: 'skipTop' }]);
  });
});

describe('Bolster', () => {
  it('pays 1 coin for 2 power or 1 combat card', () => {
    expect(p0(play(game(), choose(0), { type: 'bolster', gain: 'power' }))).toMatchObject({ coins: 3, power: 5 });
    const after = p0(play(game(), choose(0), { type: 'bolster', gain: 'combatCards' }));
    expect(after.coins).toBe(3);
    expect(after.combatCards).toHaveLength(3);
  });

  it('gives 1 popularity with the monument built', () => {
    expect(p0(play(game({ structures: { monument: 'A1' } }), choose(0), { type: 'bolster', gain: 'power' })).popularity).toBe(3);
  });

  it('caps power at 16', () => {
    expect(p0(play(game({ power: 15 }), choose(0), { type: 'bolster', gain: 'power' })).power).toBe(16);
  });

  it("can't be taken without the coin", () => {
    expect(types(play(game({ coins: 0 }), choose(0)))).toEqual(['skipTop']);
  });
});

describe('paying for bottom-row actions', () => {
  const upgradeTurn = (state: GameState) => play(state, choose(0), { type: 'skipTop' });

  it('takes resources one at a time from hexes you control', () => {
    let state = upgradeTurn(game({}, { A1: { oil: 2 }, A2: { oil: 1, food: 3 }, A3: { oil: 5 } }));
    // A3 has no unit of yours, so its oil can't be spent.
    expect(legalActions(state, 0)).toEqual([{ type: 'pay', hex: 'A1' }, { type: 'pay', hex: 'A2' }, { type: 'skipBottom' }]);
    state = play(state, { type: 'pay', hex: 'A1' });
    expect(types(state)).not.toContain('skipBottom');
    state = play(state, { type: 'pay', hex: 'A2' }, { type: 'pay', hex: 'A1' });
    expect(state.resources).toEqual({ A2: { food: 3 }, A3: { oil: 5 } });
    expect(types(state).every((t) => t === 'upgrade')).toBe(true);
  });

  it("can't start unless you can pay it all", () => {
    expect(legalActions(upgradeTurn(game({}, { A1: { oil: 2 } })), 0)).toEqual([{ type: 'skipBottom' }]);
  });

  it('can spend resources on a hex with your structure and no units', () => {
    const state = upgradeTurn(game({ structures: { mine: 'A3' } }, { A3: { oil: 3 } }));
    expect(legalActions(state, 0)).toContainEqual({ type: 'pay', hex: 'A3' });
  });

  it('can be paid just for the coins when there is nothing left to do', () => {
    const state = play(
      game({ mechs: ['A1', 'A1', 'A1', 'A1'], mechAbilities: [0, 1, 2, 3] }, { A1: { metal: 3 } }),
      choose(1), { type: 'skipTop' }, { type: 'pay', hex: 'A1' }, { type: 'pay', hex: 'A1' }, { type: 'pay', hex: 'A1' },
    );
    expect(p0(state).coins).toBe(4 + 2);
    expect(legalActions(state, 0)).toEqual([{ type: 'endTurn' }]);
  });
});

describe('ending the turn', () => {
  it('waits for End turn after a bottom-row action, so it can still be undone', () => {
    const state = play(bottom(1, 'metal'), { type: 'deploy', hex: 'A2', ability: 2 });
    expect(state.currentPlayer).toBe(0);
    expect(state.turn).toEqual({ step: 'end', section: 1 });
    expect(legalActions(state, 0)).toEqual([{ type: 'endTurn' }]);
    const next = play(state, { type: 'endTurn' });
    expect(next.currentPlayer).toBe(1);
    expect(p0(next).lastSection).toBe(1);
    expect(next.turnsTaken).toBe(1);
  });

  it('ends at once when the bottom-row action is skipped', () => {
    expect(play(game(), choose(2), { type: 'gainCoins' }, { type: 'skipBottom' }).currentPlayer).toBe(1);
  });
});

/** Player 0's bottom row action, paid from 4 of the right resource on A1. */
function bottom(section: number, resource: string, patch: Partial<PlayerState> = {}): GameState {
  const cost = bottomCost({ ...p0(game()), ...patch } as PlayerState, testMatA, section as 0);
  const pay = Array.from({ length: cost.amount }, (): Action => ({ type: 'pay', hex: 'A1' }));
  return play(game(patch, { A1: { [resource]: 4 } }), choose(section), { type: 'skipTop' }, ...pay);
}

describe('Upgrade', () => {
  it('moves a cube from a top-row value to a bottom-row cost, and gains coins', () => {
    const state = play(bottom(0, 'oil'), { type: 'upgrade', top: { section: 0, field: 'power' }, bottom: 3 });
    const p = p0(state);
    expect(topValue(p, testMatA, 0, 'power')).toBe(3);
    expect(bottomCost(p, testMatA, 3).amount).toBe(3);
    expect(p.coins).toBe(4 + 3);
  });

  it('offers every top-row value and bottom-row space with room left', () => {
    const offers = legalActions(bottom(0, 'oil', { upgrades: { top: [{ section: 0, field: 'power' }], bottom: [0] } }), 0);
    // 5 top values left (6 minus power) x 3 bottom sections with space (section 0 is full).
    expect(offers).toHaveLength(5 * 3);
  });
});

describe('Deploy', () => {
  it('places a mech on a hex with your worker and unlocks the chosen ability', () => {
    const state = bottom(1, 'metal');
    expect(legalActions(state, 0)).toHaveLength(2 * 4);
    const p = p0(play(state, { type: 'deploy', hex: 'A2', ability: 2 }));
    expect(p).toMatchObject({ mechs: ['A2'], mechAbilities: [2], coins: 4 + 2 });
  });

  it("doesn't offer an ability already unlocked", () => {
    const state = bottom(1, 'metal', { mechs: ['A1'], mechAbilities: [0] });
    expect(legalActions(state, 0).some((a) => a.type === 'deploy' && a.ability === 0)).toBe(false);
  });
});

describe('Build', () => {
  it('places a structure on a hex with your worker, and its bonus applies from then on', () => {
    let state = play(bottom(2, 'wood'), { type: 'build', structure: 'monument', hex: 'A2' });
    expect(p0(state)).toMatchObject({ structures: { monument: 'A2' }, coins: 4 + 1 });
    state = play(state, { type: 'endTurn' }, choose(2), { type: 'skipTop' }, { type: 'skipBottom' }, choose(0), { type: 'bolster', gain: 'power' });
    expect(p0(state).popularity).toBe(3);
  });

  it('not on the Factory, a lake, or a hex that already has a structure', () => {
    const state = bottom(2, 'wood', { workers: ['A1', 'B3', 'A2'], structures: { mill: 'A2' } });
    expect(new Set(legalActions(state, 0).map((a) => (a as { hex: string }).hex))).toEqual(new Set(['A1']));
    // Three structures left to build.
    expect(legalActions(state, 0)).toHaveLength(3);
  });
});

describe('Enlist', () => {
  it('places a recruit on a bottom-row section and gains a one-time bonus', () => {
    const state = bottom(3, 'food');
    expect(legalActions(state, 0)).toHaveLength(4 * 4);
    const p = p0(play(state, { type: 'enlist', section: 1, bonus: 'power' }));
    expect(p).toMatchObject({ recruits: [1], recruitBonusesTaken: ['power'], power: 3 + 2 });
  });

  it('gives the ongoing bonus when you or a neighbor take that bottom-row action', () => {
    // A recruit on mat A's Deploy section pays 1 coin.
    let state = game({ recruits: [1] }, { A1: { metal: 3 }, C2: { metal: 4 } });
    state = play(state, choose(1), { type: 'skipTop' }, { type: 'pay', hex: 'A1' }, { type: 'pay', hex: 'A1' }, { type: 'pay', hex: 'A1' },
      { type: 'deploy', hex: 'A1', ability: 0 }, { type: 'endTurn' });
    expect(p0(state).coins).toBe(4 + 2 + 1);
    // Player 1 deploys (their section 1): player 0 gets 1 more coin.
    const pay: Action = { type: 'pay', hex: 'C2' };
    state = play(state, choose(1), { type: 'skipTop' }, pay, pay, pay, pay, { type: 'deploy', hex: 'C2', ability: 0 });
    expect(p0(state).coins).toBe(4 + 2 + 1 + 1);
  });

  it("doesn't give the ongoing bonus on the Enlist that places the recruit", () => {
    const p = p0(play(bottom(3, 'food'), { type: 'enlist', section: 3, bonus: 'coins' }));
    expect(p.coins).toBe(4 + 2);
    expect(p.combatCards).toHaveLength(2);
  });
});

describe('stars', () => {
  it('earns a star for deploying the fourth mech', () => {
    const before = bottom(1, 'metal', { mechs: ['A1', 'A1', 'A1'], mechAbilities: [0, 1, 2] });
    expect(p0(before).stars).toEqual([]);
    expect(p0(play(before, { type: 'deploy', hex: 'A2', ability: 3 })).stars).toEqual(['mechs']);
  });

  it('earns one for reaching 16 power, only once', () => {
    let state = play(game({ power: 14 }), choose(0), { type: 'bolster', gain: 'power' });
    expect(p0(state).stars).toEqual(['power']);
    // Already earned: bolstering again at 16 adds nothing.
    state = play(game({ power: 16, stars: ['power'] }), choose(0), { type: 'bolster', gain: 'power' });
    expect(p0(state).stars).toEqual(['power']);
  });

  it('earns one for the fourth recruit and one for top popularity, each once', () => {
    const state = bottom(3, 'food', { recruits: [0, 1, 2], recruitBonusesTaken: ['power', 'coins', 'combatCard'], popularity: 16 });
    expect(p0(play(state, { type: 'enlist', section: 3, bonus: 'popularity' })).stars).toEqual(['recruits', 'popularity']);
  });

  it("earns stars on other players' turns too, as soon as they're reached", () => {
    // Player 1's recruit on Upgrade pays them 1 power when their neighbor upgrades: 15 -> 16.
    let state = bottom(0, 'oil');
    state = { ...state, players: [p0(state), { ...state.players[1]!, recruits: [0], power: 15 }] };
    state = play(state, { type: 'upgrade', top: { section: 0, field: 'power' }, bottom: 0 });
    expect(state.players.map((p) => p.stars)).toEqual([[], ['power']]);
  });
});
