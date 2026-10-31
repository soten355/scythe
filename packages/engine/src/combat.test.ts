// Scenario tests for combat, on the small test board (see test-fixtures.ts).
// Player 0 uses mat A (section 2 is Move, 2 units); player 1 uses mat B.
// A2 borders A1, A3, B3 (and the lake B2); B3 borders A2, A3, B4, C2, C3.
import { describe, expect, it } from 'vitest';
import { activeSeat, applyAction, legalActions, newGame, type Action, type GameState, type PlayerState } from './game';
import { COMBAT_DECK } from './combat';
import { testSetup } from './test-fixtures';

const play = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);

function game(p0: Partial<PlayerState> = {}, p1: Partial<PlayerState> = {}): GameState {
  const state = newGame(testSetup);
  return { ...state, players: [{ ...state.players[0]!, ...p0 }, { ...state.players[1]!, ...p1 }] };
}

const choose = (section: number): Action => ({ type: 'chooseSection', section });
const character = { kind: 'character' as const };
const mech = (index: number) => ({ kind: 'mech' as const, index });
const worker = (index: number) => ({ kind: 'worker' as const, index });
const move = (unit: object, to: string) => ({ type: 'moveUnit', unit, to }) as Action;
const card = (value: number): Action => ({ type: 'combatCard', value });
const dial = (power: number): Action => ({ type: 'combatPower', power });
const endMove: Action = { type: 'endMove' };

/** Player 0's character on A2 about to attack player 1's character (and a worker) on B3. */
const standoff = (p0: Partial<PlayerState> = {}, p1: Partial<PlayerState> = {}) =>
  play(
    game(
      { character: 'A2', workers: ['A1'], power: 5, combatCards: [2, 5], ...p0 },
      { character: 'B3', workers: ['B3', 'C2'], power: 4, combatCards: [3], ...p1 },
    ),
    choose(2),
  );

const attack = (p0: Partial<PlayerState> = {}, p1: Partial<PlayerState> = {}) =>
  play(standoff(p0, p1), move(character, 'B3'), endMove);

describe('moving into enemy units', () => {
  it('lets characters and mechs move onto enemy units, but not workers', () => {
    const state = play(game({ character: 'A2', mechs: ['A3'], workers: ['A2'] }, { character: 'B3', workers: ['A1'] }), choose(2));
    const targets = (unit: object) =>
      legalActions(state, 0)
        .filter((a) => a.type === 'moveUnit' && JSON.stringify(a.unit) === JSON.stringify(unit))
        .map((a) => (a as { to: string }).to);
    expect(targets(character)).toContain('B3');
    expect(targets(character)).toContain('A1');
    expect(targets(mech(0))).toContain('B3');
    expect(targets(worker(0))).not.toContain('B3');
    expect(targets(worker(0))).not.toContain('A1');
  });

  it('lets a mech carry workers into a fight', () => {
    let state = play(game({ mechs: ['A2'], workers: ['A2'] }, { character: 'B3' }), choose(2));
    state = play(state, { type: 'carryWorker', unit: mech(0), worker: 0 }, move(mech(0), 'B3'));
    expect(state.players[0]!.workers).toEqual(['B3']);
  });

  it('waits until the move is over before fighting', () => {
    const state = play(standoff(), move(character, 'B3'));
    expect(state.turn.step).toBe('moving');
    expect(play(state, endMove).turn).toMatchObject({ step: 'combat', fight: { hex: 'B3' } });
  });

  it('sends enemy workers home with no fight, at 1 popularity each', () => {
    const state = play(game({ character: 'A2', popularity: 5 }, { workers: ['B3', 'B3', 'C2'] }), choose(2), move(character, 'B3'), endMove);
    expect(state.turn.step).toBe('bottom');
    expect(state.players[1]!.workers).toEqual(['home', 'home', 'C2']);
    expect(state.players[0]!.popularity).toBe(3);
  });

  it("doesn't take popularity below 0", () => {
    const state = play(game({ character: 'A2', popularity: 0 }, { workers: ['B3', 'B3'] }), choose(2), move(character, 'B3'), endMove);
    expect(state.players[0]!.popularity).toBe(0);
  });
});

