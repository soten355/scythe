// Encounters: when a player's character ends its move on a hex with an
// encounter token (and is still there after any fight), they draw an
// encounter card and take one of its three options, paying its cost if it
// has one. The token is then gone for the rest of the game, and the card goes
// to a discard pile (shuffled into a new deck if the deck ever runs out).
//
// An option can give coins, power, popularity and combat cards; workers and
// resources, which go on the encounter's hex; and bottom-row actions taken
// for free, as usual but with no cost, no coins and no recruit bonuses.
// Meander (Polonia) takes up to two different options of the same card.
//
// A game whose setup has no encounter cards (one saved before encounters
// existed) has no tokens either, so nothing happens.
import type { HexId } from './board';
import type { Action, GameState, ResourcePile, SectionIndex, TurnStep } from './game';
import { rulesOfKind } from './abilities';
import { applyEffect, effectOptions } from './bottom-actions';
import { drawCombatCards } from './combat';
import type { BottomActionType, Resource } from './mat';
import { shuffle } from './rng';
import { addResources, gain, MAX_WORKERS, updatePlayer } from './state';

export interface EncounterCost {
  coins?: number;
  popularity?: number;
  power?: number;
}

export interface EncounterGain {
  coins?: number;
  power?: number;
  popularity?: number;
  combatCards?: number;
  /** Resources put on the encounter's hex. */
  resources?: ResourcePile;
  /** Resources of the player's choice, picked one at a time, put on the encounter's hex. */
  anyResources?: number;
  /** New workers on the encounter's hex (never more than 8 in all). */
  workers?: number;
  /** Bottom-row actions taken for free, in this order. */
  actions?: BottomActionType[];
}

export interface EncounterOption {
  /** In our own words, never the published card text. */
  text: string;
  cost: EncounterCost;
  gain: EncounterGain;
}

export interface EncounterCard {
  /** Neutral ID, e.g. "base-01". */
  id: string;
  name: string;
  /** A line or two of our own flavor text, shown above the options. */
  story: string;
  options: [EncounterOption, EncounterOption, EncounterOption];
}

type EncounterStep = Extract<TurnStep, { step: 'encounter' }>;

/** What's still to do for the options taken: choose resources, or take a free bottom-row action. */
export type EncounterTask = { kind: 'resources'; left: number } | { kind: BottomActionType };

const RESOURCES: Resource[] = ['oil', 'metal', 'wood', 'food'];

/** Encounter hexes get tokens only when the game has encounter cards. */
export function setupEncounters(state: GameState): GameState {
  const cards = state.setup.encounters ?? [];
  if (cards.length === 0) return { ...state, encounterTokens: [], encounterDeck: [], encounterDiscard: [] };
  const [deck, rng] = shuffle(state.rng, cards.map((c) => c.id));
  const tokens = Object.values(state.setup.board.hexes).filter((h) => h.encounter).map((h) => h.id);
  return { ...state, rng, encounterTokens: tokens, encounterDeck: deck, encounterDiscard: [] };
}

export function encounterCard(state: GameState, id: string): EncounterCard {
  const card = state.setup.encounters?.find((c) => c.id === id);
  if (!card) throw new Error(`no encounter card ${id}`);
  return card;
}

/** How many options a player may take from one card (Meander: two). */
export const optionLimit = (state: GameState, seat: number): number =>
  Math.max(1, ...rulesOfKind(state, seat, 'encounterOptions').map((r) => r.count));

export const canPay = (state: GameState, seat: number, cost: EncounterCost): boolean => {
  const p = state.players[seat]!;
  return p.coins >= (cost.coins ?? 0) && p.popularity >= (cost.popularity ?? 0) && p.power >= (cost.power ?? 0);
};

/** Called once the move and its fights are over: an encounter if the character stands on a token, else on to the bottom row. */
export function afterFights(state: GameState, section: SectionIndex): GameState {
  const hex = state.players[state.currentPlayer]!.character;
  if (!state.encounterTokens.includes(hex)) return { ...state, turn: { step: 'bottom', section, paid: 0 } };
  let { encounterDeck: deck, encounterDiscard: discard, rng } = state;
  if (deck.length === 0) {
    [deck, rng] = shuffle(rng, discard);
    discard = [];
  }
  const [card, ...rest] = deck;
  if (!card) return { ...state, turn: { step: 'bottom', section, paid: 0 } };
  return {
    ...state,
    rng,
    encounterTokens: state.encounterTokens.filter((h) => h !== hex),
    encounterDeck: rest,
    encounterDiscard: discard,
    turn: { step: 'encounter', section, hex, card, picked: [], todo: [] },
  };
}

/** Options not yet taken that the player can pay for, while they may take more. */
function openOptions(state: GameState, turn: EncounterStep): number[] {
  const seat = state.currentPlayer;
  if (turn.picked.length >= optionLimit(state, seat)) return [];
  return encounterCard(state, turn.card)
    .options.map((o, i) => (turn.picked.includes(i) || !canPay(state, seat, o.cost) ? -1 : i))
    .filter((i) => i >= 0);
}

