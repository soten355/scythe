// The Factory: when a player's character ends its move on the Factory hex
// (and is still there after any fight), they look at one Factory card more
// than there are players, keep one and put the rest back under the deck.
// Each player gets one Factory card a game.
//
// The card is a fifth section beside their mat, picked like the others (not
// twice in a row). Its top part is "pay this to gain that": resources are
// paid one at a time from hexes the player controls (Coercion may stand in
// for one), then the rest of the cost is paid and the reward given, with any
// free bottom-row actions (no cost, coins or recruit bonuses). Its bottom part
// is a Move: so many units, each up to so many hexes (Speed adds to the
// character's and mechs'). There's no bottom row after it: the turn ends.
//
// A game whose setup has no Factory cards (one saved before the Factory
// existed) has no deck, so nothing happens there.
import type { HexId } from './board';
import { FACTORY, type Action, type GameState, type ResourcePile, type Section, type TurnStep } from './game';
import { hasRule } from './abilities';
import { applyEffect, effectOptions } from './bottom-actions';
import { drawCombatCards } from './combat';
import type { BottomActionType, Resource } from './mat';
import { shuffle } from './rng';
import { addResources, controlledHexes, gain, onBoard, toBottomRow, updatePlayer } from './state';
import { produce, yieldOf } from './top-actions';

export { FACTORY };

export interface FactoryCost {
  coins?: number;
  popularity?: number;
  power?: number;
  /** Paid from hexes the player controls. */
  resources?: ResourcePile;
  /** Combat cards of the player's choice, discarded from their hand. */
  combatCards?: number;
}

export interface FactoryGain {
  coins?: number;
  power?: number;
  popularity?: number;
  combatCards?: number;
  /** Produce on up to this many hexes with your workers on them (before any free actions); the card's cost stands in for Produce's own. */
  produce?: number;
  /** So many resources of the player's choice (any mix), all placed on one hex they control. */
  anyResources?: number;
  /** "Or": the player gets just one of the rewards listed (each amount, and each free action, is one choice). */
  oneOf?: boolean;
  /** Bottom-row actions taken for free, in this order. */
  actions?: BottomActionType[];
}

export interface FactoryCard {
  /** Neutral ID, e.g. "factory-01". */
  id: string;
  name: string;
  /** Top part: pay this to gain that. */
  cost: FactoryCost;
  gain: FactoryGain;
  /** Bottom part: move up to `units` units, each up to `hexes` hexes. */
  move: { units: number; hexes: number };
}

type FactoryStep = Extract<TurnStep, { step: 'factoryCard' | 'factoryTop' | 'factoryChoice' | 'factoryResources' | 'factoryProduce' | 'factoryRewards' }>;

const RESOURCES: Resource[] = ['oil', 'metal', 'wood', 'food'];

/** Shuffles the Factory deck, if the game has one. */
export function setupFactory(state: GameState): GameState {
  const cards = state.setup.factory ?? [];
  if (cards.length === 0) return { ...state, factoryDeck: [] };
  const [deck, rng] = shuffle(state.rng, cards.map((c) => c.id));
  return { ...state, rng, factoryDeck: deck };
}

export function factoryCard(state: GameState, id: string): FactoryCard {
  const card = state.setup.factory?.find((c) => c.id === id);
  if (!card) throw new Error(`no Factory card ${id}`);
  return card;
}

/** The Factory card a player holds, if any. */
export const heldFactoryCard = (state: GameState, seat: number): FactoryCard | undefined => {
  const id = state.players[seat]!.factoryCard;
  return id ? factoryCard(state, id) : undefined;
};

/** After the move, its fights and any encounter: Factory cards to choose from if the character stands on the Factory, else on to the bottom row. */
export function arriveAtFactory(state: GameState, section: Section): GameState {
  const seat = state.currentPlayer;
  const player = state.players[seat]!;
  const onFactory = state.setup.board.hexes[player.character]?.terrain === 'factory';
  if (!onFactory || player.factoryCard || state.factoryDeck.length === 0) return { ...state, turn: toBottomRow(section) };
  const offered = state.factoryDeck.slice(0, state.players.length + 1);
  return { ...state, turn: { step: 'factoryCard', section, offered } };
}

