// Scenario tests for encounters, on the small test board (see test-fixtures.ts):
// encounter tokens on A3 (mountain) and C4 (forest). A2 borders A1, A3, B3
// and the lake B2. Player 0 uses mat A (section 2 is Move, 2 units; section 1
// is Produce/Deploy); player 1 uses mat B.
import { describe, expect, it } from 'vitest';
import { activeSeat, applyAction, legalActions, newGame, type Action, type GameState, type PlayerState } from './game';
import { validateEncounterCard, type EncounterCard } from './encounters';
import type { AbilityRule } from './faction';
import { factionA, testSetup } from './test-fixtures';

const play = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);

const option = (text: string, cost: EncounterCard['options'][number]['cost'], gain: EncounterCard['options'][number]['gain']) => ({ text, cost, gain });

const cards: EncounterCard[] = [
  {
    id: 'c1',
    name: 'Card one',
    story: '',
    options: [
      option('free', {}, { power: 2, combatCards: 1 }),
      option('coins', { coins: 2 }, { workers: 2, resources: { metal: 1 } }),
      option('popularity', { popularity: 3 }, { coins: 3, actions: ['deploy'] }),
    ],
  },
  {
    id: 'c2',
    name: 'Card two',
    story: '',
    options: [
      option('free', {}, { coins: 2 }),
      option('coins', { coins: 1 }, { anyResources: 2 }),
      option('power', { power: 3 }, { actions: ['upgrade', 'build'] }),
    ],
  },
];

const meander: AbilityRule = { kind: 'encounterOptions', count: 2 };

function game(p0: Partial<PlayerState> = {}, p1: Partial<PlayerState> = {}, opts: { deck?: EncounterCard[]; rule?: AbilityRule } = {}): GameState {
  const setup = {
    ...testSetup,
    encounters: opts.deck ?? cards,
    players: [{ ...testSetup.players[0]!, faction: { ...factionA, ability: { ...factionA.ability, rule: opts.rule } } }, testSetup.players[1]!],
  };
  const state = newGame(setup);
  // The first card drawn is always c1, then c2.
  return {
    ...state,
    encounterDeck: (opts.deck ?? cards).map((c) => c.id),
    players: [{ ...state.players[0]!, ...p0 }, { ...state.players[1]!, ...p1 }],
  };
}

const choose = (section: number): Action => ({ type: 'chooseSection', section });
const character = { kind: 'character' as const };
const mech = (index: number) => ({ kind: 'mech' as const, index });
const worker = (index: number) => ({ kind: 'worker' as const, index });
const move = (unit: object, to: string) => ({ type: 'moveUnit', unit, to }) as Action;
const endMove: Action = { type: 'endMove' };
const pick = (n: number): Action => ({ type: 'encounterOption', option: n });
const options = (state: GameState) =>
  legalActions(state, activeSeat(state))
    .filter((a) => a.type === 'encounterOption')
    .map((a) => (a as { option: number }).option);

/** Player 0's character moves from A2 onto the encounter on A3. */
const encounter = (p0: Partial<PlayerState> = {}, p1: Partial<PlayerState> = {}, opts: { deck?: EncounterCard[]; rule?: AbilityRule } = {}) =>
  play(game({ character: 'A2', workers: ['A1', 'A2'], ...p0 }, p1, opts), choose(2), move(character, 'A3'), endMove);

describe('setting up encounters', () => {
  it('puts a token on every encounter hex and shuffles the cards', () => {
    const state = newGame({ ...testSetup, encounters: cards });
    expect([...state.encounterTokens].sort()).toEqual(['A3', 'C4']);
    expect([...state.encounterDeck].sort()).toEqual(['c1', 'c2']);
  });

  it('has no encounters in a game without encounter cards (games saved before encounters)', () => {
    const state = newGame(testSetup);
    expect(state.encounterTokens).toEqual([]);
    const moved = play({ ...state, players: [{ ...state.players[0]!, character: 'A2' }, state.players[1]!] }, choose(2), move(character, 'A3'), endMove);
    expect(moved.turn.step).toBe('bottom');
  });

  it("doesn't change the shuffled combat deck", () => {
    expect(newGame({ ...testSetup, encounters: cards }).combatDeck).toEqual(newGame(testSetup).combatDeck);
  });
});

