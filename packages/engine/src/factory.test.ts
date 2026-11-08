// Scenario tests for the Factory, on the small test board (see test-fixtures.ts):
// B3 is the Factory, next to A2, A3, B4, C2 and C3. Player 0 uses mat A
// (section 2 is Move, 2 units; section 0's bottom row is Upgrade); player 1 mat B.
import { describe, expect, it } from 'vitest';
import { activeSeat, applyAction, legalActions, newGame, type Action, type GameState, type PlayerState } from './game';
import { FACTORY, validateFactoryCard, type FactoryCard } from './factory';
import type { AbilityRule } from './faction';
import { factionA, testSetup } from './test-fixtures';

const play = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);

const cards: FactoryCard[] = [
  { id: 'f1', name: 'One', cost: { power: 1 }, gain: { coins: 2 }, move: { units: 1, hexes: 2 } },
  { id: 'f2', name: 'Two', cost: { resources: { oil: 1, metal: 1 } }, gain: { combatCards: 1, actions: ['upgrade'] }, move: { units: 2, hexes: 1 } },
  { id: 'f3', name: 'Three', cost: { popularity: 1 }, gain: { power: 2 }, move: { units: 1, hexes: 1 } },
  { id: 'f4', name: 'Four', cost: { coins: 1 }, gain: { popularity: 1 }, move: { units: 1, hexes: 1 } },
  { id: 'f5', name: 'Five', cost: { coins: 1 }, gain: { produce: 2 }, move: { units: 1, hexes: 1 } },
  { id: 'f6', name: 'Six', cost: { coins: 1 }, gain: { produce: 1, actions: ['upgrade'] }, move: { units: 1, hexes: 1 } },
  { id: 'f7', name: 'Seven', cost: { popularity: 1 }, gain: { oneOf: true, coins: 2, actions: ['upgrade', 'deploy'] }, move: { units: 1, hexes: 1 } },
  { id: 'f8', name: 'Eight', cost: { combatCards: 1 }, gain: { coins: 3 }, move: { units: 1, hexes: 1 } },
  { id: 'f9', name: 'Nine', cost: { combatCards: 1 }, gain: { anyResources: 3 }, move: { units: 1, hexes: 1 } },
];
const ALL = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9'];

function game(p0: Partial<PlayerState> = {}, p1: Partial<PlayerState> = {}, opts: { rule?: AbilityRule; resources?: GameState['resources'] } = {}): GameState {
  const setup = {
    ...testSetup,
    factory: cards,
    players: [{ ...testSetup.players[0]!, faction: { ...factionA, ability: { ...factionA.ability, rule: opts.rule } } }, testSetup.players[1]!],
  };
  const state = newGame(setup);
  return {
    ...state,
    factoryDeck: cards.map((c) => c.id),
    resources: opts.resources ?? {},
    players: [{ ...state.players[0]!, ...p0 }, { ...state.players[1]!, ...p1 }],
  };
}

const choose = (section: number): Action => ({ type: 'chooseSection', section });
const character = { kind: 'character' as const };
const worker = (index: number) => ({ kind: 'worker' as const, index });
const move = (unit: object, to: string) => ({ type: 'moveUnit', unit, to }) as Action;
const endMove: Action = { type: 'endMove' };
const use: Action = { type: 'factoryUse' };
const skip: Action = { type: 'skipTop' };
const types = (state: GameState) => [...new Set(legalActions(state, activeSeat(state)).map((a) => a.type))].sort();

/** Player 0's character moves from A2 onto the Factory. */
const arrive = (p0: Partial<PlayerState> = {}, p1: Partial<PlayerState> = {}) =>
  play(game({ character: 'A2', workers: ['A1'], ...p0 }, p1), choose(2), move(character, 'B3'), endMove);

/** Player 0 holding a Factory card, at the start of their turn. */
const holding = (card: string, p0: Partial<PlayerState> = {}, opts: { rule?: AbilityRule; resources?: GameState['resources'] } = {}) =>
  game({ factoryCard: card, ...p0 }, {}, opts);

describe('setting up the Factory', () => {
  it('shuffles the Factory cards, without changing the combat deck', () => {
    const state = newGame({ ...testSetup, factory: cards });
    expect([...state.factoryDeck].sort()).toEqual(ALL);
    expect(state.combatDeck).toEqual(newGame(testSetup).combatDeck);
  });

  it('has no Factory cards in a game without them (games saved before the Factory)', () => {
    const state = newGame(testSetup);
    expect(state.factoryDeck).toEqual([]);
    const moved = play({ ...state, players: [{ ...state.players[0]!, character: 'A2' }, state.players[1]!] }, choose(2), move(character, 'B3'), endMove);
    expect(moved.turn.step).toBe('bottom');
  });
});