describe('choosing power and cards', () => {
  it('asks the attacker first, then the defender, each in secret', () => {
    let state = attack();
    expect(activeSeat(state)).toBe(0);
    expect(legalActions(state, 1)).toEqual([]);
    expect(legalActions(state, 0)).toEqual([card(5), card(2), dial(0), dial(1), dial(2), dial(3), dial(4), dial(5)]);

    state = play(state, card(5), dial(3));
    expect(activeSeat(state)).toBe(1);
    expect(state.currentPlayer).toBe(0);
    expect(legalActions(state, 0)).toEqual([]);
    expect(legalActions(state, 1)).toEqual([card(3), dial(0), dial(1), dial(2), dial(3), dial(4)]);
  });

  it('allows one card per character or mech in the fight', () => {
    // One unit: after one card, only the dial is left.
    let state = play(attack(), card(5));
    expect(legalActions(state, 0).some((a) => a.type === 'combatCard')).toBe(false);
    // Character and mech: two cards.
    state = play(standoff({ mechs: ['A2'], combatCards: [2, 2, 5] }), move(character, 'B3'), move(mech(0), 'B3'), card(2), card(5));
    expect(state.turn.step).toBe('combat');
    expect(legalActions(state, 0).some((a) => a.type === 'combatCard')).toBe(false);
  });

  it('caps the dial at 7 power', () => {
    const powers = legalActions(attack({ power: 12 }), 0).filter((a) => a.type === 'combatPower');
    expect(powers).toHaveLength(8);
  });

  it('skips a side with no power and no cards', () => {
    const state = play(attack({}, { power: 0, combatCards: [] }), dial(1));
    // The defender had nothing to choose, so the fight is already over.
    expect(state.turn.step).toBe('bottom');
    expect(state.lastCombat).toMatchObject({ winner: 0, defender: { seat: 1, power: 0, cards: [] } });
  });
});

describe('resolving a fight', () => {
  it('gives the win to the higher total; the loser retreats and the attacker pays for displaced workers', () => {
    const state = play(attack(), card(5), dial(3), card(3), dial(4));
    const [a, d] = state.players;
    expect(state.lastCombat).toEqual({
      hex: 'B3',
      attacker: { seat: 0, power: 3, cards: [5] },
      defender: { seat: 1, power: 4, cards: [3] },
      winner: 0,
    });
    // Both pay the power they dialed; cards played go to the discard pile.
    expect(a).toMatchObject({ power: 2, combatCards: [2], character: 'B3', stars: ['combat'] });
    expect(state.combatDiscard).toEqual([5, 3]);
    // The defender's units on the hex (character and worker) go home; their other worker stays.
    expect(d).toMatchObject({ power: 0, character: 'home', workers: ['home', 'C2'] });
    // The loser showed power, so draws a card.
    expect(d!.combatCards).toHaveLength(1);
    // One enemy worker sent home: 1 popularity.
    expect(a!.popularity).toBe(1);
    expect(state.turn.step).toBe('bottom');
  });

  it('gives ties to the attacker', () => {
    expect(play(attack(), dial(3), dial(3)).lastCombat?.winner).toBe(0);
  });

  it('sends the attacker home on a loss, with any workers it brought, and no popularity lost', () => {
    let state = play(
      game({ mechs: ['A2'], workers: ['A2'], combatCards: [] }, { character: 'B3', workers: ['B3'], power: 4, combatCards: [] }),
      choose(2),
      { type: 'carryWorker', unit: mech(0), worker: 0 },
      move(mech(0), 'B3'),
      endMove,
    );
    state = play(state, dial(2), dial(3));
    expect(state.lastCombat?.winner).toBe(1);
    expect(state.players[0]).toMatchObject({ mechs: ['home'], workers: ['home'], popularity: 2, stars: [] });
    expect(state.players[1]).toMatchObject({ character: 'B3', workers: ['B3'], stars: ['combat'] });
  });

  it('gives no card to a loser who showed no power', () => {
    const state = play(attack({ combatCards: [] }), dial(0), dial(1));
    expect(state.lastCombat?.winner).toBe(1);
    expect(state.players[0]!.combatCards).toEqual([]);
  });

  it('earns at most two combat stars', () => {
    const state = play(attack({ stars: ['combat', 'combat'] }), dial(3), dial(0));
    expect(state.players[0]!.stars).toEqual(['combat', 'combat']);
    expect(play(attack({ stars: ['combat'] }), dial(3), dial(0)).players[0]!.stars).toEqual(['combat', 'combat']);
  });

  it('lets the attacker pick the order of several fights', () => {
    let state = play(
      game({ character: 'A2', mechs: ['A4'], power: 6 }, { character: 'B3', mechs: ['B4'], power: 2, combatCards: [] }),
      choose(2),
      move(character, 'B3'),
      move(mech(0), 'B4'),
    );
    expect(state.turn).toMatchObject({ step: 'combat', fight: null });
    expect(legalActions(state, 0)).toEqual([
      { type: 'fight', hex: 'B3' },
      { type: 'fight', hex: 'B4' },
    ]);
    state = play(state, { type: 'fight', hex: 'B4' }, dial(1), dial(0));
    expect(state.lastCombat?.hex).toBe('B4');
    // The last fight starts on its own.
    expect(state.turn).toMatchObject({ step: 'combat', fight: { hex: 'B3' } });
    state = play(state, dial(1), dial(2));
    expect(state.turn.step).toBe('bottom');
    expect(state.players[0]).toMatchObject({ character: 'home', mechs: ['B4'], power: 4 });
  });
});

