// Scenario tests for faction and mech abilities, on the small test board
// (see test-fixtures.ts). A river runs between A1 (farm) and B1 (village);
// B2 is a lake, B3 the Factory, B1 and C3 villages, A4 and C1 tunnels.
// Player 0 uses mat A (section 2 is Move, 2 units).
import { describe, expect, it } from 'vitest';
import { activeSeat, applyAction, isGameOver, legalActions, newGame, type Action, type GameState, type PlayerState } from './game';
import type { AbilityRule, Faction } from './faction';
import { factionA, factionB, testSetup } from './test-fixtures';
import { nextInt, seedRng } from './rng';
import { shortfall } from './afford';
import { controlledHexes } from './state';

const play = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);

/** A faction with these rules on its faction ability and mech abilities (in order). */
function withRules(base: Faction, ability: AbilityRule | undefined, mechs: (AbilityRule | undefined)[] = []): Faction {
  return {
    ...base,
    ability: { ...base.ability, rule: ability },
    mechAbilities: base.mechAbilities.map((m, i) => ({ ...m, rule: mechs[i] })) as Faction['mechAbilities'],
  };
}

/** A game where player 0's faction has these rules (mech abilities all unlocked unless `p0` says otherwise). */
function game(
  rules: { ability?: AbilityRule; mechs?: AbilityRule[]; theirs?: AbilityRule[] },
  p0: Partial<PlayerState> = {},
  p1: Partial<PlayerState> = {},
): GameState {
  const setup = {
    ...testSetup,
    players: [
      { ...testSetup.players[0]!, faction: withRules(factionA, rules.ability, rules.mechs) },
      { ...testSetup.players[1]!, faction: withRules(factionB, undefined, rules.theirs) },
    ],
  };
  const state = newGame(setup);
  return {
    ...state,
    players: [
      { ...state.players[0]!, mechAbilities: [0, 1, 2, 3], ...p0 },
      { ...state.players[1]!, mechAbilities: [0, 1, 2, 3], ...p1 },
    ],
  };
}

const choose = (section: number): Action => ({ type: 'chooseSection', section });
const character = { kind: 'character' as const };
const mech = (index: number) => ({ kind: 'mech' as const, index });
const worker = (index: number) => ({ kind: 'worker' as const, index });
const move = (unit: object, to: string) => ({ type: 'moveUnit', unit, to }) as Action;
const targets = (state: GameState, unit: object) =>
  legalActions(state, activeSeat(state))
    .filter((a) => a.type === 'moveUnit' && JSON.stringify(a.unit) === JSON.stringify(unit))
    .map((a) => (a as { to: string }).to)
    .sort();

const riverwalk: AbilityRule = { kind: 'crossRivers', units: 'characterAndMechs', onto: ['village'] };
const swim: AbilityRule = { kind: 'crossRivers', units: 'workers' };
const lakes: AbilityRule = { kind: 'lakes', retreat: true };
const speed: AbilityRule = { kind: 'speed', extra: 1 };
const township: AbilityRule = { kind: 'villagesToFactory' };
const artillery: AbilityRule = { kind: 'drainPower', pay: 1, loss: 2 };
const peoplesArmy: AbilityRule = { kind: 'extraCardWithWorker' };
const relentless: AbilityRule = { kind: 'repeatSection' };

describe('crossing rivers', () => {
  it('lets the character and mechs cross onto the listed terrains once the mech is out', () => {
    const state = play(game({ mechs: [riverwalk] }, { character: 'A1', mechs: ['A1'], workers: ['A1', 'C4'] }), choose(2));
    expect(targets(state, character)).toEqual(['A2', 'B1']);
    expect(targets(state, mech(0))).toContain('B1');
    expect(targets(state, worker(0))).not.toContain('B1');
    // Not yet deployed: no crossing.
    const locked = play(game({ mechs: [riverwalk] }, { character: 'A1', mechAbilities: [] }), choose(2));
    expect(targets(locked, character)).not.toContain('B1');
  });

  it('only onto those terrains', () => {
    // B1 is a village; crossing back onto the farm A1 isn't allowed.
    const state = play(game({ mechs: [riverwalk] }, { character: 'B1' }), choose(2));
    expect(targets(state, character)).not.toContain('A1');
  });

  it('lets a mech carry workers across', () => {
    let state = play(game({ mechs: [riverwalk] }, { mechs: ['A1'], workers: ['A1'] }), choose(2));
    state = play(state, { type: 'carryWorker', unit: mech(0), worker: 0 }, move(mech(0), 'B1'));
    expect(state.players[0]!.workers).toEqual(['B1']);
  });

  it('lets workers swim across, but not the character', () => {
    const state = play(game({ ability: swim }, { character: 'A1', workers: ['A1'] }), choose(2));
    expect(targets(state, worker(0))).toContain('B1');
    expect(targets(state, character)).not.toContain('B1');
  });
});