describe('having an encounter', () => {
  it('happens when the character ends its move on a token, drawing the top card', () => {
    const state = encounter();
    expect(state.turn).toMatchObject({ step: 'encounter', hex: 'A3', card: 'c1', picked: [] });
    expect(state.encounterTokens).toEqual(['C4']);
    expect(state.encounterDeck).toEqual(['c2']);
  });

  it('waits until the whole move is over', () => {
    const state = play(game({ character: 'A2', mechs: ['A1'] }), choose(2), move(character, 'A3'));
    expect(state.turn.step).toBe('moving');
    expect(play(state, move(mech(0), 'A2')).turn.step).toBe('encounter');
  });

  it("doesn't happen for mechs or workers", () => {
    const state = play(game({ mechs: ['A2'], workers: ['A2'] }), choose(2), move(mech(0), 'A3'), move(worker(0), 'A3'));
    expect(state.turn.step).toBe('bottom');
    expect(state.encounterTokens).toContain('A3');
  });

  it("ends the character's move on a token, even with Speed", () => {
    const state = play(
      game({ character: 'A2', mechs: ['C3'] }, {}, { rule: { kind: 'speed', extra: 1 } }),
      choose(2),
      move(character, 'A3'),
    );
    expect(state.turn).not.toHaveProperty('walking');
    // A mech with Speed walks through (only the character has encounters).
    const mechWalk = play(game({ mechs: ['A2'] }, {}, { rule: { kind: 'speed', extra: 1 } }), choose(2), move(mech(0), 'A3'));
    expect(mechWalk.turn).toMatchObject({ walking: { unit: mech(0) } });
  });

  it('only offers the options you can pay for', () => {
    expect(options(encounter({ coins: 1, popularity: 2 }))).toEqual([0]);
    expect(options(encounter({ coins: 2, popularity: 3 }))).toEqual([0, 1, 2]);
  });

  it('gives what the option says, then goes on to the bottom row', () => {
    const state = play(encounter({ power: 3, combatCards: [] }), pick(0));
    expect(state.players[0]!.power).toBe(5);
    expect(state.players[0]!.combatCards).toHaveLength(1);
    expect(state.turn).toMatchObject({ step: 'bottom', section: 2, paid: 0 });
    expect(state.encounterDiscard).toEqual(['c1']);
  });

  it('pays the cost and puts workers and resources on the encounter hex', () => {
    const state = play(encounter({ coins: 5 }), pick(1));
    expect(state.players[0]!.coins).toBe(3);
    expect(state.players[0]!.workers.filter((w) => w === 'A3')).toHaveLength(2);
    expect(state.resources.A3).toEqual({ metal: 1 });
  });

  it('never gives more than 8 workers', () => {
    const seven = ['A1', 'A1', 'A1', 'A1', 'A1', 'A1', 'A1'];
    const state = play(encounter({ coins: 5, workers: seven }), pick(1));
    expect(state.players[0]!.workers).toHaveLength(8);
  });

  it('lets you choose resources of any kind, one at a time', () => {
    let state = encounter({}, {}, { deck: [cards[1]!] });
    state = play(state, pick(1));
    expect(state.turn.step).toBe('encounter');
    const kinds = legalActions(state, 0).map((a) => (a as { resource: string }).resource);
    expect(kinds.sort()).toEqual(['food', 'metal', 'oil', 'wood']);
    state = play(state, { type: 'encounterResource', resource: 'oil' }, { type: 'encounterResource', resource: 'wood' });
    expect(state.resources.A3).toEqual({ oil: 1, wood: 1 });
    expect(state.turn.step).toBe('bottom');
  });

  it('deploys a mech for free: no cost, no bottom-row coins, no recruit bonuses', () => {
    // Player 1 has a recruit on their deploy section (mat B section 1, bonus: coins).
    let state = encounter({ popularity: 5, coins: 0 }, { recruits: [1], coins: 0 });
    state = play(state, pick(2));
    expect(state.players[0]!.popularity).toBe(2);
    expect(state.players[0]!.coins).toBe(3);
    const deploys = legalActions(state, 0).filter((a) => a.type === 'deploy');
    // On a hex with one of your workers, as usual.
    expect(new Set(deploys.map((a) => (a as { hex: string }).hex))).toEqual(new Set(['A1', 'A2']));
    state = play(state, { type: 'deploy', hex: 'A2', ability: 1 });
    expect(state.players[0]!.mechs).toEqual(['A2']);
    expect(state.players[0]!.mechAbilities).toEqual([1]);
    expect(state.players[0]!.coins).toBe(3);
    expect(state.players[1]!.coins).toBe(0);
    expect(state.turn.step).toBe('bottom');
  });

  it('skips a free action there is nothing left to do for', () => {
    const state = play(encounter({ popularity: 5, mechs: ['A1', 'A1', 'A1', 'A1'], mechAbilities: [0, 1, 2, 3] }), pick(2));
    expect(state.turn.step).toBe('bottom');
  });

  it('takes several free actions in order', () => {
    let state = encounter({ power: 4 }, {}, { deck: [cards[1]!] });
    state = play(state, pick(2));
    expect(legalActions(state, 0).every((a) => a.type === 'upgrade')).toBe(true);
    state = play(state, legalActions(state, 0)[0]!);
    expect(legalActions(state, 0).every((a) => a.type === 'build')).toBe(true);
    state = play(state, { type: 'build', structure: 'mill', hex: 'A1' });
    expect(state.players[0]!.structures).toEqual({ mill: 'A1' });
    expect(state.players[0]!.upgrades.top).toHaveLength(1);
    expect(state.turn.step).toBe('bottom');
  });

  it("doesn't happen if the character loses the fight there, and the token stays", () => {
    const fight = encounter({ power: 0, combatCards: [] }, { character: 'A3', power: 5, combatCards: [] });
    expect(fight.turn.step).toBe('combat');
    const lost = play(fight, { type: 'combatPower', power: 5 });
    expect(lost.turn.step).toBe('bottom');
    expect(lost.encounterTokens).toContain('A3');
  });

  it('happens after a won fight there', () => {
    const fight = encounter({ power: 5, combatCards: [] }, { character: 'A3', power: 0, combatCards: [] });
    const won = play(fight, { type: 'combatPower', power: 1 });
    expect(won.turn).toMatchObject({ step: 'encounter', hex: 'A3' });
  });

  it('shuffles used cards back in when the deck runs out', () => {
    const state = { ...encounter(), encounterDeck: [], encounterDiscard: ['c2'] };
    // Drawn card c1 is in play; the next encounter draws from the discards.
    const after = play(state, pick(0));
    expect(after.encounterDiscard).toEqual(['c2', 'c1']);
    const next = play(
      { ...after, players: [{ ...after.players[0]!, character: 'C3' }, after.players[1]!], turn: { step: 'top', section: 2 } },
      move(character, 'C4'),
      endMove,
    );
    expect(next.turn).toMatchObject({ step: 'encounter', hex: 'C4' });
    expect(next.encounterDiscard).toEqual([]);
  });
});

