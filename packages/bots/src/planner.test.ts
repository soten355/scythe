import { baseBoard, baseFactions, baseMats, sampleEncounters, sampleFactoryCards, sampleObjectives, sampleStructureBonuses } from '@scythe/content';
import { activeSeat, applyAction, isGameOver, legalActions, neighbors, newGame, nextInt, seedRng, type Action, type GameState, type HexId } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { planTurns, stateKey, type TurnPlan } from './planner';

const game = (seed = 1, players = 2) =>
  newGame({
    seed,
    board: baseBoard,
    players: baseFactions.slice(0, players).map((faction, i) => ({ faction, mat: baseMats[i]! })),
    encounters: sampleEncounters,
    factory: sampleFactoryCards,
    objectives: sampleObjectives,
    structureBonuses: sampleStructureBonuses,
  });

/** Takes a plan's actions one by one, each checked legal by the engine. */
const replayPlan = (start: GameState, plan: TurnPlan) => plan.actions.reduce(applyAction, start);

const sectionOf = (plan: TurnPlan) => (plan.actions[0] as Extract<Action, { type: 'chooseSection' }>).section;

/** The mat section with this top-row action. */
const sectionWith = (state: GameState, seat: number, action: string) =>
  state.setup.players[seat]!.mat.sections.findIndex((s) => s.top.action === action);

/** Every distinct end of the turn, found the slow way: each engine action on its own. */
function bruteForce(start: GameState, seat: number): Set<string> {
  const ends = new Set<string>();
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const state = stack.pop()!;
    for (const action of legalActions(state, seat)) {
      const next = applyAction(state, action);
      const key = stateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      if (next.currentPlayer !== seat || isGameOver(next) || ['combat', 'encounter', 'factoryCard'].includes(next.turn.step)) ends.add(key);
      else stack.push(next);
    }
  }
  return ends;
}

/** Plays random legal moves until `turns` turns are done. */
function randomGame(seed: number, turns: number, players = 5): GameState {
  let state = game(seed, players);
  let rng = seedRng(seed);
  while (state.turnsTaken < turns && !isGameOver(state)) {
    const options = legalActions(state, activeSeat(state));
    let pick: number;
    [pick, rng] = nextInt(rng, options.length);
    state = applyAction(state, options[pick]!);
  }
  return state;
}