describe('after retreating', () => {
  it('lets units move back out from the home base', () => {
    const state = play(game({ mechs: ['home'], workers: ['home', 'A1'] }), choose(2));
    const actions = legalActions(state, 0);
    expect(actions).toContainEqual(move(mech(0), 'A2'));
    expect(actions).toContainEqual(move(worker(0), 'A1'));
    expect(actions).toContainEqual({ type: 'carryWorker', unit: mech(0), worker: 0 });
  });

  it("doesn't produce, trade or build at the home base", () => {
    const state = game({ workers: ['home', 'home'] });
    expect(legalActions(play(state, choose(1)), 0)).toEqual([{ type: 'skipTop' }]);
    expect(legalActions(play(state, choose(3)), 0).filter((a) => a.type === 'tradeResource')).toEqual([]);
  });
});

describe('the combat card deck', () => {
  it('has 42 cards worth 2 to 5, and deals each player their starting hand', () => {
    expect(COMBAT_DECK).toHaveLength(42);
    const state = newGame(testSetup);
    for (const p of state.players) expect(p.combatCards).toHaveLength(2);
    const all = [...state.combatDeck, ...state.players.flatMap((p) => p.combatCards)].sort();
    expect(all).toEqual([...COMBAT_DECK].sort());
    // Shuffled by seed.
    expect(newGame({ ...testSetup, seed: 2 }).combatDeck).not.toEqual(state.combatDeck);
  });

  it('draws for Bolster, shuffling the discards back in when the deck runs out', () => {
    let state = game({ combatCards: [] });
    state = { ...state, combatDeck: [4], combatDiscard: [2, 2, 3] };
    state = play(state, choose(0), { type: 'bolster', gain: 'combatCards' });
    expect(state.players[0]!.combatCards).toEqual([4]);
    // Mat A's bolster gives 1 card; an upgraded one (2) would empty the deck and reshuffle.
    state = { ...game({ combatCards: [], upgrades: { top: [{ section: 0, field: 'combatCards' }], bottom: [0] } }), combatDeck: [4], combatDiscard: [2, 2, 3] };
    state = play(state, choose(0), { type: 'bolster', gain: 'combatCards' });
    expect(state.players[0]!.combatCards).toHaveLength(2);
    expect(state.combatDeck).toHaveLength(2);
    expect(state.combatDiscard).toEqual([]);
  });
});