describe('taking a Factory card', () => {
  it('offers one card more than there are players when the character ends its move on the Factory', () => {
    const state = arrive();
    expect(state.turn).toMatchObject({ step: 'factoryCard', offered: ['f1', 'f2', 'f3'] });
    expect(legalActions(state, 0)).toEqual(['f1', 'f2', 'f3'].map((card) => ({ type: 'takeFactoryCard', card })));
  });

  it('keeps the one picked; the others go back under the deck', () => {
    const state = play(arrive(), { type: 'takeFactoryCard', card: 'f2' });
    expect(state.players[0]!.factoryCard).toBe('f2');
    expect(state.factoryDeck).toEqual(['f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f1', 'f3']);
    expect(state.turn).toMatchObject({ step: 'bottom', section: 2 });
  });

  it('only once a game', () => {
    expect(arrive({ factoryCard: 'f4' }).turn.step).toBe('bottom');
  });

  it("doesn't stop the character's move there", () => {
    const state = play(game({ character: 'A2' }, {}, { rule: { kind: 'speed', extra: 1 } }), choose(2), move(character, 'B3'));
    expect(state.turn).toMatchObject({ walking: { unit: character } });
    // Moving on past the Factory: no card.
    expect(play(state, move(character, 'B4'), endMove).turn.step).toBe('bottom');
  });

  it('not after losing a fight there', () => {
    const fight = arrive({ power: 0, combatCards: [] }, { character: 'B3', power: 3, combatCards: [] });
    expect(play(fight, { type: 'combatPower', power: 3 }).turn.step).toBe('bottom');
  });
});

