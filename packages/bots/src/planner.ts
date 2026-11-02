// The turn planner: every distinct way a seat can play out the rest of its
// turn, as whole turns a bot can compare, built from the engine's small steps.
//
// A plan runs until the turn ends or something new comes into view: a fight
// (the other side has a say, and the dials are secret), an encounter card or
// Factory cards being drawn, or the game ending. The bot plans again from
// there, with what it then knows.
//
// Two simplifications keep the number of turns manageable without losing
// real choices:
// - A unit picks up all the resources on its hex or none, and drops off all
//   it carries or none (a mech picks up or drops off any number of workers).
// - Workers are interchangeable, and so are mechs: turns that put the same
//   units on the same hexes count once, whichever unit went where.
//
// Things a plan may show that the bot couldn't know yet: combat cards drawn
// along the way (bolster, recruit bonus, encounter reward). A position score
// should count them, not read their values.
import { activeSeat, applyLegal, isGameOver, legalActions, type Action, type GameState, type Location, type UnitRef } from '@scythe/engine';

/** Why a plan stops: the turn is over, or the bot has to look again before going on. */
export type PlanStop = 'endTurn' | 'combat' | 'encounter' | 'factoryCard' | 'gameOver';

export interface TurnPlan {
  /** The engine actions to take, in order, from the state planned from. */
  actions: Action[];
  /** The state once they're taken. */
  state: GameState;
  stop: PlanStop;
}

export interface PlanOptions {
  /** The most states to look at before stopping, plans or not (a safety net). */
  maxNodes?: number;
  /**
   * Keep only the most promising: after each step, the `width` best
   * unfinished turns of each section by `score` (higher is better) go on.
   * Without it every distinct turn is found, which late in a game can be
   * tens of thousands.
   */
  beam?: { width: number; score: (state: GameState) => number };
  /**
   * Called between steps: once it says time's up, the beam narrows to the
   * single best unfinished turn of each section, so the search wraps up
   * quickly with finished plans rather than stopping empty-handed.
   */
  hurry?: () => boolean;
}

export interface PlanResult {
  plans: TurnPlan[];
  /** Whether these are all the distinct plans there are (false when the beam or maxNodes left some out). */
  complete: boolean;
}

/** Steps that draw cards nobody has seen: a plan stops on reaching one. */
const REVEALS = new Set(['combat', 'encounter', 'factoryCard']);

interface Partial {
  state: GameState;
  actions: Action[];
}

/** Finds the seat's plans by growing turns one step at a time, all of them side by side. */
export function planTurns(start: GameState, seat: number, options: PlanOptions = {}): PlanResult {
  const maxNodes = options.maxNodes ?? 50_000;
  const plans: TurnPlan[] = [];
  if (start.turn.step === 'combat' || activeSeat(start) !== seat || isGameOver(start)) return { plans, complete: true };

  const seen = new Set<string>([stateKey(start)]);
  let frontier: Partial[] = [{ state: start, actions: [] }];
  let nodes = 0;
  let complete = true;
  while (frontier.length) {
    let next: Partial[] = [];
    for (const { state, actions } of frontier) {
      if (++nodes > maxNodes) return { plans, complete: false };
      for (const step of steps(state, seat)) {
        const key = stateKey(step.state);
        if (seen.has(key)) continue;
        seen.add(key);
        const path = [...actions, ...step.actions];
        const stop = stopOf(state, step.state, seat);
        if (stop) plans.push({ actions: path, state: step.state, stop });
        else next.push({ state: step.state, actions: path });
      }
    }
    if (options.beam) {
      const width = options.hurry?.() ? 1 : options.beam.width;
      const kept = keepBest(next, width, options.beam.score);
      if (kept.length < next.length) complete = false;
      next = kept;
    }
    frontier = next;
  }
  return { plans, complete };
}

/** The `width` best of each section (and of turns yet to choose one), best first. */
function keepBest(partials: Partial[], width: number, score: (state: GameState) => number): Partial[] {
  const bySection = new Map<string, { p: Partial; score: number }[]>();
  for (const p of partials) {
    const group = p.state.turn.step === 'chooseSection' ? 'none' : String(p.state.turn.section);
    const list = bySection.get(group) ?? [];
    list.push({ p, score: score(p.state) });
    bySection.set(group, list);
  }
  return [...bySection.values()].flatMap((list) => list.sort((a, b) => b.score - a.score).slice(0, width).map((x) => x.p));
}