/** What's left to pay in resources: per kind, and in all (a combat card paid with Coercion covers any one). */
function owed(card: FactoryCard, paid: ResourcePile, coerced: boolean): { left: ResourcePile; total: number } {
  const left: ResourcePile = {};
  let total = coerced ? -1 : 0;
  for (const r of RESOURCES) {
    const n = (card.cost.resources?.[r] ?? 0) - (paid[r] ?? 0);
    if (n > 0) left[r] = n;
    total += Math.max(0, n);
  }
  return { left, total: Math.max(0, total) };
}

const available = (state: GameState, seat: number, r: Resource) =>
  [...controlledHexes(state, seat)].reduce((n, hex) => n + (state.resources[hex]?.[r] ?? 0), 0);

/** The combat card values that could be paid with Coercion now, lowest first. */
const coercionValues = (state: GameState, seat: number, coerced: boolean) =>
  coerced || !hasRule(state, seat, 'cardAsResource') ? [] : [...new Set(state.players[seat]!.combatCards)].sort((a, b) => a - b);

/** Combat cards still to pay for the card's cost. */
const cardsOwed = (card: FactoryCard, cardsPaid = 0) => Math.max(0, (card.cost.combatCards ?? 0) - cardsPaid);

/** Whether the rest of the top part's cost can still be paid. */
function canFinish(state: GameState, seat: number, card: FactoryCard, paid: ResourcePile, coerced: boolean, cardsPaid = 0): boolean {
  const p = state.players[seat]!;
  const { coins = 0, popularity = 0, power = 0 } = card.cost;
  if (p.coins < coins || p.popularity < popularity || p.power < power) return false;
  const cards = cardsOwed(card, cardsPaid);
  if (p.combatCards.length < cards) return false;
  const { left, total } = owed(card, paid, coerced);
  if (total === 0) return true;
  const short = RESOURCES.reduce((n, r) => n + Math.max(0, (left[r] ?? 0) - available(state, seat, r)), 0);
  // One combat card covers one missing resource: one already paid, or one that can still be (if one's left over after the cost's own cards).
  const cover = coerced || (coercionValues(state, seat, coerced).length && p.combatCards.length > cards) ? 1 : 0;
  return short <= cover;
}

/** What an "or" card offers: each amount it gives, and each free action, as a reward of its own. */
export function factoryOptions(gain: FactoryGain): FactoryGain[] {
  const amounts = (['coins', 'power', 'popularity', 'combatCards', 'produce', 'anyResources'] as const).filter((k) => gain[k]).map((k): FactoryGain => ({ [k]: gain[k] }));
  return [...amounts, ...(gain.actions ?? []).map((a): FactoryGain => ({ actions: [a] }))];
}

/** Whether a reward would do anything now (a free action with nothing left to do it with, say, wouldn't). */
function worthTaking(state: GameState, g: FactoryGain): boolean {
  if (g.actions?.length) return g.actions.some((a) => effectOptions(state, a).length > 0);
  if (g.produce) return produceHexes(state, []).length > 0;
  if (g.anyResources) return resourceHexes(state).length > 0;
  return true;
}

/** Hexes the current player controls that resources can be put on (not a lake). */
const resourceHexes = (state: GameState): HexId[] =>
  [...controlledHexes(state, state.currentPlayer)].filter((hex) => state.setup.board.hexes[hex]?.terrain !== 'lake');