describe('Meander', () => {
  it('takes up to two different options, paying for each', () => {
    let state = encounter({ coins: 5, power: 1 }, {}, { rule: meander });
    state = play(state, pick(1));
    expect(state.turn).toMatchObject({ step: 'encounter', picked: [1] });
    expect(options(state)).toEqual([0]);
    state = play(state, pick(0));
    expect(state.players[0]!.coins).toBe(3);
    expect(state.players[0]!.power).toBe(3);
    expect(state.turn.step).toBe('bottom');
  });

  it('may stop after one option', () => {
    let state = play(encounter({}, {}, { rule: meander }), pick(0));
    expect(legalActions(state, 0)).toContainEqual({ type: 'endEncounter' });
    state = play(state, { type: 'endEncounter' });
    expect(state.turn.step).toBe('bottom');
  });

  it('goes straight on when no other option is affordable', () => {
    const state = play(encounter({ coins: 0, popularity: 0 }, {}, { rule: meander }), pick(0));
    expect(state.turn.step).toBe('bottom');
  });

  it('without Meander, one option ends the encounter', () => {
    expect(legalActions(encounter(), 0)).not.toContainEqual({ type: 'endEncounter' });
  });
});

describe('checking an encounter card', () => {
  it('accepts a complete card', () => {
    expect(validateEncounterCard(cards[0]!)).toEqual([]);
  });

  it('names what is missing or wrong', () => {
    const card = cards[0]!;
    const broken: EncounterCard = {
      ...card,
      name: ' ',
      options: [
        { ...card.options[0], text: '' },
        { ...card.options[1], cost: { coins: -1 } },
        { ...card.options[2], gain: { resources: { gold: 1 } as never, actions: ['fly' as never], workers: 1.5 } },
      ],
    };
    expect(validateEncounterCard(broken)).toEqual([
      'name is missing',
      'option 1 has no text',
      "option 2's cost must be whole numbers of 0 or more",
      "option 3's rewards must be whole numbers of 0 or more",
      'option 3 gives an unknown resource',
      'option 3 gives an unknown action',
    ]);
  });

  it('needs exactly three options', () => {
    expect(validateEncounterCard({ ...cards[0]!, options: [cards[0]!.options[0]] as never })).toEqual(['it needs three options']);
  });
});
