// Scenario tests for faction and mech abilities, on the small test board
// (see test-fixtures.ts). A river runs between A1 (farm) and B1 (village);
// B2 is a lake, B3 the Factory, B1 and C3 villages, A4 and C1 tunnels.
// Player 0 uses mat A (section 2 is Move, 2 units).
import { describe, expect, it } from 'vitest';
import { activeSeat, applyAction, legalActions, newGame, type Action, type GameState, type PlayerState } from './game';
import type { AbilityRule, Faction } from './faction';
import { factionA, factionB, testSetup } from './test-fixtures';
import { nextInt, seedRng } from './rng';

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
  it('links a village you control to the Factory and back', () => {
    let state = play(game({ mechs: [township] }, { character: 'B1' }), choose(2));
    expect(targets(state, character)).toContain('B3');
    // From the Factory to any village you control (B1, with your worker), even far away.
    state = play(game({ mechs: [township] }, { character: 'B3', workers: ['B1'] }), choose(2));
    expect(targets(state, character)).toContain('B1');
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

describe('fuzz: random games with every ability', () => {
  it('keeps the invariants', () => {
    const all = [riverwalk, lakes, artillery, speed];
    const rest = [township, peoplesArmy, { kind: 'crossRivers', units: 'characterAndMechs', onto: ['farm', 'forest'] } as AbilityRule, speed];
    let fights = 0;
    for (let g = 0; g < 30; g++) {
      const setup = {
        ...testSetup,
        seed: g,
        players: [
          { ...testSetup.players[0]!, faction: withRules(factionA, swim, all) },
          { ...testSetup.players[1]!, faction: withRules(factionB, relentless, rest) },
        ],
      };
      let state = newGame(setup);
      let rng = seedRng(g + 100);
      for (let step = 0; step < 400; step++) {
        const options = legalActions(state, activeSeat(state));
        expect(options.length).toBeGreaterThan(0);
        let pick: number;
        [pick, rng] = nextInt(rng, options.length);
        const before = state.lastCombat;
        state = applyAction(state, options[pick]!);
        if (state.lastCombat !== before) fights++;
        for (const p of state.players) {
          expect(p.power).toBeGreaterThanOrEqual(0);
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