describe('lakes', () => {
  it('lets the character and mechs move onto and off lakes, but not workers', () => {
    let state = play(game({ mechs: [lakes] }, { character: 'A2', workers: ['A2'] }), choose(2));
    expect(targets(state, character)).toContain('B2');
    expect(targets(state, worker(0))).not.toContain('B2');
    state = play(game({ mechs: [lakes] }, { character: 'B2' }), choose(2));
    expect(targets(state, character)).toEqual(['A1', 'A2', 'B1', 'B3', 'C1', 'C2']);
  });

  it('lets a mech carry workers and resources onto a lake', () => {
    let state: GameState = { ...game({ mechs: [lakes] }, { mechs: ['A2'], workers: ['A2', 'C4'] }), resources: { A2: { oil: 1 } } };
    state = play(state, choose(2), { type: 'carryWorker', unit: mech(0), worker: 0 }, { type: 'carryResource', unit: mech(0), resource: 'oil' });
    expect(targets(state, mech(0))).toContain('B2');
    state = play(state, move(mech(0), 'B2'));
    expect(state.players[0]!.workers).toEqual(['B2', 'C4']);
    expect(state.resources).toEqual({ B2: { oil: 1 } });
  });

  it("keeps workers on a lake with the mech: they can't move off alone", () => {
    const state = play(game({ mechs: [lakes] }, { mechs: ['B2'], workers: ['B2', 'C4'] }), choose(2));
    expect(targets(state, worker(0))).toEqual([]);
    expect(legalActions(state, 0)).toContainEqual({ type: 'carryWorker', unit: mech(0), worker: 0 });
  });

  it('takes everything on the lake along when the last mech leaves', () => {
    let state: GameState = { ...game({ mechs: [lakes] }, { mechs: ['B2'], workers: ['B2', 'B2'] }), resources: { B2: { food: 2 } } };
    state = play(state, choose(2), move(mech(0), 'B3'));
    expect(state.players[0]!.workers).toEqual(['B3', 'B3']);
    expect(state.resources).toEqual({ B3: { food: 2 } });
  });

  it("can't drop things off on a lake partway through a move", () => {
    let state = play(game({ mechs: [lakes, speed] }, { mechs: ['A2'], workers: ['A2'] }), choose(2));
    state = play(state, { type: 'carryWorker', unit: mech(0), worker: 0 }, move(mech(0), 'B2'));
    expect(legalActions(state, 0).some((a) => a.type === 'dropWorker')).toBe(false);
  });

  it('lets a loser retreat onto a lake next to the fight instead of going home', () => {
    // Player 1 attacks player 0's mech on A2 (next to the lake B2) and wins.
    let state = game({ mechs: [lakes] }, { mechs: ['A2'], workers: ['A2'], power: 0, combatCards: [], lastSection: 0 }, { character: 'B3', power: 3 });
    state = { ...state, currentPlayer: 1 };
    state = play(state, choose(3), move(character, 'A2'), { type: 'endMove' }, { type: 'combatPower', power: 1 });
    expect(state.lastCombat?.winner).toBe(1);
    // The mech (and the worker with it) waits for its owner to choose.
    expect(state.players[0]!.workers).toEqual(['A2']);
    expect(activeSeat(state)).toBe(0);
    expect(legalActions(state, 0)).toEqual([
      { type: 'retreat', to: 'home' },
      { type: 'retreat', to: 'B2' },
    ]);
    state = play(state, { type: 'retreat', to: 'B2' });
    // The worker goes onto the lake with the mech.
    expect(state.players[0]!.mechs).toEqual(['B2']);
    expect(state.players[0]!.workers).toEqual(['B2']);
    expect(state.turn.step).toBe('bottom');
    expect(activeSeat(state)).toBe(1);
  });
});