function taskActions(state: GameState, task: EncounterTask): Action[] {
  if (task.kind === 'resources') return RESOURCES.map((resource): Action => ({ type: 'encounterResource', resource }));
  return effectOptions(state, task.kind);
}

export function encounterActions(state: GameState, turn: EncounterStep): Action[] {
  const task = turn.todo[0];
  if (task) return taskActions(state, task);
  const open = openOptions(state, turn).map((option): Action => ({ type: 'encounterOption', option }));
  // Once one option is taken (Meander), or if none can be paid for, the player may stop.
  return turn.picked.length > 0 || open.length === 0 ? [...open, { type: 'endEncounter' }] : open;
}

export function applyEncounter(state: GameState, turn: EncounterStep, action: Action): GameState {
  const seat = state.currentPlayer;
  switch (action.type) {
    case 'endEncounter':
      return finish(state, turn);
    case 'encounterOption': {
      const { cost, gain: g } = encounterCard(state, turn.card).options[action.option]!;
      const p = state.players[seat]!;
      let next = updatePlayer(state, seat, {
        coins: p.coins - (cost.coins ?? 0),
        popularity: p.popularity - (cost.popularity ?? 0),
        power: p.power - (cost.power ?? 0),
      });
      next = updatePlayer(next, seat, gain(next.players[seat]!, g));
      if (g.combatCards) next = drawCombatCards(next, seat, g.combatCards);
      for (const [resource, n] of Object.entries(g.resources ?? {}) as [Resource, number][]) {
        if (n > 0) next = addResources(next, turn.hex, resource, n);
      }
      if (g.workers) {
        const workers = next.players[seat]!.workers;
        const n = Math.min(g.workers, MAX_WORKERS - workers.length);
        next = updatePlayer(next, seat, { workers: [...workers, ...Array<HexId>(n).fill(turn.hex)] });
      }
      const todo: EncounterTask[] = [
        ...(g.anyResources ? [{ kind: 'resources' as const, left: g.anyResources }] : []),
        ...(g.actions ?? []).map((kind) => ({ kind })),
      ];
      return proceed(next, { ...turn, picked: [...turn.picked, action.option], todo });
    }
    case 'encounterResource': {
      const [task, ...rest] = turn.todo;
      const left = task!.kind === 'resources' ? task!.left - 1 : 0;
      const next = addResources(state, turn.hex, action.resource, 1);
      return proceed(next, { ...turn, todo: left > 0 ? [{ kind: 'resources', left }, ...rest] : rest });
    }
    case 'upgrade':
    case 'deploy':
    case 'build':
    case 'enlist':
      return proceed(applyEffect(state, seat, action), { ...turn, todo: turn.todo.slice(1) });
    default:
      throw new Error(`unreachable: ${action.type} during an encounter`);
  }
}

/** Skips free actions there's nothing left to do for, and ends the encounter once nothing more can be taken. */
function proceed(state: GameState, turn: EncounterStep): GameState {
  const todo = [...turn.todo];
  while (todo.length && taskActions(state, todo[0]!).length === 0) todo.shift();
  const next = { ...turn, todo };
  if (todo.length === 0 && openOptions(state, next).length === 0) return finish(state, next);
  return { ...state, turn: next };
}

function finish(state: GameState, turn: EncounterStep): GameState {
  return { ...state, encounterDiscard: [...state.encounterDiscard, turn.card], turn: { step: 'bottom', section: turn.section, paid: 0 } };
}

const BOTTOM_ACTIONS: BottomActionType[] = ['upgrade', 'deploy', 'build', 'enlist'];

/** Returns a list of problems in plain language; empty means the card is usable. */
export function validateEncounterCard(card: EncounterCard): string[] {
  const problems: string[] = [];
  const amount = (n: unknown) => n === undefined || (typeof n === 'number' && Number.isInteger(n) && n >= 0);
  if (!card.name?.trim()) problems.push('name is missing');
  if (!card.id?.trim()) problems.push('ID is missing');
  if (!Array.isArray(card.options) || card.options.length !== 3) return [...problems, 'it needs three options'];
  card.options.forEach((o, i) => {
    const which = `option ${i + 1}`;
    if (!o?.text?.trim()) problems.push(`${which} has no text`);
    const cost = o?.cost ?? {};
    const gain = o?.gain ?? {};
    if (![cost.coins, cost.popularity, cost.power].every(amount)) problems.push(`${which}'s cost must be whole numbers of 0 or more`);
    const counts = [gain.coins, gain.power, gain.popularity, gain.combatCards, gain.workers, gain.anyResources, ...Object.values(gain.resources ?? {})];
    if (!counts.every(amount)) problems.push(`${which}'s rewards must be whole numbers of 0 or more`);
    if (Object.keys(gain.resources ?? {}).some((r) => !RESOURCES.includes(r as Resource))) problems.push(`${which} gives an unknown resource`);
    if ((gain.actions ?? []).some((a) => !BOTTOM_ACTIONS.includes(a))) problems.push(`${which} gives an unknown action`);
  });
  return problems;
}
