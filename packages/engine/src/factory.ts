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
import { addResources, controlledHexes, gain, toBottomRow, updatePlayer } from './state';

export { FACTORY };

export interface FactoryCost {
  coins?: number;
  popularity?: number;
  power?: number;
  /** Paid from hexes the player controls. */
  resources?: ResourcePile;
}

export interface FactoryGain {
  coins?: number;
  power?: number;
  popularity?: number;
  combatCards?: number;
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

type FactoryStep = Extract<TurnStep, { step: 'factoryCard' | 'factoryTop' | 'factoryRewards' }>;

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

/** Whether the rest of the top part's cost can still be paid. */
function canFinish(state: GameState, seat: number, card: FactoryCard, paid: ResourcePile, coerced: boolean): boolean {
  const p = state.players[seat]!;
  const { coins = 0, popularity = 0, power = 0 } = card.cost;
  if (p.coins < coins || p.popularity < popularity || p.power < power) return false;
  const { left, total } = owed(card, paid, coerced);
  if (total === 0) return true;
  const short = RESOURCES.reduce((n, r) => n + Math.max(0, (left[r] ?? 0) - available(state, seat, r)), 0);
  // One combat card covers one missing resource: one already paid, or one that can still be.
  const cover = coerced || coercionValues(state, seat, coerced).length ? 1 : 0;
  return short <= cover;
}

export function factoryActions(state: GameState, turn: FactoryStep): Action[] {
  const seat = state.currentPlayer;
  switch (turn.step) {
    case 'factoryCard':
      return turn.offered.map((card): Action => ({ type: 'takeFactoryCard', card }));
    case 'factoryRewards':
      return effectOptions(state, turn.todo[0]!);
    case 'factoryTop': {
      const card = heldFactoryCard(state, seat)!;
      const started = Object.keys(turn.paid).length > 0 || !!turn.coerced;
      const skip: Action[] = started ? [] : [{ type: 'skipTop' }];
      if (!canFinish(state, seat, card, turn.paid, !!turn.coerced)) return skip;
      const { left, total } = owed(card, turn.paid, !!turn.coerced);
      if (total === 0) return [{ type: 'factoryUse' }];
      const pays: Action[] = [];
      for (const hex of controlledHexes(state, seat)) {
        for (const resource of RESOURCES) {
          if (left[resource] && (state.resources[hex]?.[resource] ?? 0) > 0) pays.push({ type: 'factoryPay', hex, resource });
        }
      }
      const cards = coercionValues(state, seat, !!turn.coerced).map((value): Action => ({ type: 'payWithCard', value }));
      return [...pays, ...cards, ...skip];
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
      next = updatePlayer(next, seat, gain(next.players[seat]!, g));
      if (g.combatCards) next = drawCombatCards(next, seat, g.combatCards);
      return rewards(next, [...(g.actions ?? [])]);
    }
    case 'upgrade':
    case 'deploy':
    case 'build':
    case 'enlist':
      return rewards(applyEffect(state, seat, action), (turn as Extract<FactoryStep, { step: 'factoryRewards' }>).todo.slice(1));
    default:
      throw new Error(`unreachable: ${action.type} at the Factory`);
  }
}

/** Free actions still to take (skipping any there's nothing left to do for), then the card's move. */
function rewards(state: GameState, todo: BottomActionType[]): GameState {
  const left = [...todo];
  while (left.length && effectOptions(state, left[0]!).length === 0) left.shift();
  if (left.length) return { ...state, turn: { step: 'factoryRewards', section: FACTORY, todo: left } };
  return toMove(state);
}

const toMove = (state: GameState): GameState => ({ ...state, turn: { step: 'top', section: FACTORY } });