describe('turn planner', () => {
  it('finds every distinct way to play the first turn, each ending the turn', () => {
    const start = game();
    const seat = start.currentPlayer;
    const { plans, complete } = planTurns(start, seat);
    expect(complete).toBe(true);
    expect(new Set(plans.map((p) => stateKey(p.state)))).toEqual(bruteForce(start, seat));
    for (const plan of plans) {
      expect(plan.stop).toBe('endTurn');
      expect(plan.state.currentPlayer).not.toBe(seat);
    }
    // Every section can be chosen on the first turn.
    expect(new Set(plans.map(sectionOf))).toEqual(new Set([0, 1, 2, 3]));
  });

  it('gives plans that the engine accepts step by step and that end where they say', () => {
    const start = game();
    for (const plan of planTurns(start, start.currentPlayer).plans) {
      expect(replayPlan(start, plan)).toEqual(plan.state);
    }
  });

  it('lists each position once, whichever order the units moved in', () => {
    const start = game();
    const seat = start.currentPlayer;
    const keys = planTurns(start, seat).plans.map((p) => stateKey(p.state));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('treats workers as interchangeable', () => {
    const start = game();
    const seat = start.currentPlayer;
    const [a, b] = start.players[seat]!.workers as [HexId, HexId];
    const swapped: GameState = { ...start, players: start.players.map((p, i) => (i === seat ? { ...p, workers: [b, a] } : p)) };
    expect(stateKey(swapped)).toBe(stateKey(start));
    // Two workers on one hex, each moving to the same neighbor: one plan, not two.
    const together: GameState = { ...start, players: start.players.map((p, i) => (i === seat ? { ...p, workers: [a, a] } : p)) };
    const move = sectionWith(together, seat, 'move');
    const plans = planTurns(together, seat).plans.filter((p) => sectionOf(p) === move);
    const oneOut = plans.filter((p) => {
      const w = p.state.players[seat]!.workers;
      return w.filter((h) => h === a).length === 1 && p.state.players[seat]!.character === 'home';
    });
    const places = oneOut.map((p) => p.state.players[seat]!.workers.find((h) => h !== a));
    expect(new Set(places).size).toBe(places.length);
  });

  it('has a unit take all the resources on its hex or none', () => {
    const start = game();
    const seat = start.currentPlayer;
    const hex = start.players[seat]!.workers[0]!;
    const state: GameState = { ...start, resources: { [hex]: { wood: 2, metal: 1 } } };
    const move = sectionWith(state, seat, 'move');
    const plans = planTurns(state, seat).plans.filter((p) => sectionOf(p) === move);
    for (const plan of plans) {
      const left = plan.state.resources[hex] ?? {};
      const all = (left.wood ?? 0) === 2 && (left.metal ?? 0) === 1;
      const none = !left.wood && !left.metal;
      // Spending them on a bottom-row action takes some away; leave those plans out.
      if (plan.actions.some((a) => a.type === 'pay' || a.type === 'payWithCard')) continue;
      expect(all || none, JSON.stringify(left)).toBe(true);
    }
    // ...and taking them along is one of the plans.
    expect(plans.some((p) => p.actions.some((a) => a.type === 'carryResource'))).toBe(true);
  });

  it('stops when the character reaches an encounter, before the card is chosen from', () => {
    const start = game();
    const seat = start.currentPlayer;
    const token = start.encounterTokens[0]!;
    const from = neighbors(start.setup.board, token).find((h) => start.setup.board.hexes[h]!.terrain !== 'lake' && !start.encounterTokens.includes(h))!;
    const state: GameState = { ...start, players: start.players.map((p, i) => (i === seat ? { ...p, character: from } : p)) };
    const plans = planTurns(state, seat).plans;
    const met = plans.filter((p) => p.stop === 'encounter');
    expect(met.length).toBeGreaterThan(0);
    for (const plan of met) {
      expect(plan.state.turn.step).toBe('encounter');
      expect(start.encounterTokens).toContain(plan.state.players[seat]!.character);
    }
    // From the encounter on, planning again finishes the turn.
    const again = planTurns(met[0]!.state, seat);
    expect(again.plans.length).toBeGreaterThan(0);
    expect(again.plans.every((p) => p.stop === 'endTurn')).toBe(true);
  });

  it('stops when a move starts a fight, and leaves fights themselves to the fighting code', () => {
    const start = game();
    const seat = start.currentPlayer;
    const enemy = 1 - seat;
    const at = start.players[seat]!.workers[0]!;
    const target = neighbors(start.setup.board, at).find((h) => start.setup.board.hexes[h]!.terrain !== 'lake')!;
    const state: GameState = {
      ...start,
      players: start.players.map((p, i) => (i === seat ? { ...p, character: at } : i === enemy ? { ...p, character: target } : p)),
    };
    const fights = planTurns(state, seat).plans.filter((p) => p.stop === 'combat');
    expect(fights.length).toBeGreaterThan(0);
    for (const plan of fights) {
      expect(plan.state.turn.step).toBe('combat');
      expect(planTurns(plan.state, seat).plans).toEqual([]);
    }
  });

  it('has nothing to plan for a seat that is not choosing, or once the game is over', () => {
    const start = game();
    expect(planTurns(start, 1 - start.currentPlayer).plans).toEqual([]);
    const seat = start.currentPlayer;
    const over: GameState = { ...start, players: start.players.map((p, i) => (i === seat ? { ...p, stars: Array(6).fill('combat') } : p)) };
    expect(planTurns(over, seat).plans).toEqual([]);
  });

  it('stops at the star that ends the game, mid-turn', () => {
    const start = game();
    const seat = start.currentPlayer;
    // One star short, with power one bolster away from the top.
    const state: GameState = { ...start, players: start.players.map((p, i) => (i === seat ? { ...p, stars: Array(5).fill('combat'), power: 15, coins: 5 } : p)) };
    const ending = planTurns(state, seat).plans.filter((p) => p.stop === 'gameOver');
    expect(ending.length).toBeGreaterThan(0);
    for (const plan of ending) expect(isGameOver(plan.state)).toBe(true);
  });

  it('gives up cleanly when it runs out of states to look at', () => {
    const start = game();
    const result = planTurns(start, start.currentPlayer, { maxNodes: 5 });
    expect(result.complete).toBe(false);
    for (const plan of result.plans) expect(replayPlan(start, plan)).toEqual(plan.state);
  });

  describe('with a beam', () => {
    const coins = (s: GameState) => s.players[s.currentPlayer]!.coins;

    it('looks at fewer turns, still in every section, each one legal', () => {
      const start = randomGame(3, 200);
      const seat = activeSeat(start);
      const full = planTurns(start, seat, { maxNodes: 5_000 });
      const beam = planTurns(start, seat, { beam: { width: 3, score: coins } });
      expect(beam.complete).toBe(false);
      expect(beam.plans.length).toBeLessThan(full.plans.length);
      const sections = (plans: TurnPlan[]) => new Set(plans.filter((p) => p.actions[0]?.type === 'chooseSection').map(sectionOf));
      expect(sections(beam.plans)).toEqual(new Set(legalActions(start, seat).filter((a) => a.type === 'chooseSection').map((a) => a.section)));
      for (const plan of beam.plans) expect(replayPlan(start, plan)).toEqual(plan.state);
    });

    it('in a hurry, narrows to one turn per section but still finishes plans in every section', () => {
      const start = randomGame(3, 200);
      const seat = activeSeat(start);
      const score = (s: GameState) => s.players[seat]!.coins + s.players[seat]!.power;
      const relaxed = planTurns(start, seat, { beam: { width: 6, score } });
      const hurried = planTurns(start, seat, { beam: { width: 6, score }, hurry: () => true });
      expect(hurried.plans.length).toBeGreaterThan(0);
      expect(hurried.plans.length).toBeLessThan(relaxed.plans.length);
      const sections = (plans: TurnPlan[]) => new Set(plans.filter((p) => p.actions[0]?.type === 'chooseSection').map(sectionOf));
      expect(sections(hurried.plans)).toEqual(sections(relaxed.plans));
    });

    it('keeps the best-scoring turns', () => {
      const start = game();
      const seat = start.currentPlayer;
      const best = Math.max(...planTurns(start, seat).plans.map((p) => p.state.players[seat]!.coins));
      const beam = planTurns(start, seat, { beam: { width: 1, score: (s) => s.players[seat]!.coins } });
      expect(Math.max(...beam.plans.map((p) => p.state.players[seat]!.coins))).toBe(best);
    });
  });

  it('fuzz: mid-game, every plan is legal and ends at a stop', () => {
    for (const [seed, turns] of [[1, 40], [2, 120], [4, 250], [5, 320]] as const) {
      let state = randomGame(seed, turns);
      // Plan from wherever the game is, even mid-turn (but not mid-fight).
      while (state.turn.step === 'combat' && !isGameOver(state)) state = applyAction(state, legalActions(state, activeSeat(state))[0]!);
      if (isGameOver(state)) continue;
      const seat = activeSeat(state);
      const { plans } = planTurns(state, seat, { beam: { width: 4, score: (s) => s.players[seat]!.coins + s.players[seat]!.power } });
      expect(plans.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const plan of plans) {
        expect(replayPlan(state, plan)).toEqual(plan.state);
        expect(['endTurn', 'combat', 'encounter', 'factoryCard', 'gameOver']).toContain(plan.stop);
      }
    }
  }, 60_000);
});