describe('speed', () => {
  it('lets a unit move one more hex, still counting as one unit moved', () => {
    let state = play(game({ mechs: [speed] }, { character: 'A3', workers: ['C4'] }), choose(2), move(character, 'A2'));
    expect(state.turn).toMatchObject({ step: 'moving', moved: [character] });
    expect(targets(state, character)).toEqual(['A1', 'A3', 'B3']);
    state = play(state, move(character, 'A1'));
    expect(state.players[0]!.character).toBe('A1');
    // Its moves are used up, but there's one more unit to move.
    expect(targets(state, character)).toEqual([]);
    expect(targets(state, worker(0))).toEqual(['B4']); // C3 has player 1's worker
  });

  it('stops a unit that moves onto enemy units', () => {
    const state = play(game({ mechs: [speed] }, { character: 'A2', workers: ['C4'] }, { character: 'B3' }), choose(2), move(character, 'B3'));
    expect(targets(state, character)).toEqual([]);
  });

  it('can drop off and pick up along the way', () => {
    let state = game({ mechs: [speed] }, { mechs: ['A3'], workers: ['A3', 'C4'] });
    state = { ...state, resources: { A3: { food: 1 }, A2: { wood: 1 } } };
    state = play(
      state,
      choose(2),
      { type: 'carryWorker', unit: mech(0), worker: 0 },
      { type: 'carryResource', unit: mech(0), resource: 'food' },
      move(mech(0), 'A2'),
      { type: 'dropResource', unit: mech(0), resource: 'food' },
      { type: 'carryResource', unit: mech(0), resource: 'wood' },
      move(mech(0), 'A1'),
    );
    expect(state.players[0]!.workers).toEqual(['A1', 'C4']);
    expect(state.resources).toEqual({ A2: { food: 1 }, A1: { wood: 1 } });
  });

  it('can drop a worker along the way', () => {
    const state = play(
      game({ mechs: [speed] }, { mechs: ['A3'], workers: ['A3'] }),
      choose(2),
      { type: 'carryWorker', unit: mech(0), worker: 0 },
      move(mech(0), 'A2'),
      { type: 'dropWorker', unit: mech(0), worker: 0 },
      move(mech(0), 'A1'),
    );
    expect(state.players[0]!.workers).toEqual(['A2']);
    expect(state.players[0]!.mechs).toEqual(['A1']);
  });

  it('ends the move once the last unit has used up its hexes', () => {
    let state = play(game({ mechs: [speed] }, { character: 'A3', workers: ['C4'] }), choose(2), move(worker(0), 'B4'), move(character, 'A2'));
    // Two units moved, but the character may still go one more.
    expect(state.turn.step).toBe('moving');
    state = play(state, move(character, 'A1'));
    expect(state.turn.step).toBe('bottom');
  });

  it('lets the second hex stop there instead', () => {
    const state = play(game({ mechs: [speed] }, { character: 'A3', workers: ['C4'] }), choose(2), move(worker(0), 'B4'), move(character, 'A2'));
    expect(legalActions(state, 0)).toContainEqual({ type: 'endMove' });
  });
});

describe('villages and the Factory', () => {
  it('links a village you control to the Factory and back, for the character and mechs', () => {
    let state = play(game({ mechs: [township] }, { character: 'B1', mechs: ['B1'], workers: [] }), choose(2));
    expect(targets(state, character)).toContain('B3');
    expect(targets(state, mech(0))).toContain('B3');
    // From the Factory to any village you control (B1, with your worker), even far away.
    state = play(game({ mechs: [township] }, { mechs: ['B3'], workers: ['B1'] }), choose(2));
    expect(targets(state, mech(0))).toContain('B1');
  });

  it("doesn't link them for workers (owner's ruling)", () => {
    const state = play(game({ mechs: [township] }, { character: 'home', workers: ['B1'] }), choose(2));
    expect(targets(state, worker(0))).not.toContain('B3');
  });
});