function stopOf(before: GameState, after: GameState, seat: number): PlanStop | null {
  if (isGameOver(after)) return 'gameOver';
  if (after.currentPlayer !== seat) return 'endTurn';
  if (after.turn.step !== before.turn.step && REVEALS.has(after.turn.step)) return after.turn.step as PlanStop;
  return null;
}

interface Step {
  actions: Action[];
  state: GameState;
}

/** The seat's choices now, with picking up and dropping off grouped (see the top of this file). */
function steps(state: GameState, seat: number): Step[] {
  const legal = legalActions(state, seat);
  const out: Step[] = [];
  const grouped = new Set<string>();
  for (const action of legal) {
    switch (action.type) {
      case 'carryResource':
      case 'dropResource': {
        // All of them, one at a time.
        const id = `${action.type} ${unitId(action.unit)}`;
        if (grouped.has(id)) break;
        grouped.add(id);
        out.push(repeat(state, seat, (a) => a.type === action.type && sameUnit(a.unit, action.unit)));
        break;
      }
      case 'carryWorker':
      case 'dropWorker': {
        // 1, 2, ... of them: which ones doesn't matter.
        const id = `${action.type} ${unitId(action.unit)}`;
        if (grouped.has(id)) break;
        grouped.add(id);
        const match = (a: Action) => a.type === action.type && sameUnit(a.unit, action.unit);
        let step: Step = { actions: [], state };
        for (;;) {
          const next = legalActions(step.state, seat).filter(match).sort((a, b) => workerOf(a) - workerOf(b))[0];
          if (!next) break;
          step = { actions: [...step.actions, next], state: applyLegal(step.state, next) };
          out.push(step);
        }
        break;
      }
      default:
        out.push({ actions: [action], state: applyLegal(state, action) });
    }
  }
  return out;
}

/** Takes the first action matching, again and again, while there is one. */
function repeat(state: GameState, seat: number, match: (a: Action) => boolean): Step {
  const actions: Action[] = [];
  for (let a = legalActions(state, seat).find(match); a; a = legalActions(state, seat).find(match)) {
    actions.push(a);
    state = applyLegal(state, a);
  }
  return { actions, state };
}

const unitId = (u: UnitRef) => (u.kind === 'character' ? 'character' : `${u.kind}${u.index}`);
const sameUnit = (a: UnitRef, b: UnitRef) => unitId(a) === unitId(b);
const workerOf = (a: Action) => (a.type === 'carryWorker' || a.type === 'dropWorker' ? a.worker : 0);

/**
 * Identifies a state for spotting the same position reached two ways. The
 * setup never changes within a turn, so it's left out; mechs and workers are
 * described by where they are (and, mid-move, whether each has moved, is
 * carried or is the one walking), not by their number.
 */
export function stateKey(state: GameState): string {
  const { setup: _setup, players, turn, ...rest } = state;
  const units = (kind: 'mech' | 'worker', at: Location[]) =>
    at
      .map((loc, index) => {
        const unit: UnitRef = { kind, index };
        if (turn.step !== 'moving') return loc;
        const moved = turn.moved.some((m) => sameUnit(m, unit)) ? '*' : '';
        const carried = kind === 'worker' && turn.load?.workers.includes(index) ? '+' : '';
        const loading = turn.load && sameUnit(turn.load.unit, unit) ? '^' : '';
        const walking = turn.walking && sameUnit(turn.walking.unit, unit) ? '~' : '';
        return loc + moved + carried + loading + walking;
      })
      .sort();
  const mover = state.currentPlayer;
  const normalized = players.map((p, i) =>
    i === mover ? { ...p, mechs: units('mech', p.mechs), workers: units('worker', p.workers) } : { ...p, mechs: [...p.mechs].sort(), workers: [...p.workers].sort() },
  );
  let turnKey: unknown = turn;
  if (turn.step === 'moving') {
    // Which units have moved, carry or walk is in the unit lists above; only the character's part stays.
    const character: UnitRef = { kind: 'character' };
    turnKey = {
      step: turn.step,
      section: turn.section,
      character: [turn.moved.some((m) => sameUnit(m, character)), turn.load && sameUnit(turn.load.unit, character), turn.walking && sameUnit(turn.walking.unit, character)],
      resources: turn.load?.resources,
      left: turn.walking?.left,
    };
  } else if (turn.step === 'producing') {
    turnKey = { ...turn, produced: [...turn.produced].sort() };
  }
  return JSON.stringify([rest, normalized, turnKey]);
}
