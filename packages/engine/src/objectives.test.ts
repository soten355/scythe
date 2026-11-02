// Scenario tests for objectives, on the small test board (see test-fixtures.ts):
// player 0 starts with workers on A1 (farm) and A2 (forest); both mats deal
// two objective cards. Section 2 of mat A is Move; its bottom row is Deploy.
import { describe, expect, it } from 'vitest';
import { activeSeat, applyAction, isGameOver, legalActions, newGame, type Action, type GameState, type PlayerState } from './game';
import { objectiveMet, validateObjectiveCard, type ObjectiveCard } from './objectives';
import type { AbilityRule } from './faction';
import { factionA, testSetup } from './test-fixtures';

const play = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);

const cards: ObjectiveCard[] = [
  { id: 'o1', name: 'Rich', checks: [{ kind: 'stat', stat: 'coins', atLeast: 10 }] },
  { id: 'o2', name: 'Farmers', checks: [{ kind: 'units', unit: 'worker', terrain: 'farm', atLeast: 2 }] },
  { id: 'o3', name: 'Quiet', endOfTurn: true, checks: [{ kind: 'stat', stat: 'power', atMost: 0 }] },
  { id: 'o4', name: 'Stockpile', checks: [{ kind: 'eachResource', resources: ['oil', 'food'], atLeast: 1 }, { kind: 'resources', atLeast: 3 }] },
  { id: 'o5', name: 'Spread out', checks: [{ kind: 'territories', atLeast: 5 }, { kind: 'progress', what: 'mechs', atMost: 0 }] },
];

function game(p0: Partial<PlayerState> = {}, opts: { rule?: AbilityRule; resources?: GameState['resources'] } = {}): GameState {
  const setup = {
    ...testSetup,
    objectives: cards,
    players: [{ ...testSetup.players[0]!, faction: { ...factionA, ability: { ...factionA.ability, rule: opts.rule } } }, testSetup.players[1]!],
  };
  const state = newGame(setup);
  return { ...state, resources: opts.resources ?? {}, players: [{ ...state.players[0]!, objectives: ['o1', 'o3'], ...p0 }, state.players[1]!] };
}

const complete = (card: string): Action => ({ type: 'completeObjective', card });
const offered = (state: GameState) => legalActions(state, activeSeat(state)).filter((a) => a.type === 'completeObjective');

describe('setting up objectives', () => {
  it('deals each player as many cards as their mat says, without changing the other decks', () => {
    const state = newGame({ ...testSetup, objectives: cards });
    expect(state.players.map((p) => p.objectives.length)).toEqual([2, 2]);
    const dealt = [...state.players.flatMap((p) => p.objectives), ...state.objectiveDeck].sort();
    expect(dealt).toEqual(['o1', 'o2', 'o3', 'o4', 'o5']);
    expect(state.combatDeck).toEqual(newGame(testSetup).combatDeck);
  });

  it('has none in a game without objective cards (games saved before objectives)', () => {
    const state = newGame(testSetup);
    expect(state.players.map((p) => p.objectives)).toEqual([[], []]);
    expect(offered(state)).toEqual([]);
  });
});

describe('conditions', () => {
  const met = (state: GameState, id: string) => objectiveMet(state, 0, cards.find((c) => c.id === id)!);

  it('counts a value from the player', () => {
    expect(met(game({ coins: 9 }), 'o1')).toBe(false);
    expect(met(game({ coins: 10 }), 'o1')).toBe(true);
  });

  it('counts units on a kind of terrain', () => {
    expect(met(game(), 'o2')).toBe(false);
    expect(met(game({ workers: ['A1', 'B4'] }), 'o2')).toBe(true);
  });

  it('counts resources on hexes the player controls, in all and of each kind', () => {
    expect(met(game({}, { resources: { A1: { oil: 1, food: 2 } } }), 'o4')).toBe(true);
    expect(met(game({}, { resources: { A1: { oil: 3 } } }), 'o4')).toBe(false);
    // Resources on a hex nobody of yours is on don't count.
    expect(met(game({}, { resources: { A1: { oil: 1 }, B4: { food: 2 } } }), 'o4')).toBe(false);
  });

  it('counts territories (the Factory as three) and progress, all of them together', () => {
    expect(met(game({ workers: ['A1', 'A2'], character: 'B3' }), 'o5')).toBe(true);
    expect(met(game({ workers: ['A1', 'A2'], character: 'B4' }), 'o5')).toBe(false);
    expect(met(game({ workers: ['A1', 'A2'], character: 'B3', mechs: ['A1'] }), 'o5')).toBe(false);
  });
});

