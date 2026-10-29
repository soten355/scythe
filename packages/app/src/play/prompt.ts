// Turns the engine's legal actions into what the screen shows: which hexes
// to highlight, the instruction line and the buttons. No DOM here, so it can
// be unit tested.
//
// Tapping works in up to two stages:
//   1. Nothing selected: highlight every hex that has something to do.
//   2. A hex selected: buttons for what can happen there, including picking
//      one of your units on it to move. A unit selected: highlight where it
//      can go; tap a hex to move it there.
import {
  bottomCost,
  produceCost,
  topValue,
  type Action,
  type GameState,
  type HexId,
  type Location,
  type UnitRef,
} from '@scythe/engine';

export interface Selection {
  hex?: Location;
  unit?: UnitRef;
}

export interface Button {
  label: string;
  /** Apply this action, or change the selection. */
  action?: Action;
  select?: Selection;
  /** Shown less prominently (skip, back, done). */
  quiet?: boolean;
}

export interface Prompt {
  title: string;
  buttons: Button[];
  /** Hexes (or "home") the player can tap. */
  highlights: Set<Location>;
  /** Tapping one of these hexes applies the action. */
  tapActions: Map<Location, Action>;
  selected?: Location;
}

const TOP_NAMES = { move: 'Move', trade: 'Trade', produce: 'Produce', bolster: 'Bolster' } as const;
const BOTTOM_NAMES = { upgrade: 'Upgrade', deploy: 'Deploy', build: 'Build', enlist: 'Enlist' } as const;
const BONUS_NAMES = { power: 'power', coins: 'coins', popularity: 'popularity', combatCard: 'combat cards' } as const;
const FIELD_NAMES: Record<string, string> = {
  units: 'units moved',
  coins: 'coins gained',
  popularity: 'popularity',
  hexes: 'hexes produced',
  power: 'power',
  combatCards: 'combat cards',
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const UNIT_NAMES = { character: 'Character', mech: 'Mech', worker: 'Worker' } as const;

/** The hex an action happens on, if any (not counting moves). */
function hexOf(action: Action): HexId | undefined {
  switch (action.type) {
    case 'tradeResource':
    case 'produce':
    case 'pay':
    case 'deploy':
    case 'build':
      return action.hex;
    default:
      return undefined;
  }
}

export const sameUnit = (a: UnitRef, b: UnitRef) =>
  a.kind === b.kind && (a.kind === 'character' || a.index === (b as { index: number }).index);

/** Where a unit of the current player stands. */
export function unitLocation(state: GameState, unit: UnitRef): Location {
  const p = state.players[state.currentPlayer]!;
  if (unit.kind === 'character') return p.character;
  return (unit.kind === 'mech' ? p.mechs : p.workers)[unit.index]!;
}

const unitOf = (a: Action): UnitRef | undefined =>
  a.type === 'moveUnit' || a.type === 'carryWorker' || a.type === 'carryResource' ? a.unit : undefined;

export function label(state: GameState, action: Action): string {
  const { faction, mat } = state.setup.players[state.currentPlayer]!;
  const player = state.players[state.currentPlayer]!;
  const turn = state.turn;
  const section = turn.step === 'chooseSection' ? 0 : turn.section;
  switch (action.type) {
    case 'chooseSection': {
      const s = mat.sections[action.section as 0]!;
      return `${TOP_NAMES[s.top.action]} / ${BOTTOM_NAMES[s.bottom.action]}`;
    }
    case 'skipTop':
      return 'Skip the top action';
    case 'skipBottom':
      return 'Skip the bottom action';
    case 'gainCoins':
      return `Gain ${plural(topValue(player, mat, section, 'coins'), 'coin')} instead`;
    case 'moveUnit':
      return `Move to ${action.to}`;
    case 'endMove':
      return 'Done moving';
    case 'carryWorker':
      return 'Carry a worker';
    case 'carryResource':
      return `Pick up 1 ${action.resource}`;
    case 'tradeResource':
      return `Take 1 ${action.resource}`;
    case 'tradePopularity':
      return `Gain ${topValue(player, mat, section, 'popularity')} popularity instead`;
    case 'produce':
      return `Produce on ${action.hex}`;
    case 'endProduce':
      return 'Done producing';
    case 'bolster':
      return action.gain === 'power'
        ? `Gain ${topValue(player, mat, section, 'power')} power`
        : `Gain ${plural(topValue(player, mat, section, 'combatCards'), 'combat card')}`;
    case 'pay':
      return `Pay 1 ${bottomCost(player, mat, section).resource} from ${action.hex}`;
    case 'upgrade': {
      const top = mat.sections[action.top.section]!.top.action;
      const bottom = mat.sections[action.bottom]!.bottom.action;
      return `More ${FIELD_NAMES[action.top.field] ?? action.top.field} (${TOP_NAMES[top]}), cheaper ${BOTTOM_NAMES[bottom]}`;
    }
    case 'deploy':
      return `Mech: ${faction.mechAbilities[action.ability]?.name ?? `ability ${action.ability + 1}`}`;
    case 'build':
      return `Build the ${action.structure}`;
    case 'enlist': {
      const bottom = mat.sections[action.section]!.bottom;
      const amount = faction.recruitBonuses.find((r) => r.bonus === action.bonus)?.amount ?? 0;
      return `Recruit on ${BOTTOM_NAMES[bottom.action]} (then +1 ${BONUS_NAMES[bottom.recruitBonus]}); now +${amount} ${BONUS_NAMES[action.bonus]}`;
    }
    case 'takeBottom':
      return 'Take the coins';
  }
}

/** The instruction line for the current step of the turn. */
export function title(state: GameState): string {
  const { faction, mat } = state.setup.players[state.currentPlayer]!;
  const player = state.players[state.currentPlayer]!;
  const turn = state.turn;
  const who = faction.name;
  if (turn.step === 'chooseSection') return `${who}: choose a section of your mat`;
  const { top, bottom } = mat.sections[turn.section]!;
  switch (turn.step) {
    case 'top':
      switch (top.action) {
        case 'move':
          return `${who} · Move: tap a unit to move it (up to ${topValue(player, mat, turn.section, 'units')})`;
        case 'trade':
          return `${who} · Trade: pay ${top.cost} coin for resources (tap a worker's hex) or popularity`;
        case 'produce': {
          const cost = produceCost(player);
          const costs = (['power', 'popularity', 'coins'] as const).filter((k) => cost[k]).map((k) => `1 ${k}`);
          const pay = costs.length ? `, paying ${costs.join(' + ')}` : '';
          return `${who} · Produce: tap up to ${topValue(player, mat, turn.section, 'hexes')} hexes${pay}`;
        }
        case 'bolster':
          return `${who} · Bolster: pay ${top.cost} coin`;
      }
      break;
    case 'moving':
      if (turn.load) return `${who} · Move: tap where it goes, or pick up more first`;
      return `${who} · Move: ${turn.moved.length} of ${topValue(player, mat, turn.section, 'units')} moved`;
    case 'trading':
      return `${who} · Trade: ${turn.left} more resource${turn.left > 1 ? 's' : ''} to take`;
    case 'producing':
      return `${who} · Produce: ${turn.produced.length} of ${topValue(player, mat, turn.section, 'hexes')} hexes`;
    case 'bottom': {
      const cost = bottomCost(player, mat, turn.section);
      const name = BOTTOM_NAMES[bottom.action];
      if (turn.paid < cost.amount) {
        return `${who} · ${name}: pay ${cost.amount} ${cost.resource} (${turn.paid} paid) from hexes you control`;
      }
      return `${who} · ${name}: choose`;
    }
  }
  return who;
}

export function buildPrompt(state: GameState, actions: Action[], selection: Selection): Prompt {
  const turn = state.turn;
  const forced = turn.step === 'moving' ? turn.load?.unit : undefined;
  const unit = forced ?? selection.unit;
  const highlights = new Set<Location>();
  const tapActions = new Map<Location, Action>();
  const buttons: Button[] = [];

  // A unit is selected: tap a destination; buttons to pick things up.
  if (unit) {
    for (const a of actions) {
      if (!unitOf(a) || !sameUnit(unitOf(a)!, unit)) continue;
      if (a.type === 'moveUnit') {
        highlights.add(a.to);
        tapActions.set(a.to, a);
      } else {
        buttons.push({ label: label(state, a), action: a });
      }
    }
    if (!forced) buttons.push({ label: 'Back', select: {}, quiet: true });
    return {
      title: `${title(state)} — ${UNIT_NAMES[unit.kind]} on ${unitLocation(state, unit)}`,
      buttons,
      highlights,
      tapActions,
      selected: unitLocation(state, unit),
    };
  }

  // Every hex with something to do.
  for (const a of actions) {
    const hex = hexOf(a);
    if (hex) highlights.add(hex);
    const u = unitOf(a);
    if (u) highlights.add(unitLocation(state, u));
  }

  if (selection.hex && highlights.has(selection.hex)) {
    const at = selection.hex;
    for (const a of actions) if (hexOf(a) === at) buttons.push({ label: label(state, a), action: a });
    // One button per kind of unit here that can move (workers on a hex are interchangeable).
    for (const kind of ['character', 'mech', 'worker'] as const) {
      const first = actions.map(unitOf).find((u) => u?.kind === kind && unitLocation(state, u) === at);
      if (first) buttons.push({ label: `Move ${UNIT_NAMES[kind].toLowerCase()}`, select: { hex: at, unit: first } });
    }
    // Only one thing to do with a unit here: select it straight away.
    if (buttons.length === 1 && buttons[0]!.select) return buildPrompt(state, actions, buttons[0]!.select);
    buttons.push({ label: 'Back', select: {}, quiet: true });
    return { title: `${title(state)} — ${at === 'home' ? 'home base' : at}`, buttons, highlights, tapActions, selected: at };
  }

  // Actions that don't happen on a hex.
  for (const a of actions) {
    if (hexOf(a) || unitOf(a)) continue;
    const quiet = ['skipTop', 'skipBottom', 'endMove', 'endProduce'].includes(a.type);
    buttons.push({ label: label(state, a), action: a, quiet });
  }
  return { title: title(state), buttons, highlights, tapActions };
}
