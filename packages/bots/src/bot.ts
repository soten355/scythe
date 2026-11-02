// The planning bot: a seat that plays the real game by trying out whole
// turns (the planner) and keeping the best by the position score. It plans
// from its view of the game, so it never sees what the player couldn't.
//
// It plans when its turn starts, then plays the plan out one action at a
// time; where the plan stops (a fight, an encounter card, Factory cards) it
// plans again from what it then sees. Fights are thought through in
// fight.ts: a plan that starts one is judged by the fight's likely outcome,
// and in the fight it picks its cards and dial against imagined hands.
//
// Unless told otherwise, it plays with its faction's personality
// (personalities.ts), found from the game the first time it's asked.
//
// Difficulty (LEVELS) changes only how well it thinks, never its
// personality: how many turns it keeps while planning, how carefully it
// picks among them (Easy settles for good enough), how many imagined hands
// it tries in a fight, and whether it looks ahead to its next turn (Hard).
import { activeSeat, applyLegal, nextInt, seedRng, type Action, type GameState, type RngState, type Seat } from '@scythe/engine';
import { chooseFight, expectedFightScore, type FightThinking } from './fight';
import { planTurns, type TurnPlan } from './planner';
import { BALANCED, personalityFor, weightsOf, type Personality } from './personalities';
import { positionScore, type Weights } from './score';

export type Level = 'easy' | 'medium' | 'hard';

/** How each difficulty thinks (any of it can be overridden in BotOptions). */
export interface Thinking {
  /** How many unfinished turns of each section the planner keeps at each step: more is stronger but slower. */
  width: number;
  /** How far below its best turn (in score) a turn can be and still be picked sometimes. 0: always the best. */
  slack: number;
  /** How many imagined hands each fight choice is tried against. */
  fightSamples: number;
  /** How far from its best fight choice (in score) it may stray, to be hard to read. 0: never. */
  bluff: number;
  /** Its few best turns also get its next turn planned, and count what that sets up (0: no looking ahead). */
  lookahead: number;
}

export const LEVELS: Record<Level, Thinking> = {
  easy: { width: 3, slack: 6, fightSamples: 4, bluff: 3, lookahead: 0 },
  medium: { width: 6, slack: 1.5, fightSamples: 8, bluff: 1.5, lookahead: 0 },
  hard: { width: 10, slack: 0, fightSamples: 16, bluff: 1.5, lookahead: 4 },
};

/** How much what a turn sets up for the next one counts, against what it gets now. */
const NEXT_TURN = 0.6;

export interface BotOptions extends Partial<Thinking> {
  /** Difficulty (the default: medium). */
  level?: Level;
  /** 'faction' (the default): its faction's personality; 'balanced': none in particular; or one given. */
  personality?: 'faction' | 'balanced' | Personality;
  /** Seeds its own randomness (its bluffing, imagined hands and Easy's slips), so games can be replayed. */
  seed?: number;
  /** The most a decision should take, in milliseconds (the default: 2000). Near it, the bot wraps up with the best it has. */
  timeLimit?: number;
  /** The clock it times itself by, in milliseconds (the default: performance.now). */
  clock?: () => number;
}

/** Shares of the time limit: planning this turn narrows down after this much, looking ahead stops after this much. */
const PLAN_SHARE = 0.6;
const LOOKAHEAD_SHARE = 0.85;

/** Actions compare equal whatever order their fields were written in. */
const same = (a: Action, b: Action) => canonical(a) === canonical(b);
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_k, v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));