describe('completing an objective', () => {
  it('is offered at any point of your turn once its condition is met, and places a star', () => {
    expect(offered(game({ coins: 9 }))).toEqual([]);
    const state = game({ coins: 10 });
    expect(offered(state)).toEqual([complete('o1')]);
    const done = play(state, complete('o1'));
    expect(done.players[0]!.stars).toEqual(['objective']);
    expect(done.players[0]!.objectivesDone).toEqual(['o1']);
    // The turn carries on where it was.
    expect(done.turn).toEqual(state.turn);
    // Mid-turn too: after choosing a section.
    expect(offered(play(state, { type: 'chooseSection', section: 2 }))).toEqual([complete('o1')]);
  });

  it('only one a game: the other card stays in hand but can no longer be completed', () => {
    const done = play(game({ coins: 10, power: 0 }), complete('o1'));
    expect(done.players[0]!.objectives).toEqual(['o1', 'o3']);
    const atEnd = play(done, { type: 'chooseSection', section: 2 }, { type: 'skipTop' }, { type: 'skipBottom' });
    expect(atEnd.currentPlayer).toBe(1);
    expect(offered({ ...done, turn: { step: 'end', section: 2 } })).toEqual([]);
  });

  it('Dominate (no star limits): both can be completed', () => {
    const state = game({ coins: 10, power: 0 }, { rule: { kind: 'unlimitedCombatStars' } });
    const done = play({ ...state, turn: { step: 'end', section: 2 } }, complete('o1'));
    expect(offered(done)).toEqual([complete('o3')]);
    expect(play(done, complete('o3')).players[0]!.stars).toEqual(['objective', 'objective']);
  });

  it('not on another player’s turn', () => {
    const state = { ...game({ coins: 10 }), currentPlayer: 1 };
    expect(legalActions(state, 0)).toEqual([]);
    expect(offered(state)).toEqual([]);
  });

  it('a card for the end of your turn: offered when you could end your turn, and ends it', () => {
    let state = game({ power: 0 });
    expect(offered(state)).toEqual([]);
    state = play(state, { type: 'chooseSection', section: 2 }, { type: 'skipTop' });
    // Before the bottom row: completing it ends the turn (no bottom-row action after).
    expect(offered(state)).toEqual([complete('o3')]);
    const done = play(state, complete('o3'));
    expect(done.turn).toMatchObject({ step: 'end', section: 2 });
    expect(legalActions(done, 0)).toEqual([{ type: 'endTurn' }]);
  });

  it('the sixth star ends the game at once', () => {
    const five = ['upgrades', 'mechs', 'structures', 'recruits', 'workers'] as PlayerState['stars'];
    expect(isGameOver(play(game({ coins: 10, stars: five }), complete('o1')))).toBe(true);
  });
});

describe('checking an objective card', () => {
  it('is fine when complete', () => {
    for (const c of cards) expect(validateObjectiveCard(c)).toEqual([]);
  });

  it('names what is missing or wrong', () => {
    expect(validateObjectiveCard({ id: '', name: '', checks: [] })).toEqual(['name is missing', 'ID is missing', 'it needs at least one condition']);
    const odd = { id: 'x', name: 'X', checks: [{ kind: 'stat', stat: 'luck', atLeast: 1 }, { kind: 'units', unit: 'worker', terrain: 'sea', atLeast: -1 }, { kind: 'resources' }] } as unknown as ObjectiveCard;
    expect(validateObjectiveCard(odd)).toEqual([
      'condition 1 counts something unknown',
      'condition 2 names an unknown terrain',
      'condition 2 must use whole numbers of 0 or more',
      'condition 3 needs an "at least" or "at most"',
    ]);
  });
});
