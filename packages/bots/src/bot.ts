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
import { activeSeat, applyLegal, seedRng, type Action, type GameState, type RngState, type Seat } from '@scythe/engine';
import { chooseFight, expectedFightScore, type FightThinking } from './fight';
import { planTurns } from './planner';
import { BALANCED, personalityFor, weightsOf, type Personality } from './personalities';
import { positionScore, type Weights } from './score';

export interface BotOptions {
  /** How many unfinished turns of each section the planner keeps at each step: more is stronger but slower. */
  width?: number;
  /** 'faction' (the default): its faction's personality; 'balanced': none in particular; or one given. */
  personality?: 'faction' | 'balanced' | Personality;
  /** Seeds its own randomness (its bluffing and imagined hands), so games can be replayed. */
  seed?: number;
  /** How many imagined hands each fight choice is tried against. */
  fightSamples?: number;
  /** How far from its best fight choice (in score) it may stray, to be hard to read. 0: never. */
  bluff?: number;
}

/** Actions compare equal whatever order their fields were written in. */
const same = (a: Action, b: Action) => canonical(a) === canonical(b);
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_k, v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));

export function planningBot(options: BotOptions = {}): Seat {
  const width = options.width ?? 8;
  const chosen = options.personality ?? 'faction';
  let personality: Personality | null = typeof chosen === 'object' ? chosen : chosen === 'balanced' ? BALANCED : null;
  let weights: Weights = personality ? weightsOf(personality) : weightsOf(BALANCED);
  let rng: RngState = seedRng(options.seed ?? 1);
  /** The rest of its choice in the fight under way. */
  let fightQueue: Action[] = [];
  const thinking = (samples: number, spread: number): FightThinking => ({ weights, boldness: personality!.boldness, samples, spread });
  const fightSamples = options.fightSamples ?? 12;
  const bluff = options.bluff ?? 1.5;
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
    const { plans } = planTurns(view, seat, { beam: { width, score: (s) => positionScore(s, seat, weights) } });
    if (plans.length === 0) return legal[0]!;
    let best = plans[0]!;
    let bestScore = -Infinity;
    const fights = new Map<string, number>();
    for (const plan of plans) {
      const s = planScore(plan.state, seat, plan.stop, fights);
      if (s > bestScore) [best, bestScore] = [plan, s];
    }
    queue = [...best.actions];
    planFor = view.turnsTaken;
    const first = queue.shift()!;
    return legal.find((a) => same(a, first)) ?? legal[0]!;
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
