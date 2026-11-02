// Fights: how a bot chooses its combat cards and power dial, and how it
// judges a move that starts a fight.
//
// A bot can't see the other side's cards (or, as the defender, the
// attacker's locked-in choice). So it imagines them: it deals the other
// player a hand from the cards it hasn't seen (the deck less its own hand
// and the face-up discards), guesses their dial, and plays the fight out in
// the engine. Over many such guesses, each way it could fight (how many of
// its best cards, how much power) gets an average score, the position score
// after the fight. A win that costs too much, or that places a sixth star
// while behind (losing the game), scores badly on its own.
//
// It doesn't always take the very best: it picks among the good choices at
// random, the closer to the best the likelier (so it can't be read). And it
// guesses the other side's dial by its boldness: a careful bot expects them
// to dial high, a bold one doesn't.
import { applyLegal, COMBAT_DECK, MAX_DIAL, maxCombatCards, nextInt, type Action, type Fight, type GameState, type RngState } from '@scythe/engine';
import { positionScore, type Weights } from './score';

export interface FightThinking {
  weights: Weights;
  /** 0-1, from the personality: how high it expects the other side to dial (careful: high). */
  boldness: number;
  /** How many imagined hands and dials each choice is tried against. */
  samples: number;
  /** How far from the best (in score) a choice can be and still be picked sometimes. 0: always the best. */
  spread: number;
}

/** One way to fight: how many of its best cards to add, and the power to dial. */
interface Choice {
  cards: number[];
  power: number;
}

/** The actions for a fight choice, in the order the engine takes them: cards one at a time, then the dial. */
const actionsOf = (c: Choice): Action[] => [...c.cards.map((value): Action => ({ type: 'combatCard', value })), { type: 'combatPower', power: c.power }];

/**
 * The bot's whole choice for its side of the fight now under way, as
 * actions (the first is legal now), with the random state after picking.
 */
export function chooseFight(view: GameState, seat: number, think: FightThinking, rng: RngState): [Action[], RngState] {
  const fight = fightOf(view);
  if (!fight) return [[], rng];
  const options = choices(view, seat, fight);
  const scored: { choice: Choice; score: number }[] = [];
  for (const choice of options) {
    let total = 0;
    let r = rng;
    for (let i = 0; i < think.samples; i++) {
      let s: number;
      [s, r] = playOut(view, seat, choice, think, r);
      total += s;
    }
    scored.push({ choice, score: total / think.samples });
  }
  [, rng] = nextInt(rng, 2 ** 30);
  const [pick, next] = pickNearBest(scored, think.spread, rng);
  return [actionsOf(pick.choice), next];
}

/** A plan's state that stops as a fight starts, scored by the fight's likely outcome (fewer guesses, the bot's best choice). */
export function expectedFightScore(state: GameState, seat: number, think: FightThinking, rng: RngState): number {
  let view = state;
  // Several fights: the attacker picks which comes first; try the first offered.
  if (view.turn.step === 'combat' && !view.turn.fight && !view.turn.retreat && view.turn.left.length) view = applyLegal(view, { type: 'fight', hex: view.turn.left[0]! });
  // Abilities before the dials: take them.
  while (view.turn.step === 'combat' && view.turn.fight?.before.length) view = applyLegal(view, { type: 'beforeCombat', use: true });
  const fight = fightOf(view);
  if (!fight || (fight.attacker.seat !== seat && fight.defender.seat !== seat)) return positionScore(view, seat, think.weights);
  let best = -Infinity;
  for (const choice of choices(view, seat, fight, true)) {
    let total = 0;
    let r = rng;
    for (let i = 0; i < think.samples; i++) {
      let s: number;
      [s, r] = playOut(view, seat, choice, think, r);
      total += s;
    }
    best = Math.max(best, total / think.samples);
  }
  return best;
}

const fightOf = (state: GameState): Fight | null => (state.turn.step === 'combat' && !state.turn.retreat && !state.turn.fight?.before.length ? state.turn.fight : null);

/**
 * The ways to fight: its best 0, 1, ... cards (as many as the fight allows;
 * a lower card in place of a higher one never helps), each with every dial.
 * `coarse`: only no power, half and all of it, for judging plans quickly.
 */
function choices(view: GameState, seat: number, fight: Fight, coarse = false): Choice[] {
  const side = fight.attacker.seat === seat ? fight.attacker : fight.defender;
  const legal = legalCardsAndDial(view, seat, fight);
  const hand = [...view.players[seat]!.combatCards].sort((a, b) => b - a);
  for (const c of side.cards) hand.splice(hand.indexOf(c), 1);
  const cardCounts = Array.from({ length: Math.min(hand.length, legal.cards) + 1 }, (_, n) => n);
  const maxDial = legal.dial;
  const dials = coarse ? [...new Set([0, Math.ceil(maxDial / 2), maxDial])] : Array.from({ length: maxDial + 1 }, (_, d) => d);
  return cardCounts.flatMap((n) => dials.map((power) => ({ cards: hand.slice(0, n), power })));
}