export function factoryActions(state: GameState, turn: FactoryStep): Action[] {
  const seat = state.currentPlayer;
  switch (turn.step) {
    case 'factoryCard':
      return turn.offered.map((card): Action => ({ type: 'takeFactoryCard', card }));
    case 'factoryRewards':
      return effectOptions(state, turn.todo[0]!);
    case 'factoryChoice': {
      const options = factoryOptions(heldFactoryCard(state, seat)!.gain);
      return options.flatMap((g, option): Action[] => (worthTaking(state, g) ? [{ type: 'factoryChoose', option }] : []));
    }
    case 'factoryResources':
      if (!turn.hex) return resourceHexes(state).map((hex): Action => ({ type: 'factoryResourceHex', hex }));
      return RESOURCES.map((resource): Action => ({ type: 'factoryResource', resource }));
    case 'factoryProduce':
      return [...produceHexes(state, turn.produced).map((hex): Action => ({ type: 'produce', hex })), { type: 'endProduce' }];
    case 'factoryTop': {
      const card = heldFactoryCard(state, seat)!;
      const started = Object.keys(turn.paid).length > 0 || !!turn.coerced || !!turn.cardsPaid;
      const skip: Action[] = started ? [] : [{ type: 'skipTop' }];
      if (!canFinish(state, seat, card, turn.paid, !!turn.coerced, turn.cardsPaid)) return skip;
      const { left, total } = owed(card, turn.paid, !!turn.coerced);
      const cards = cardsOwed(card, turn.cardsPaid);
      if (total === 0 && cards === 0) return [{ type: 'factoryUse' }];
      const pays: Action[] = [];
      if (cards > 0) {
        for (const value of [...new Set(state.players[seat]!.combatCards)].sort((a, b) => a - b)) pays.push({ type: 'factoryPayCard', value });
      }
      for (const hex of controlledHexes(state, seat)) {
        for (const resource of RESOURCES) {
          if (left[resource] && (state.resources[hex]?.[resource] ?? 0) > 0) pays.push({ type: 'factoryPay', hex, resource });
        }
      }
      // Coercion, for a resource, only with a card to spare beyond the ones the cost asks for.
      const coercion = total > 0 && state.players[seat]!.combatCards.length > cards ? coercionValues(state, seat, !!turn.coerced) : [];
      return [...pays, ...coercion.map((value): Action => ({ type: 'payWithCard', value })), ...skip];
    }
  }
}

export function applyFactory(state: GameState, turn: FactoryStep, action: Action): GameState {
  const seat = state.currentPlayer;
  switch (action.type) {
    case 'takeFactoryCard': {
      const { offered } = turn as Extract<FactoryStep, { step: 'factoryCard' }>;
      const rest = state.factoryDeck.slice(offered.length);
      const next = updatePlayer(state, seat, { factoryCard: action.card });
      return { ...next, factoryDeck: [...rest, ...offered.filter((c) => c !== action.card)], turn: toBottomRow((turn as { section: Section }).section) };
    }
    case 'skipTop':
      return toMove(state);
    case 'factoryPay': {
      const t = turn as Extract<FactoryStep, { step: 'factoryTop' }>;
      const paid = { ...t.paid, [action.resource]: (t.paid[action.resource] ?? 0) + 1 };
      return { ...addResources(state, action.hex as HexId, action.resource, -1), turn: { ...t, paid } };
    }
    case 'factoryPayCard': {
      const t = turn as Extract<FactoryStep, { step: 'factoryTop' }>;
      const hand = [...state.players[seat]!.combatCards];
      hand.splice(hand.indexOf(action.value), 1);
      const next = updatePlayer({ ...state, combatDiscard: [...state.combatDiscard, action.value] }, seat, { combatCards: hand });
      return { ...next, turn: { ...t, cardsPaid: (t.cardsPaid ?? 0) + 1 } };
    }
    case 'payWithCard': {
      const hand = [...state.players[seat]!.combatCards];
      hand.splice(hand.indexOf(action.value), 1);
      const next = updatePlayer({ ...state, combatDiscard: [...state.combatDiscard, action.value] }, seat, { combatCards: hand });
      return { ...next, turn: { ...(turn as Extract<FactoryStep, { step: 'factoryTop' }>), coerced: true } };
    }
    case 'factoryUse': {
      const { cost, gain: g } = heldFactoryCard(state, seat)!;
      const p = state.players[seat]!;
      let next = updatePlayer(state, seat, {
        coins: p.coins - (cost.coins ?? 0),
        popularity: p.popularity - (cost.popularity ?? 0),
        power: p.power - (cost.power ?? 0),
      });
      if (g.oneOf) return { ...next, turn: { step: 'factoryChoice', section: FACTORY } };
      return give(next, g);
    }
    case 'factoryChoose':
      return give(state, factoryOptions(heldFactoryCard(state, seat)!.gain)[action.option]!);
    case 'factoryResourceHex':
      return { ...state, turn: { ...(turn as Extract<FactoryStep, { step: 'factoryResources' }>), hex: action.hex } };
    case 'factoryResource': {
      const t = turn as Extract<FactoryStep, { step: 'factoryResources' }>;
      const next = addResources(state, t.hex!, action.resource, 1);
      if (t.left > 1) return { ...next, turn: { ...t, left: t.left - 1 } };
      return producing(next, t.then.produce, [], t.then.actions);
    }
    case 'produce': {
      const t = turn as Extract<FactoryStep, { step: 'factoryProduce' }>;
      return producing(produce(state, seat, action.hex), t.left - 1, [...t.produced, action.hex], t.todo);
    }
    case 'endProduce':
      return rewards(state, (turn as Extract<FactoryStep, { step: 'factoryProduce' }>).todo);
    case 'upgrade':
    case 'deploy':
    case 'build':
    case 'enlist':
      return rewards(applyEffect(state, seat, action), (turn as Extract<FactoryStep, { step: 'factoryRewards' }>).todo.slice(1));
    default:
      throw new Error(`unreachable: ${action.type} at the Factory`);
  }
}

