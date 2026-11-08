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

describe('more conditions', () => {
  // Conditions written `as const` below, so they're read-only: fine here, as they're only read.
  const check = (state: GameState, ...checks: object[]) => objectiveMet(state, 0, { id: 't', name: 'T', checks: checks as ObjectiveCard['checks'] });
  const other = (state: GameState, p1: Partial<PlayerState>): GameState => ({ ...state, players: [state.players[0]!, { ...state.players[1]!, ...p1 }] });

  it('counts a Factory card held, and fights won (a combat star for each)', () => {
    expect(check(game(), { kind: 'progress', what: 'factoryCards', atLeast: 1 })).toBe(false);
    expect(check(game({ factoryCard: 'f1' }), { kind: 'progress', what: 'factoryCards', atLeast: 1 })).toBe(true);
    expect(check(game(), { kind: 'progress', what: 'factoryCards', atMost: 0 })).toBe(true);
    expect(check(game({ stars: ['power'] }), { kind: 'progress', what: 'fightsWon', atLeast: 1 })).toBe(false);
    expect(check(game({ stars: ['power', 'combat'] }), { kind: 'progress', what: 'fightsWon', atLeast: 1 })).toBe(true);
  });

  it('counts only tunnel territories when asked', () => {
    // A4 and C1 are tunnels; A1 is not.
    const tunnels = { kind: 'territories', tunnel: true, atLeast: 2 } as const;
    expect(check(game({ workers: ['A1', 'A4'] }), tunnels)).toBe(false);
    expect(check(game({ workers: ['A1', 'A4'], character: 'C1' }), tunnels)).toBe(true);
  });

  it('counts territories around one hex of a terrain (the lake B2, the Factory B3)', () => {
    // B2's neighbours: A1, A2, B1, B3, C1, C2.
    const lake = { kind: 'around', terrain: 'lake', atLeast: 3 } as const;
    expect(check(game({ workers: ['A1', 'A2'] }), lake)).toBe(false);
    expect(check(game({ workers: ['A1', 'A2'], character: 'C1' }), lake)).toBe(true);
    // B3's neighbours: A2, A3, B2, B4, C2, C3. The Factory itself doesn't count.
    const factory = { kind: 'around', terrain: 'factory', atLeast: 2 } as const;
    expect(check(game({ workers: ['A2', 'B3'] }), factory)).toBe(false);
    expect(check(game({ workers: ['A2', 'B4'] }), factory)).toBe(true);
  });

  it('asks for things all on one territory you control', () => {
    const outpost = {
      kind: 'oneTerritory',
      checks: [
        { kind: 'units', unit: 'character', atLeast: 1 },
        { kind: 'units', unit: 'mech', atLeast: 1, atMost: 1 },
        { kind: 'units', unit: 'worker', atLeast: 1, atMost: 1 },
        { kind: 'resources', atLeast: 5 },
      ],
    } as const;
    const there = { character: 'A1', mechs: ['A1'], workers: ['A1', 'A2'] };
    expect(check(game(there, { resources: { A1: { oil: 3, wood: 2 } } }), outpost)).toBe(true);
    // Resources on another hex don't help.
    expect(check(game(there, { resources: { A1: { oil: 3 }, A2: { wood: 2 } } }), outpost)).toBe(false);
    // Two workers there is too many.
    expect(check(game({ ...there, workers: ['A1', 'A1'] }, { resources: { A1: { oil: 5 } } }), outpost)).toBe(false);
    // Tokens: character, mechs, workers and structures together.
    const tokens = { kind: 'oneTerritory', checks: [{ kind: 'tokens', atLeast: 4 }] } as const;
    expect(check(game({ character: 'A1', mechs: ['A1'], workers: ['A1', 'A2'] }), tokens)).toBe(false);
    expect(check(game({ character: 'A1', mechs: ['A1'], workers: ['A1', 'A2'], structures: { mill: 'A1' } }), tokens)).toBe(true);
    // Each kind of resource on the one hex.
    const stores = { kind: 'oneTerritory', checks: [{ kind: 'eachResource', resources: ['oil', 'food'], atLeast: 1 }, { kind: 'structures', atLeast: 1 }] } as const;
    expect(check(game({ structures: { mine: 'A1' } }, { resources: { A1: { oil: 1, food: 1 } } }), stores)).toBe(true);
    expect(check(game({ structures: { mine: 'A2' } }, { resources: { A1: { oil: 1, food: 1 } } }), stores)).toBe(false);
  });

  it('counts the most of any one kind of resource you control', () => {
    const hoard = { kind: 'resources', oneKind: true, atLeast: 4 } as const;
    expect(check(game({}, { resources: { A1: { oil: 2, food: 2 } } }), hoard)).toBe(false);
    expect(check(game({}, { resources: { A1: { oil: 2, food: 1 }, A2: { oil: 2 } } }), hoard)).toBe(true);
  });

  it('compares two counts: as many workers as recruits', () => {
    const even = { kind: 'same', what: ['workers', 'recruits'] } as const;
    expect(check(game({ recruits: [0] }), even)).toBe(false);
    expect(check(game({ recruits: [0, 1] }), even)).toBe(true);
  });

  it('asks for the most of something among all players, ties allowed', () => {
    const top = { kind: 'highest', stat: 'power' } as const;
    expect(check(other(game({ power: 5 }), { power: 6 }), top)).toBe(false);
    expect(check(other(game({ power: 6 }), { power: 6 }), top)).toBe(true);
  });

  it("counts enemy workers your move sent home this turn, and forgets them when the turn ends", () => {
    // Player 1's lone worker on A3; player 0's character walks onto it.
    let state = other(game({ power: 7, character: 'A2' }), { workers: ['A3'] });
    const sent = { kind: 'thisTurn', what: 'workersSentHome', atLeast: 1 } as const;
    expect(check(state, sent)).toBe(false);
    state = play(state, { type: 'chooseSection', section: 2 }, { type: 'moveUnit', unit: { kind: 'character' }, to: 'A3' }, { type: 'endMove' });
    expect(state.players[1]!.workers).toEqual(['home']);
    expect(check(state, sent)).toBe(true);
    state = play(state, { type: 'skipBottom' });
    expect(state.currentPlayer).toBe(1);
    expect(check({ ...state, currentPlayer: 0 }, sent)).toBe(false);
  });

  it('checks the new conditions when a card is entered', () => {
    const fine: ObjectiveCard = {
      id: 'n',
      name: 'New',
      checks: [
        { kind: 'around', terrain: 'lake', atLeast: 5 },
        { kind: 'oneTerritory', checks: [{ kind: 'tokens', atLeast: 6 }] },
        { kind: 'same', what: ['workers', 'recruits'] },
        { kind: 'highest', stat: 'power' },
        { kind: 'thisTurn', what: 'workersSentHome', atLeast: 1 },
        { kind: 'territories', tunnel: true, atLeast: 3 },
      ],
    };
    expect(validateObjectiveCard(fine)).toEqual([]);
    const odd = {
      id: 'x',
      name: 'X',
      checks: [
        { kind: 'around', terrain: 'sea', atLeast: 1 },
        { kind: 'oneTerritory', checks: [] },
        { kind: 'oneTerritory', checks: [{ kind: 'units', unit: 'ghost', atLeast: 1 }] },
        { kind: 'same', what: ['workers'] },
        { kind: 'highest', stat: 'luck' },
      ],
    } as unknown as ObjectiveCard;
    expect(validateObjectiveCard(odd)).toEqual([
      'condition 1 names an unknown terrain',
      'condition 2 needs at least one thing to find on the territory',
      'condition 3, part 1 counts something unknown',
      'condition 4 needs two things to compare',
      'condition 5 counts something unknown',
    ]);
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
