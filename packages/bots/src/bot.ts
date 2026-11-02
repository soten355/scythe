// The planning bot: a seat that plays the real game by trying out whole
// turns (the planner) and keeping the best by the position score. It plans
// from its view of the game, so it never sees what the player couldn't.
//
// It plans when its turn starts, then plays the plan out one action at a
// time; where the plan stops (a fight, an encounter card, Factory cards) it
// plans again from what it then sees. Fights use a stand-in rule for now
// (fights get their own thinking, with bluffing, in a later step).
import { activeSeat, applyLegal, type Action, type GameState, type Seat } from '@scythe/engine';
import { planTurns } from './planner';
import { DEFAULT_WEIGHTS, positionScore, type Weights } from './score';

export interface BotOptions {
  /** How many unfinished turns of each section the planner keeps at each step: more is stronger but slower. */
  width?: number;
  weights?: Weights;
}

/** Actions compare equal whatever order their fields were written in. */
const same = (a: Action, b: Action) => canonical(a) === canonical(b);
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_k, v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));

export function planningBot(options: BotOptions = {}): Seat {
  const width = options.width ?? 8;
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  /** The rest of the current plan, and the turn it was made for. */
  let queue: Action[] = [];
  let planFor = -1;

  return {
    async chooseAction(view, legal) {
      return choose(view, legal);
    },
  };

  function choose(view: GameState, legal: Action[]): Action {
    if (legal.length === 1) {
      if (queue[0] && same(queue[0], legal[0]!)) queue.shift();
      return legal[0]!;
    }
    const seat = activeSeat(view);
    if (view.turn.step === 'combat') {
      queue = [];
      return fightAction(view, seat, legal, weights);
    }
    // Carry on with the plan while it still fits; otherwise plan afresh.
    if (planFor === view.turnsTaken && queue[0] && legal.some((a) => same(a, queue[0]!))) return queue.shift()!;
    const { plans } = planTurns(view, seat, { beam: { width, score: (s) => positionScore(s, seat, weights) } });
    if (plans.length === 0) return legal[0]!;
    let best = plans[0]!;
    let bestScore = -Infinity;
    for (const plan of plans) {
      const s = positionScore(plan.state, seat, weights);
      if (s > bestScore) [best, bestScore] = [plan, s];
    }
    queue = [...best.actions];
    planFor = view.turnsTaken;
    const first = queue.shift()!;
    return legal.find((a) => same(a, first)) ?? legal[0]!;
  }
}

/**
 * A stand-in for fighting, until fights get their own thinking: retreat
 * wherever scores best, use abilities before the dials, add the best card
 * the fight allows, then dial half its power (rounded up).
 */
function fightAction(view: GameState, seat: number, legal: Action[], weights: Weights): Action {
  const turn = view.turn;
  if (turn.step !== 'combat') return legal[0]!;
  if (legal[0]!.type === 'retreat' || legal[0]!.type === 'fight') {
    return legal.reduce((a, b) => (scoreAfter(view, seat, b, weights) > scoreAfter(view, seat, a, weights) ? b : a));
  }
  const use = legal.find((a) => a.type === 'beforeCombat' && a.use);
  if (use) return use;
  const side = turn.fight && (turn.fight.attacker.seat === seat ? turn.fight.attacker : turn.fight.defender);
  const card = legal.find((a) => a.type === 'combatCard');
  if (card && side && side.cards.length === 0) return card;
  const dials = legal.filter((a): a is Extract<Action, { type: 'combatPower' }> => a.type === 'combatPower');
  const want = Math.ceil(view.players[seat]!.power / 2);
  return dials.reduce((a, b) => (Math.abs(b.power - want) < Math.abs(a.power - want) ? b : a), dials[0]!) ?? legal[0]!;
}

/** The score after one action, for choices that need no planning (which fight first, where to retreat). */
const scoreAfter = (view: GameState, seat: number, action: Action, weights: Weights): number => positionScore(applyLegal(view, action), seat, weights);