/** Gives a reward (the whole top part, or the one picked on an "or" card): amounts, then resources, producing and free actions, in that order. */
function give(state: GameState, g: FactoryGain): GameState {
  const seat = state.currentPlayer;
  const { coins, power, popularity } = g;
  let next = updatePlayer(state, seat, gain(state.players[seat]!, { coins, power, popularity }));
  if (g.combatCards) next = drawCombatCards(next, seat, g.combatCards);
  const then = { produce: g.produce ?? 0, actions: [...(g.actions ?? [])] };
  if (g.anyResources && resourceHexes(next).length) return { ...next, turn: { step: 'factoryResources', section: FACTORY, left: g.anyResources, then } };
  return producing(next, then.produce, [], then.actions);
}

/** Hexes with the current player's workers that would produce something and haven't yet this turn. */
function produceHexes(state: GameState, produced: HexId[]): HexId[] {
  const player = state.players[state.currentPlayer]!;
  return [...new Set(onBoard(player.workers))].filter((hex) => !produced.includes(hex) && yieldOf(state, player, hex));
}

/** Producing on up to `left` more hexes (skipped when there's nothing to produce on), then the free actions. */
function producing(state: GameState, left: number, produced: HexId[], todo: BottomActionType[]): GameState {
  if (left > 0 && produceHexes(state, produced).length) return { ...state, turn: { step: 'factoryProduce', section: FACTORY, left, produced, todo } };
  return rewards(state, todo);
}

/** Free actions still to take (skipping any there's nothing left to do for), then the card's move. */
function rewards(state: GameState, todo: BottomActionType[]): GameState {
  const left = [...todo];
  while (left.length && effectOptions(state, left[0]!).length === 0) left.shift();
  if (left.length) return { ...state, turn: { step: 'factoryRewards', section: FACTORY, todo: left } };
  return toMove(state);
}

const toMove = (state: GameState): GameState => ({ ...state, turn: { step: 'top', section: FACTORY } });

const ACTIONS: BottomActionType[] = ['upgrade', 'deploy', 'build', 'enlist'];

/** What's wrong with a Factory card, in plain words; empty when it's fine. */
export function validateFactoryCard(card: FactoryCard): string[] {
  const problems: string[] = [];
  const amount = (n: unknown) => n === undefined || (typeof n === 'number' && Number.isInteger(n) && n >= 0);
  const atLeastOne = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1;
  if (!card.name?.trim()) problems.push('name is missing');
  if (!card.id?.trim()) problems.push('ID is missing');
  const cost = card.cost ?? {};
  const gain = card.gain ?? {};
  if (![cost.coins, cost.popularity, cost.power, cost.combatCards, ...Object.values(cost.resources ?? {})].every(amount)) problems.push('its cost must be whole numbers of 0 or more');
  if (Object.keys(cost.resources ?? {}).some((r) => !RESOURCES.includes(r as Resource))) problems.push('its cost has an unknown resource');
  if (![gain.coins, gain.power, gain.popularity, gain.combatCards, gain.produce, gain.anyResources].every(amount)) problems.push('its rewards must be whole numbers of 0 or more');
  else if (gain.oneOf && factoryOptions(gain).length < 2) problems.push('"one of" needs at least two rewards to choose from');
  if ((gain.actions ?? []).some((a) => !ACTIONS.includes(a))) problems.push('it gives an unknown action');
  if (!atLeastOne(card.move?.units) || !atLeastOne(card.move?.hexes)) problems.push('its move must be at least 1 unit, at least 1 hex');
  return problems;
}