describe('repeating a section', () => {
  it('lets you pick the same section as last turn', () => {
    const sections = (state: GameState) => legalActions(state, 0).map((a) => (a as { section: number }).section);
    expect(sections(game({ ability: relentless }, { lastSection: 2 }))).toEqual([0, 1, 2, 3]);
    expect(sections(game({}, { lastSection: 2 }))).toEqual([0, 1, 3]);
  });
});

describe('combat abilities', () => {
  /** Player 0's character on A2 attacks player 1's character (and worker) on B3. */
  const attack = (rules: Parameters<typeof game>[0], p0: Partial<PlayerState> = {}, p1: Partial<PlayerState> = {}) =>
    play(
      game(rules, { character: 'A2', power: 5, combatCards: [2, 3, 4], ...p0 }, { character: 'B3', workers: ['B3'], power: 4, combatCards: [5, 5], ...p1 }),
      choose(2),
      move(character, 'B3'),
      { type: 'endMove' },
    );
  const cardOptions = (state: GameState) => legalActions(state, activeSeat(state)).filter((a) => a.type === 'combatCard').length;

  it('lets you play one more card with a worker in the fight', () => {
    // Player 1 defends with a character and a worker on B3: two cards.
    let state = play(attack({ theirs: [peoplesArmy] }), { type: 'combatPower', power: 0 });
    state = play(state, { type: 'combatCard', value: 5 });
    expect(cardOptions(state)).toBe(1);
    state = play(state, { type: 'combatCard', value: 5 });
    expect(cardOptions(state)).toBe(0);
  });

  it('lets a side drain the other side’s power before the dials', () => {
    let state = attack({ mechs: [artillery] });
    expect(legalActions(state, 0)).toEqual([
      { type: 'beforeCombat', use: true },
      { type: 'beforeCombat', use: false },
    ]);
    state = play(state, { type: 'beforeCombat', use: true });
    expect(state.players[0]!.power).toBe(4);
    expect(state.players[1]!.power).toBe(2);
    // Now the dials.
    expect(legalActions(state, 0)).toContainEqual({ type: 'combatPower', power: 4 });
  });

  it('asks the defender too, before anyone dials', () => {
    let state = attack({ mechs: [artillery], theirs: [artillery] });
    state = play(state, { type: 'beforeCombat', use: false });
    expect(activeSeat(state)).toBe(1);
    state = play(state, { type: 'beforeCombat', use: true });
    expect(state.players[0]!.power).toBe(3);
    expect(activeSeat(state)).toBe(0);
    expect(legalActions(state, 0)).toContainEqual({ type: 'combatPower', power: 3 });
  });

  it("doesn't offer it without the power to pay", () => {
    const state = attack({ mechs: [artillery] }, { power: 0 });
    expect(legalActions(state, 0).some((a) => a.type === 'beforeCombat')).toBe(false);
  });
});

describe('paying with a combat card: Coercion', () => {
  const coercion: AbilityRule = { kind: 'cardAsResource' };
  /** Player 0 (a worker on A1) about to pay for Upgrade: 3 oil. */
  const upgrading = (rule: AbilityRule | undefined, oil: number, cards = [2, 5]) =>
    play(
      { ...game({ ability: rule }, { workers: ['A1'], combatCards: cards }), resources: { A1: { oil } } },
      choose(0),
      { type: 'skipTop' },
    );
  const payments = (state: GameState) => legalActions(state, 0).filter((a) => a.type === 'pay' || a.type === 'payWithCard');

  it('lets one combat card stand in for one resource', () => {
    let state = upgrading(coercion, 2);
    expect(payments(state)).toEqual([
      { type: 'pay', hex: 'A1' },
      { type: 'payWithCard', value: 2 },
      { type: 'payWithCard', value: 5 },
    ]);
    state = play(state, { type: 'payWithCard', value: 2 });
    expect(state.players[0]!.combatCards).toEqual([5]);
    expect(state.combatDiscard).toContain(2);
    expect(state.turn).toMatchObject({ step: 'bottom', paid: 1 });
    // Only once a turn: now oil only.
    expect(payments(state)).toEqual([{ type: 'pay', hex: 'A1' }]);
    state = play(state, { type: 'pay', hex: 'A1' }, { type: 'pay', hex: 'A1' });
    expect(legalActions(state, 0).some((a) => a.type === 'upgrade')).toBe(true);
  });

  it('makes a cost one resource short affordable, but not two short', () => {
    expect(payments(upgrading(coercion, 2)).length).toBeGreaterThan(0);
    expect(payments(upgrading(coercion, 1))).toEqual([]);
    expect(payments(upgrading(undefined, 2))).toEqual([]);
    expect(payments(upgrading(coercion, 2, []))).toEqual([]);
  });

  it('counts in what the mat shows as missing', () => {
    const state = { ...game({ ability: coercion }, { workers: ['A1'], combatCards: [3] }), resources: { A1: { oil: 2 } } };
    expect(shortfall(state, 0, 0).bottom).toEqual([]);
    expect(shortfall({ ...state, resources: { A1: { oil: 1 } } }, 0, 0).bottom).toEqual([{ what: 'oil', amount: 1 }]);
  });
});