export function planningBot(options: BotOptions = {}): Seat {
  const level = LEVELS[options.level ?? 'medium'];
  const { width, slack, fightSamples, bluff, lookahead } = { ...level, ...Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)) } as Thinking;
  const timeLimit = options.timeLimit ?? 2000;
  const clock = options.clock ?? (() => performance.now());
  /** When the decision under way started. */
  let started = 0;
  const past = (share: number) => () => clock() - started > share * timeLimit;
  const chosen = options.personality ?? 'faction';
  let personality: Personality | null = typeof chosen === 'object' ? chosen : chosen === 'balanced' ? BALANCED : null;
  let weights: Weights = personality ? weightsOf(personality) : weightsOf(BALANCED);
  let rng: RngState = seedRng(options.seed ?? 1);
  /** The rest of its choice in the fight under way. */
  let fightQueue: Action[] = [];
  const thinking = (samples: number, spread: number): FightThinking => ({ weights, boldness: personality!.boldness, samples, spread });
  /**
   * A plan's score. A plan that starts a fight is judged by how the fight is
   * likely to go: its score plus the fight's likely gain or loss. Plans that
   * start the same fight (same hex, units, power and cards) share that
   * gain or loss, worked out once (`fights`, fresh for each decision).
   */
  const planScore = (state: GameState, seat: number, stop: string, fights: Map<string, number>): number => {
    const now = positionScore(state, seat, weights);
    if (stop !== 'combat') return now;
    const key = fightKey(state);
    let gain = fights.get(key);
    if (gain === undefined && past(LOOKAHEAD_SHARE)()) return now;
    if (gain === undefined) {
      gain = expectedFightScore(state, seat, thinking(Math.max(3, fightSamples >> 2), 0), rng) - now;
      fights.set(key, gain);
    }
    return now + gain;
  };
  /** The rest of the current plan, and the turn it was made for. */
  let queue: Action[] = [];
  let planFor = -1;

  return {
    async chooseAction(view, legal) {
      return choose(view, legal);
    },
  };

  function choose(view: GameState, legal: Action[]): Action {
    // A fight's leftover choice never carries into the next one.
    if (view.turn.step !== 'combat' || !view.turn.fight) fightQueue = [];
    if (legal.length === 1) {
      if (fightQueue[0] && same(fightQueue[0], legal[0]!)) fightQueue.shift();
      if (queue[0] && same(queue[0], legal[0]!)) queue.shift();
      return legal[0]!;
    }
    const seat = activeSeat(view);
    started = clock();
    if (!personality) {
      personality = personalityFor(view.setup.players[seat]!.faction.id);
      weights = weightsOf(personality);
    }
    if (view.turn.step === 'combat') {
      queue = [];
      return fightAction(view, seat, legal);
    }
    // Carry on with the plan while it still fits; otherwise plan afresh.
    if (planFor === view.turnsTaken && queue[0] && legal.some((a) => same(a, queue[0]!))) return queue.shift()!;
    const { plans } = planTurns(view, seat, { beam: { width, score: (s) => positionScore(s, seat, weights) }, hurry: past(PLAN_SHARE) });
    if (plans.length === 0) return legal[0]!;
    const fights = new Map<string, number>();
    let scored = plans.map((plan) => ({ plan, score: planScore(plan.state, seat, plan.stop, fights) }));
    if (lookahead > 0) scored = lookAhead(scored, seat);
    let best: TurnPlan;
    [best, rng] = pick(scored, slack, rng);
    queue = [...best.actions];
    planFor = view.turnsTaken;
    const first = queue.shift()!;
    return legal.find((a) => same(a, first)) ?? legal[0]!;
  }

  /**
   * Its `lookahead` best turns that end its turn: plan its next turn from
   * each (as if the others changed nothing, with a narrow search), and count
   * part of what the best of those adds. So it sees, say, that gaining
   * power now lets it produce next turn.
   */
  function lookAhead(scored: { plan: TurnPlan; score: number }[], seat: number): { plan: TurnPlan; score: number }[] {
    const top = scored.filter((x) => x.plan.stop === 'endTurn').sort((a, b) => b.score - a.score).slice(0, lookahead);
    const hurry = past(LOOKAHEAD_SHARE);
    return scored.map((x) => {
      if (!top.includes(x) || hurry()) return x;
      const again: GameState = { ...x.plan.state, currentPlayer: seat, turn: { step: 'chooseSection' } };
      const next = planTurns(again, seat, { beam: { width: 3, score: (s) => positionScore(s, seat, weights) }, hurry }).plans;
      const follow = Math.max(x.score, ...next.map((p) => positionScore(p.state, seat, weights)));
      return { plan: x.plan, score: x.score + NEXT_TURN * (follow - x.score) };
    });
  }

  /**
   * In a fight: which fight first and where to retreat by the score after;
   * abilities before the dials if they help; then its cards and dial (chosen
   * once, then played out one action at a time).
   */
  function fightAction(view: GameState, seat: number, legal: Action[]): Action {
    if (fightQueue[0] && legal.some((a) => same(a, fightQueue[0]!))) return fightQueue.shift()!;
    fightQueue = [];
    const kind = legal[0]!.type;
    if (kind === 'retreat') return best(legal, (a) => positionScore(applyLegal(view, a), seat, weights));
    if (kind === 'fight' || kind === 'beforeCombat') return best(legal, (a) => expectedFightScore(applyLegal(view, a), seat, thinking(Math.max(3, fightSamples >> 2), 0), rng));
    let actions: Action[];
    [actions, rng] = chooseFight(view, seat, thinking(fightSamples, bluff), rng);
    const first = actions[0] && legal.find((a) => same(a, actions[0]!));
    if (!first) return legal[0]!;
    fightQueue = actions.slice(1);
    return first;
  }
}

/** The action that scores best. */
const best = (actions: Action[], score: (a: Action) => number): Action => {
  let top = actions[0]!;
  let topScore = -Infinity;
  for (const a of actions) {
    const s = score(a);
    if (s > topScore) [top, topScore] = [a, s];
  }
  return top;
};

/** What decides a fight about to start: where, and each side's fighting units, power and number of cards. */
function fightKey(state: GameState): string {
  const turn = state.turn;
  if (turn.step !== 'combat') return '';
  const hexes = turn.fight ? [turn.fight.hex, ...turn.left] : turn.left;
  return hexes
    .map((hex) =>
      [hex, ...state.players.map((p) => `${(p.character === hex ? 1 : 0) + p.mechs.filter((m) => m === hex).length}:${p.workers.filter((w) => w === hex).length}:${p.power}:${p.combatCards.length}`)].join('|'),
    )
    .join(';');
}

/** Picks a plan: the best, or with `slack`, any within that much of it, the closer the likelier. */
function pick(scored: { plan: TurnPlan; score: number }[], slack: number, rng: RngState): [TurnPlan, RngState] {
  const top = scored.reduce((a, b) => (b.score > a.score ? b : a));
  if (slack <= 0) return [top.plan, rng];
  const near = scored.filter((x) => x.score > top.score - slack);
  const weights = near.map((x) => 1 - (top.score - x.score) / slack);
  let roll: number;
  [roll, rng] = nextInt(rng, 1_000_000);
  let at = (roll / 1_000_000) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < near.length; i++) {
    if (at < weights[i]!) return [near[i]!.plan, rng];
    at -= weights[i]!;
  }
  return [top.plan, rng];
}