/** How many more cards this side may add, and the highest dial it can set. */
function legalCardsAndDial(view: GameState, seat: number, fight: Fight): { cards: number; dial: number } {
  const side = fight.attacker.seat === seat ? fight.attacker : fight.defender;
  return { cards: Math.max(0, maxCombatCards(view, seat, fight.hex) - side.cards.length), dial: Math.min(MAX_DIAL, view.players[seat]!.power) };
}

/**
 * One imagined fight: deals the other side a hand from the unseen cards,
 * fills in their choice (already made, as the defender sees it; or still to
 * make), plays the fight in the engine and scores the result.
 */
function playOut(view: GameState, seat: number, choice: Choice, think: FightThinking, rng: RngState): [number, RngState] {
  const fight = fightOf(view)!;
  const meAttacking = fight.attacker.seat === seat;
  const other = meAttacking ? fight.defender.seat : fight.attacker.seat;
  let state: GameState;
  [state, rng] = dealHidden(view, seat, other, rng);
  // The other side's choice, guessed: as the defender, the attacker's is already locked in.
  let theirs: Choice;
  [theirs, rng] = guess(state, other, fight, think.boldness, rng);
  if (!meAttacking) {
    const f = (state.turn as { fight: Fight }).fight;
    // Their cards were shown as hidden; give them the guessed values (and the hand to match).
    // Their best cards, as many as they showed (the dealt hand holds them, as the engine expects when they're discarded).
    const cards = [...state.players[other]!.combatCards].sort((a, b) => b - a).slice(0, f.attacker.cards.length);
    state = { ...state, turn: { ...(state.turn as Extract<GameState['turn'], { step: 'combat' }>), fight: { ...f, attacker: { ...f.attacker, cards, power: Math.min(theirs.power, state.players[other]!.power) } } } };
  }
  for (const a of actionsOf(choice)) {
    if (fightOf(state)?.[meAttacking ? 'attacker' : 'defender'].power !== null) break;
    state = applyLegal(state, a);
  }
  if (meAttacking && fightOf(state)) {
    // The defender answers.
    for (const a of actionsOf(theirs)) {
      if (!fightOf(state) || fightOf(state)!.defender.power !== null) break;
      state = applyLegal(state, a);
    }
  }
  return [positionScore(state, seat, think.weights), rng];
}

/** Gives the other player a hand of unseen cards (as many as they hold), drawn at random. */
function dealHidden(view: GameState, seat: number, other: number, rng: RngState): [GameState, RngState] {
  const pool = unseenCards(view, seat);
  const hand: number[] = [];
  for (let i = 0; i < view.players[other]!.combatCards.length; i++) {
    let k: number;
    [k, rng] = nextInt(rng, Math.max(1, pool.length));
    hand.push(pool.length ? pool.splice(k, 1)[0]! : 2);
  }
  return [withHand(view, other, hand), rng];
}

const withHand = (state: GameState, seat: number, hand: number[]): GameState => ({
  ...state,
  players: state.players.map((p, i) => (i === seat ? { ...p, combatCards: hand } : p)),
});

/** Combat cards this seat hasn't seen: the whole deck, less its own hand and the face-up discards. */
export function unseenCards(view: GameState, seat: number): number[] {
  const pool = [...COMBAT_DECK];
  for (const c of [...view.players[seat]!.combatCards, ...view.combatDiscard]) {
    const i = pool.indexOf(c);
    if (i >= 0) pool.splice(i, 1);
  }
  return pool;
}

/**
 * A guess at the other side's choice: their best cards (as many as the
 * fight allows) and a dial from 0 to the most they can, weighted toward
 * high by how careful this bot is.
 */
function guess(state: GameState, other: number, fight: Fight, boldness: number, rng: RngState): [Choice, RngState] {
  const { cards, dial } = legalCardsAndDial(state, other, fight);
  const hand = [...state.players[other]!.combatCards].sort((a, b) => b - a).slice(0, cards);
  const tilt = 2 - 2 * boldness;
  const weights = Array.from({ length: dial + 1 }, (_, d) => (1 + d) ** tilt);
  let roll: number;
  [roll, rng] = nextInt(rng, 1_000_000);
  let x = (roll / 1_000_000) * weights.reduce((a, b) => a + b, 0);
  let power = 0;
  for (; power < dial && x >= weights[power]!; power++) x -= weights[power]!;
  return [{ cards: hand, power }, rng];
}

/** Picks one of the choices: the best always in the running, others the likelier the closer they score to it. */
function pickNearBest<T extends { score: number }>(scored: T[], spread: number, rng: RngState): [T, RngState] {
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
  if (spread <= 0) return [best, rng];
  const weights = scored.map((s) => Math.max(0, 1 - (best.score - s.score) / spread));
  let roll: number;
  [roll, rng] = nextInt(rng, 1_000_000);
  let x = (roll / 1_000_000) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < scored.length; i++) {
    if (x < weights[i]!) return [scored[i]!, rng];
    x -= weights[i]!;
  }
  return [best, rng];
}