describe('home bases: Wayfare', () => {
  const wayfare: AbilityRule = { kind: 'toHomeBases' };
  /** The test board with a third home base "c" (bordering A4 and B4) that no faction uses. */
  const withSpareBase = (state: GameState): GameState => {
    const board = state.setup.board;
    const spare = { ...board, homeBases: { ...board.homeBases, c: ['A4', 'B4'] }, homeBasePositions: { ...board.homeBasePositions, c: { q: 5, r: 0 } } };
    return { ...state, setup: { ...state.setup, board: spare } };
  };
  const wayfaring = (p0: Partial<PlayerState> = {}, p1: Partial<PlayerState> = {}, rules: AbilityRule[] = [wayfare]) =>
    play(withSpareBase(game({ mechs: rules }, { character: 'home', mechs: ['B3'], workers: ['B3'], ...p0 }, { character: 'home', workers: [], ...p1 })), choose(2));

  it('moves the character and mechs to your own home base or an unused one, from anywhere', () => {
    const state = wayfaring();
    expect(targets(state, mech(0))).toEqual(expect.arrayContaining(['home', 'base:c']));
    // Not to the other faction's home base, and not for workers.
    expect(targets(state, mech(0))).not.toContain('base:b');
    expect(targets(state, worker(0))).not.toContain('base:c');
    // Only with the ability.
    expect(targets(wayfaring({}, {}, []), mech(0))).not.toContain('base:c');
  });

  it('moves out again to the hexes bordering that base', () => {
    let state = play(wayfaring(), move(mech(0), 'base:c'));
    expect(state.players[0]!.mechs).toEqual(['base:c']);
    state = play(withSpareBase(game({ mechs: [wayfare] }, { character: 'home', mechs: ['base:c'], workers: [] })), choose(2));
    expect(targets(state, mech(0))).toEqual(expect.arrayContaining(['A4', 'B4']));
  });

  it('takes along workers the mech carries, but not resources', () => {
    let state = play(wayfaring(), { type: 'carryWorker', unit: mech(0), worker: 0 }, move(mech(0), 'base:c'));
    expect(state.players[0]!.workers).toEqual(['base:c']);
    state = play({ ...wayfaring(), resources: { B3: { oil: 1 } } }, { type: 'carryResource', unit: mech(0), resource: 'oil' });
    expect(targets(state, mech(0))).not.toContain('base:c');
    expect(targets(state, mech(0))).not.toContain('home');
  });

  it("is never a fight or a territory: units from different factions can share a base", () => {
    const state = play(wayfaring({}, { mechs: ['base:c'] }), move(mech(0), 'base:c'), { type: 'endMove' });
    expect(state.turn.step).toBe('bottom');
    expect(controlledHexes(state, 0).has('base:c')).toBe(false);
  });
});