describe('the Factory card as a fifth section', () => {
  it('can be picked once you have it, but not twice in a row', () => {
    expect(legalActions(game(), 0)).not.toContainEqual(choose(FACTORY));
    expect(legalActions(holding('f1'), 0)).toContainEqual(choose(FACTORY));
    expect(legalActions(holding('f1', { lastSection: FACTORY }), 0)).not.toContainEqual(choose(FACTORY));
  });

  it('top: pays the cost for the reward, then on to its move', () => {
    const state = play(holding('f1', { power: 3, coins: 0 }), choose(FACTORY), use);
    expect(state.players[0]).toMatchObject({ power: 2, coins: 2 });
    expect(state.turn).toMatchObject({ step: 'top', section: FACTORY });
  });

  it("can't use the top without paying for it, but can skip it", () => {
    const state = play(holding('f3', { popularity: 0 }), choose(FACTORY));
    expect(types(state)).toEqual(['skipTop']);
    expect(play(state, skip).turn).toMatchObject({ step: 'top', section: FACTORY });
  });

  it('pays resources from hexes you control, one at a time, before the reward', () => {
    const resources = { A1: { oil: 1 }, A2: { metal: 2 } };
    let state = play(holding('f2', { workers: ['A1', 'A2'] }, { resources }), choose(FACTORY));
    expect(legalActions(state, 0)).toEqual([
      { type: 'factoryPay', hex: 'A1', resource: 'oil' },
      { type: 'factoryPay', hex: 'A2', resource: 'metal' },
      skip,
    ]);
    state = play(state, { type: 'factoryPay', hex: 'A1', resource: 'oil' });
    expect(legalActions(state, 0)).toEqual([{ type: 'factoryPay', hex: 'A2', resource: 'metal' }]);
    state = play(state, { type: 'factoryPay', hex: 'A2', resource: 'metal' });
    expect(legalActions(state, 0)).toEqual([use]);
    expect(state.resources).toEqual({ A2: { metal: 1 } });
  });

  it("can't start paying for what it can't finish", () => {
    const state = play(holding('f2', { workers: ['A1'] }, { resources: { A1: { oil: 1 } } }), choose(FACTORY));
    expect(types(state)).toEqual(['skipTop']);
  });

  it('Coercion: a combat card can stand in for one resource', () => {
    const coercion: AbilityRule = { kind: 'cardAsResource' };
    const state = play(holding('f2', { workers: ['A1'], combatCards: [3] }, { rule: coercion, resources: { A1: { oil: 1 } } }), choose(FACTORY));
    expect(legalActions(state, 0)).toContainEqual({ type: 'payWithCard', value: 3 });
    const paid = play(state, { type: 'payWithCard', value: 3 }, { type: 'factoryPay', hex: 'A1', resource: 'oil' });
    expect(legalActions(paid, 0)).toEqual([use]);
    expect(paid.players[0]!.combatCards).toEqual([]);
  });

  it('gives free bottom-row actions with no coins, then the move', () => {
    const resources = { A1: { oil: 1, metal: 1 } };
    let state = play(holding('f2', { workers: ['A1'], coins: 0 }, { resources }), choose(FACTORY));
    state = play(state, { type: 'factoryPay', hex: 'A1', resource: 'oil' }, { type: 'factoryPay', hex: 'A1', resource: 'metal' }, use);
    expect(types(state)).toEqual(['upgrade']);
    state = play(state, legalActions(state, 0)[0]!);
    expect(state.players[0]!.upgrades.top).toHaveLength(1);
    expect(state.players[0]!.coins).toBe(0);
    expect(state.turn).toMatchObject({ step: 'top', section: FACTORY });
  });

  it('produces on up to so many hexes with your workers, then the move', () => {
    // A1 farm, A2 forest, A4 tundra (oil); the mill on B4 has no worker there, so it isn't offered.
    let state = play(holding('f5', { workers: ['A1', 'A2', 'A4', 'A4'], structures: { mill: 'B4' }, power: 0 }), choose(FACTORY), use);
    expect(state.turn).toMatchObject({ step: 'factoryProduce', section: FACTORY, left: 2 });
    expect(legalActions(state, 0)).toEqual([
      { type: 'produce', hex: 'A1' },
      { type: 'produce', hex: 'A2' },
      { type: 'produce', hex: 'A4' },
      { type: 'endProduce' },
    ]);
    state = play(state, { type: 'produce', hex: 'A4' });
    expect(legalActions(state, 0)).toEqual([{ type: 'produce', hex: 'A1' }, { type: 'produce', hex: 'A2' }, { type: 'endProduce' }]);
    state = play(state, { type: 'produce', hex: 'A2' });
    // Two hexes: done, on to the move. The usual Produce cost (power with 4 workers) isn't paid: the card's cost is.
    expect(state.resources).toEqual({ A4: { oil: 2 }, A2: { wood: 1 } });
    expect(state.players[0]).toMatchObject({ power: 0 });
    expect(state.turn).toMatchObject({ step: 'top', section: FACTORY });
  });

  it('can stop producing early, and skips it with no workers on the map', () => {
    let state = play(holding('f5', { workers: ['A1'] }), choose(FACTORY), use, { type: 'endProduce' });
    expect(state.resources).toEqual({});
    expect(state.turn).toMatchObject({ step: 'top', section: FACTORY });
    state = play(holding('f5', { workers: ['home'] }), choose(FACTORY), use);
    expect(state.turn).toMatchObject({ step: 'top', section: FACTORY });
  });

  it('produces before any free bottom-row actions', () => {
    let state = play(holding('f6', { workers: ['A1'] }), choose(FACTORY), use);
    expect(state.turn).toMatchObject({ step: 'factoryProduce', left: 1 });
    state = play(state, { type: 'produce', hex: 'A1' });
    expect(state.resources).toEqual({ A1: { food: 1 } });
    expect(types(state)).toEqual(['upgrade']);
  });

  it('"or": pays, then gives just one of its rewards, the player choosing', () => {
    let state = play(holding('f7', { popularity: 2, coins: 0 }), choose(FACTORY), use);
    expect(state.players[0]!.popularity).toBe(1);
    expect(state.turn).toMatchObject({ step: 'factoryChoice', section: FACTORY });
    // Coins, a free Upgrade, a free Deploy: one each.
    expect(legalActions(state, 0)).toEqual([0, 1, 2].map((option) => ({ type: 'factoryChoose', option })));
    const coins = play(state, { type: 'factoryChoose', option: 0 });
    expect(coins.players[0]!.coins).toBe(2);
    expect(coins.turn).toMatchObject({ step: 'top', section: FACTORY });
    state = play(state, { type: 'factoryChoose', option: 2 });
    expect(types(state)).toEqual(['deploy']);
    expect(state.players[0]!.coins).toBe(0);
  });

  it('"or": a reward with nothing to do for it isn\'t offered', () => {
    // All four mechs out: no Deploy to choose.
    const state = play(holding('f7', { popularity: 2, mechs: ['A1', 'A1', 'A1', 'A1'], mechAbilities: [0, 1, 2, 3] }), choose(FACTORY), use);
    expect(legalActions(state, 0)).toEqual([0, 1].map((option) => ({ type: 'factoryChoose', option })));
  });

  it('pays combat cards of your choice from your hand', () => {
    let state = play(holding('f8', { combatCards: [2, 5, 5], coins: 0 }), choose(FACTORY));
    expect(legalActions(state, 0)).toEqual([{ type: 'factoryPayCard', value: 2 }, { type: 'factoryPayCard', value: 5 }, skip]);
    state = play(state, { type: 'factoryPayCard', value: 5 });
    expect(state.players[0]!.combatCards).toEqual([2, 5]);
    expect(state.combatDiscard).toContain(5);
    expect(legalActions(state, 0)).toEqual([use]);
    expect(play(state, use).players[0]!.coins).toBe(3);
  });

  it("can't pay combat cards you don't have", () => {
    const state = play(holding('f8', { combatCards: [] }), choose(FACTORY));
    expect(types(state)).toEqual(['skipTop']);
  });

  it('puts resources of your choice on one hex you control: the hex first, then each resource', () => {
    let state = play(holding('f9', { combatCards: [3], workers: ['A1', 'A2'] }), choose(FACTORY), { type: 'factoryPayCard', value: 3 }, use);
    expect(state.turn).toMatchObject({ step: 'factoryResources', left: 3 });
    expect(legalActions(state, 0)).toEqual([{ type: 'factoryResourceHex', hex: 'A1' }, { type: 'factoryResourceHex', hex: 'A2' }]);
    state = play(state, { type: 'factoryResourceHex', hex: 'A2' });
    expect(legalActions(state, 0)).toEqual(['oil', 'metal', 'wood', 'food'].map((resource) => ({ type: 'factoryResource', resource })));
    state = play(state, { type: 'factoryResource', resource: 'oil' }, { type: 'factoryResource', resource: 'oil' }, { type: 'factoryResource', resource: 'food' });
    expect(state.resources).toEqual({ A2: { oil: 2, food: 1 } });
    expect(state.turn).toMatchObject({ step: 'top', section: FACTORY });
  });

  it("bottom: moves as many units as the card says, as far as it says, with no coins instead", () => {
    // f1: one unit, up to two hexes.
    let state = play(holding('f1', { workers: ['A1', 'C4'], power: 0 }), choose(FACTORY), skip);
    expect(types(state)).toEqual(['moveUnit', 'skipTop']);
    state = play(state, move(worker(0), 'A2'));
    expect(state.turn).toMatchObject({ step: 'moving', walking: { unit: worker(0), left: 1 } });
    state = play(state, move(worker(0), 'A3'));
    // One unit only: the move is over, and there's no bottom row: just End turn.
    expect(state.turn).toMatchObject({ step: 'end', section: FACTORY });
    expect(state.players[0]!.workers).toEqual(['A3', 'C4']);
    state = play(state, { type: 'endTurn' });
    expect(state.players[0]!.lastSection).toBe(FACTORY);
  });

  it('skipping the move ends the turn', () => {
    const state = play(holding('f1', { power: 0 }), choose(FACTORY), skip, skip);
    expect(state.turn).toMatchObject({ step: 'end', section: FACTORY });
  });
});