describe('fights on a lake', () => {
  it('happen when a mech moves onto a lake held by an enemy mech; the loser goes home with the workers riding on it', () => {
    let state = play(
      game({ mechs: [lakes], theirs: [lakes] }, { mechs: ['A2'], power: 5, combatCards: [] }, { character: 'home', mechs: ['B2'], workers: ['B2'], power: 1, combatCards: [], popularity: 6 }),
      choose(2),
      move(mech(0), 'B2'),
      { type: 'endMove' },
    );
    expect(state.turn).toMatchObject({ step: 'combat', fight: { hex: 'B2' } });
    state = play(state, { type: 'combatPower', power: 3 }, { type: 'combatPower', power: 1 });
    expect(state.lastCombat?.winner).toBe(0);
    expect(state.players[1]).toMatchObject({ mechs: ['home'], workers: ['home'] });
    expect(state.players[0]!.mechs).toEqual(['B2']);
  });
});

describe('more lakes: Submerge', () => {
  const submerge: AbilityRule = { kind: 'lakes', retreat: false, linked: true };
  /** The test board with C4 turned into a second lake. */
  const twoLakes = (state: GameState): GameState => {
    const board = state.setup.board;
    return { ...state, setup: { ...state.setup, board: { ...board, hexes: { ...board.hexes, C4: { ...board.hexes.C4!, terrain: 'lake' } } } } };
  };

  it('moves from any lake to any other, as if through a tunnel', () => {
    const state = play(twoLakes(game({ mechs: [submerge] }, { mechs: ['B2'] })), choose(2));
    expect(targets(state, mech(0))).toContain('C4');
  });

  it('only with the ability', () => {
    const state = play(twoLakes(game({ mechs: [lakes] }, { mechs: ['B2'] })), choose(2));
    expect(targets(state, mech(0))).not.toContain('C4');
  });
});

describe('mountains and tunnels: Underpass', () => {
  const underpass: AbilityRule = { kind: 'mountainsToTunnels' };

  it('links a mountain you control to every tunnel, for the character and mechs', () => {
    // A worker holds the mountain A3; the mech stands on the tunnel C1 (far away).
    const state = play(game({ mechs: [underpass] }, { mechs: ['C1'], workers: ['A3'] }), choose(2));
    expect(targets(state, mech(0))).toContain('A3');
    const back = play(game({ mechs: [underpass] }, { mechs: ['A3'], workers: [] }), choose(2));
    expect(targets(back, mech(0))).toContain('C1');
  });

  it("not to a mountain you don't control, and not for workers", () => {
    const state = play(game({ mechs: [underpass] }, { mechs: ['C1'], workers: ['C1'] }), choose(2));
    expect(targets(state, mech(0))).not.toContain('A3');
    expect(targets(state, worker(0))).not.toContain('A3');
  });
});

describe('more combat abilities', () => {
  /** Player 0's character on `from` attacks player 1's character (and a worker) on `to`. */
  const attack = (rules: Parameters<typeof game>[0], p0: Partial<PlayerState> = {}, p1: Partial<PlayerState> = {}, from = 'A2', to = 'B3') =>
    play(
      game(rules, { character: from, power: 5, combatCards: [2], ...p0 }, { character: to, workers: [to], power: 4, combatCards: [5, 5], ...p1 }),
      choose(2),
      move(character, to),
      { type: 'endMove' },
    );
  const win = (state: GameState) => play(state, { type: 'combatPower', power: 5 }, { type: 'combatPower', power: 0 });

  it('Camaraderie: no popularity lost for workers sent home in a won fight', () => {
    const camaraderie: AbilityRule = { kind: 'noPopularityLoss' };
    expect(win(attack({ mechs: [camaraderie] }, { popularity: 5 })).players[0]!.popularity).toBe(5);
    expect(win(attack({}, { popularity: 5 })).players[0]!.popularity).toBe(4);
  });

  it('Camaraderie: nor for moving onto workers alone', () => {
    const camaraderie: AbilityRule = { kind: 'noPopularityLoss' };
    const state = play(
      game({ mechs: [camaraderie] }, { character: 'A2', popularity: 5 }, { character: 'home', workers: ['B3'] }),
      choose(2),
      move(character, 'B3'),
      { type: 'endMove' },
    );
    expect(state.players[1]!.workers).toEqual(['home']);
    expect(state.players[0]!.popularity).toBe(5);
  });

  it('Disarm: the other side loses 2 power when the fight is on a tunnel', () => {
    const disarm: AbilityRule = { kind: 'disarmOnTunnels', loss: 2 };
    // A4 is a tunnel; A3 is next to it.
    expect(attack({ mechs: [disarm] }, {}, {}, 'A3', 'A4').players[1]!.power).toBe(2);
    expect(attack({ mechs: [disarm] }, {}, { power: 1 }, 'A3', 'A4').players[1]!.power).toBe(0);
    expect(attack({ mechs: [disarm] }).players[1]!.power).toBe(4);
    // Defending works too.
    expect(attack({ theirs: [disarm] }, {}, {}, 'A3', 'A4').players[0]!.power).toBe(3);
  });

  it('Scout: takes one of the other side’s combat cards at random before the fight', () => {
    const scout: AbilityRule = { kind: 'stealCard' };
    const state = attack({ mechs: [scout] });
    expect(state.players[0]!.combatCards.sort()).toEqual([2, 5]);
    expect(state.players[1]!.combatCards).toEqual([5]);
    // Nothing to take: nothing happens.
    expect(attack({ mechs: [scout] }, {}, { combatCards: [] }).players[0]!.combatCards).toEqual([2]);
  });

  it('Dominate: combat stars past the usual two', () => {
    const dominate: AbilityRule = { kind: 'unlimitedCombatStars' };
    const stars = win(attack({ ability: dominate }, { stars: ['combat', 'combat'] })).players[0]!.stars;
    expect(stars.filter((s) => s === 'combat')).toHaveLength(3);
    expect(win(attack({}, { stars: ['combat', 'combat'] })).players[0]!.stars).toEqual(['combat', 'combat']);
  });
});

describe('fuzz: random games with every ability', () => {
  const pairings: [string, [AbilityRule, AbilityRule[]], [AbilityRule, AbilityRule[]]][] = [
    [
      'first two factions',
      [swim, [riverwalk, lakes, artillery, speed]],
      [relentless, [township, peoplesArmy, { kind: 'crossRivers', units: 'characterAndMechs', onto: ['farm', 'forest'] }, speed]],
    ],
    [
      'next three',
      [{ kind: 'unlimitedCombatStars' }, [{ kind: 'lakes', retreat: false, linked: true }, { kind: 'mountainsToTunnels' }, { kind: 'disarmOnTunnels', loss: 2 }, speed]],
      [{ kind: 'cardAsResource' }, [{ kind: 'noPopularityLoss' }, { kind: 'stealCard' }, { kind: 'toHomeBases' }, speed]],
    ],
  ];
  it.each(pairings)('keeps the invariants (%s)', (_name, [ability0, mechs0], [ability1, mechs1]) => {
    let fights = 0;
    for (let g = 0; g < 30; g++) {
      const setup = {
        ...testSetup,
        seed: g,
        players: [
          { ...testSetup.players[0]!, faction: withRules(factionA, ability0, mechs0) },
          { ...testSetup.players[1]!, faction: withRules(factionB, ability1, mechs1) },
        ],
      };
      let state = newGame(setup);
      let rng = seedRng(g + 100);
      for (let step = 0; step < 400 && !isGameOver(state); step++) {
        const options = legalActions(state, activeSeat(state));
        expect(options.length).toBeGreaterThan(0);
        let pick: number;
        [pick, rng] = nextInt(rng, options.length);
        const before = state.lastCombat;
        state = applyAction(state, options[pick]!);
        if (state.lastCombat !== before) fights++;
        for (const p of state.players) {
          expect(p.power).toBeGreaterThanOrEqual(0);
          expect(p.stars.length).toBeLessThanOrEqual(6);
          // Workers stand on a lake only with one of their mechs.
          for (const w of p.workers) if (w !== 'home' && state.setup.board.hexes[w]!.terrain === 'lake') expect(p.mechs).toContain(w);
        }
        if (state.turn.step !== 'moving' && state.turn.step !== 'combat') {
          const [a, b] = state.players.map((p) => new Set([p.character, ...p.mechs, ...p.workers].filter((h) => h !== 'home')));
          expect([...a!].filter((h) => b!.has(h))).toEqual([]);
        }
      }
    }
    expect(fights).toBeGreaterThan(10);
  });
});