describe('checking a Factory card', () => {
  it('is fine when complete', () => {
    for (const c of cards) expect(validateFactoryCard(c)).toEqual([]);
  });

  it('names what is missing or wrong', () => {
    const blank: FactoryCard = { id: '', name: ' ', cost: {}, gain: {}, move: { units: 0, hexes: 1.5 } };
    expect(validateFactoryCard(blank)).toEqual(['name is missing', 'ID is missing', 'its move must be at least 1 unit, at least 1 hex']);
    const odd = { ...cards[1]!, cost: { coins: -1, resources: { gold: 1 } }, gain: { actions: ['fly'] } } as unknown as FactoryCard;
    expect(validateFactoryCard(odd)).toEqual(['its cost must be whole numbers of 0 or more', 'its cost has an unknown resource', 'it gives an unknown action']);
  });

  it('checks the new parts: combat cards paid, resources of your choice, "or"', () => {
    for (const c of cards) expect(validateFactoryCard(c), c.id).toEqual([]);
    expect(validateFactoryCard({ ...cards[7]!, cost: { combatCards: -1 } })).toEqual(['its cost must be whole numbers of 0 or more']);
    expect(validateFactoryCard({ ...cards[8]!, gain: { anyResources: 0.5 } })).toEqual(['its rewards must be whole numbers of 0 or more']);
    expect(validateFactoryCard({ ...cards[6]!, gain: { oneOf: true, coins: 2 } })).toEqual(['"one of" needs at least two rewards to choose from']);
  });

  it('produce must be a whole number of hexes', () => {
    expect(validateFactoryCard(cards[4]!)).toEqual([]);
    expect(validateFactoryCard({ ...cards[4]!, gain: { produce: 1.5 } })).toEqual(['its rewards must be whole numbers of 0 or more']);
  });
});
