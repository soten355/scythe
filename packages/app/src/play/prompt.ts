// Turns the engine's legal actions into what the screen shows: which hexes
// to highlight, the instruction line and the buttons. No DOM here, so it can
// be unit tested.
//
// Tapping works in up to two stages:
//   1. Nothing selected: highlight every hex that has something to do.
//   2. A hex selected: buttons for what can happen there, including picking
//      one of your units on it to move. A unit selected: highlight where it
//      can go; tap a hex to move it there.
// Producing and bottom-row actions are different: you pick everything first
// (hexes to produce on or pay from fill slots in the side panel, and any slot
// can be removed), then one button (Produce, Deploy, Build, Upgrade, Enlist)
// does it all as a single step.
import {
  applyAction,
  bottomCost,
  legalActions,
  produceCost,
  produceYield,
  shortfall,
  topValue,
  type Action,
  type GameState,
  type HexId,
  type Location,
  type Need,
  type RecruitBonus,
  type Resource,
  type SectionIndex,
  type TopUpgrade,
  type UnitRef,
} from '@scythe/engine';
import { BONUS_ICONS, RESOURCE_ICONS, type Icon } from './icons';

export interface Selection {
  hex?: Location;
  unit?: UnitRef;
  /** Hexes picked to produce on, in the order tapped. */
  produce?: HexId[];
  /** Where traded resources go, and which ones, in the order picked. */
  trade?: { hex?: HexId; resources: Resource[] };
  /** Hexes picked to pay the bottom action's cost from, one per resource. */
  pay?: HexId[];
  /** The bottom action picked (a mech to deploy, a structure, a recruit). */
  effect?: Action;
  /** The two halves of an upgrade, picked on the mat. */
  upgrade?: { top?: TopUpgrade; bottom?: SectionIndex };
  /** The bottom-row section picked on the mat for a recruit. */
  recruit?: SectionIndex;
}

export interface Button {
  label: string;
  /** Apply this action (or these, in order, as one step), or change the selection. */
  action?: Action;
  actions?: Action[];
  select?: Selection;
  /** Shown less prominently (skip, back, done). */
  quiet?: boolean;
  /** The option currently picked; the others are greyed out. */
  chosen?: boolean;
  dim?: boolean;
  /** The button that finishes the action (Produce, Trade, Deploy...). */
  primary?: boolean;
  /** Ask this first, and only go ahead if the player agrees. */
  confirm?: string;
}

export interface Prompt {
  title: string;
  buttons: Button[];
  /** Hexes (or "home") the player can tap. */
  highlights: Set<Location>;
  /** Tapping one of these hexes applies the action. */
  tapActions: Map<Location, Action>;
  /** Tapping one of these hexes changes the selection. */
  tapSelects: Map<Location, Selection>;
  selected?: Location;
  /** More hexes drawn as selected (the ones picked to produce on or pay from). */
  marked?: Set<Location>;
  /** Slots in the side panel: what's been picked so far, and what's still to pick. */
  slots?: (Slot | { empty: string })[];
  /** Ends the turn; shown apart from the other buttons (as the main one when nothing else can be done). */
  end?: Button;
  /** The game as it will be once the picks so far go through (resources picked to pay with taken off), to draw meanwhile. */
  preview?: GameState;
  /** While upgrading: what can be picked on the mat. */
  upgrade?: {
    tops: { top: TopUpgrade; chosen: boolean; select: Selection }[];
    bottoms: { section: SectionIndex; chosen: boolean; select: Selection }[];
  };
  /** While enlisting: the recruit spots that can be picked on the mat, with their ongoing bonus. */
  enlist?: { section: SectionIndex; bonus: RecruitBonus; chosen: boolean; select: Selection }[];
  /** A choice to make in a pop-up (the recruit's one-time bonus); cancel goes back. */
  choice?: { message: string; options: { label: string; icon: Icon; amount: number; select: Selection }[]; cancel: Selection };
  /**
   * The current player's pieces that can be tapped to pick that unit, keyed
   * "hex|kind" (workers on one hex are one piece), and the one picked.
   */
  pieces?: Map<string, Selection>;
  selectedPiece?: string;
}

export interface Slot {
  text: string;
  icon?: Icon;
  /** The selection without this slot. */
  remove: Selection;
}

const TOP_NAMES = { move: 'Move', trade: 'Trade', produce: 'Produce', bolster: 'Bolster' } as const;
const BOTTOM_NAMES = { upgrade: 'Upgrade', deploy: 'Deploy', build: 'Build', enlist: 'Enlist' } as const;
const BONUS_NAMES = { power: 'power', coins: 'coins', popularity: 'popularity', combatCard: 'combat cards' } as const;
const ONE_BONUS = { power: 'power', coins: 'coin', popularity: 'popularity', combatCard: 'combat card' } as const;
const FIELD_NAMES: Record<string, string> = {
  units: 'units moved',
  coins: 'coins gained',
  popularity: 'popularity',
  hexes: 'hexes produced',
  power: 'power',
  combatCards: 'combat cards',
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "1 more coin", "3 more metal and 1 more power". */
export const needText = (needs: Need[]) =>
  needs.map((n) => `${n.amount} more ${n.what === 'coins' ? (n.amount === 1 ? 'coin' : 'coins') : n.what}`).join(' and ');
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
      return 'End turn';
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
    case 'endTurn':
      return 'End turn';
  }
}

/** Headings for the two halves of the chosen section, shown in the side panel. */
export function sectionHeadings(state: GameState): { top: string; bottom: string } | null {
  const turn = state.turn;
  if (turn.step === 'chooseSection') return null;
  const { mat } = state.setup.players[state.currentPlayer]!;
  const { top, bottom } = mat.sections[turn.section]!;
  const cost = bottomCost(state.players[state.currentPlayer]!, mat, turn.section);
  return {
    top: TOP_NAMES[top.action] + ('cost' in top ? ` · pay ${plural(top.cost, 'coin')}` : ''),
    bottom: `${BOTTOM_NAMES[bottom.action]} · pay ${cost.amount} ${cost.resource} · get ${plural(bottom.coins, 'coin')}`,
  };
}

/** The instruction line for the current step of the turn. */
export function title(state: GameState): string {
  const { faction, mat } = state.setup.players[state.currentPlayer]!;
  const player = state.players[state.currentPlayer]!;
  const turn = state.turn;
  const who = faction.name;
  if (turn.step === 'chooseSection') return `${who}: select an action from your mat`;
  const { top, bottom } = mat.sections[turn.section]!;
  const short = shortfall(state, state.currentPlayer, turn.section);
  switch (turn.step) {
    case 'top':
      if (short.top.length) return `${who} · ${TOP_NAMES[top.action]}: can't ${top.action}, need ${needText(short.top)}`;
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
    case 'end':
      return `${who} · ${BOTTOM_NAMES[bottom.action]} done: end your turn`;
    case 'bottom': {
      const cost = bottomCost(player, mat, turn.section);
      const name = BOTTOM_NAMES[bottom.action];
      if (turn.paid === 0 && short.bottom.length) return `${who} · ${name}: can't ${bottom.action}, need ${needText(short.bottom)}`;
      if (turn.paid < cost.amount) return `${who} · ${name}: tap glowing hexes you control to pay ${cost.amount} ${cost.resource}`;
      const what = {
        upgrade: 'tap a glowing top-row value and a glowing bottom-row cost on your mat',
        deploy: "tap a glowing worker's hex, then choose a mech",
        build: "tap a glowing worker's hex, then choose a structure",
        enlist: 'tap a glowing recruit spot on your mat',
      }[bottom.action];
      return `${who} · ${name}: ${what}`;
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
  const tapSelects = new Map<Location, Selection>();
  const buttons: Button[] = [];

  // The sections are picked on the mat.
  if (turn.step === 'chooseSection') return { title: title(state), buttons: [], highlights, tapActions, tapSelects };
  // The bottom-row action is done: End turn is all that's left.
  if (turn.step === 'end') {
    return { title: title(state), buttons: [], highlights, tapActions, tapSelects, end: { label: 'End turn', action: { type: 'endTurn' }, primary: true } };
  }
  if (actions.some((a) => a.type === 'produce')) return producePrompt(state, actions, selection.produce ?? []);
  if (turn.step === 'top' && actions.some((a) => a.type === 'tradePopularity')) return tradePrompt(state, actions, selection.trade);
  if (turn.step === 'bottom') return bottomPrompt(state, actions, selection);

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
      tapSelects,
      selected: unitLocation(state, unit),
      // Tapping a hex moves there; tapping another piece switches to it.
      ...(!forced && { pieces: piecesToPick(state, actions) }),
      selectedPiece: pieceKey(unitLocation(state, unit), unit.kind),
    };
  }

  // Every hex with something to do.
  for (const a of actions) {
    const hex = hexOf(a);
    if (hex) highlights.add(hex);
    const u = unitOf(a);
    if (u) highlights.add(unitLocation(state, u));
  }

  // Mid-trade, the rest of the resources go on the same hex, so keep it selected.
  const tradingOn = turn.step === 'trading' ? turn.hex : undefined;
  const at = tradingOn ?? selection.hex;
  if (at && highlights.has(at)) {
    for (const a of actions) if (hexOf(a) === at) buttons.push({ label: label(state, a), action: a });
    // One button per kind of unit here that can move (workers on a hex are interchangeable).
    for (const kind of ['character', 'mech', 'worker'] as const) {
      const first = actions.map(unitOf).find((u) => u?.kind === kind && unitLocation(state, u) === at);
      if (first) buttons.push({ label: `Move ${UNIT_NAMES[kind].toLowerCase()}`, select: { hex: at, unit: first } });
    }
    // Only one thing to do with a unit here: select it straight away.
    if (buttons.length === 1 && buttons[0]!.select) return buildPrompt(state, actions, buttons[0]!.select);
    if (!tradingOn) buttons.push({ label: 'Back', select: {}, quiet: true });
    const pieces = piecesToPick(state, actions);
    return { title: `${title(state)} — ${at === 'home' ? 'home base' : at}`, buttons, highlights, tapActions, tapSelects, selected: at, pieces };
  }

  // Actions that don't happen on a hex.
  for (const a of actions) {
    if (hexOf(a) || unitOf(a)) continue;
    const quiet = ['skipTop', 'skipBottom', 'endMove', 'endProduce'].includes(a.type);
    buttons.push({ label: label(state, a), action: a, quiet });
  }
  return { title: title(state), buttons, highlights, tapActions, tapSelects, pieces: piecesToPick(state, actions) };
}

const pieceKey = (at: Location, kind: UnitRef['kind']) => `${at}|${kind}`;

/** The pieces that can move now, each picking the first such unit there (workers on a hex are interchangeable). */
function piecesToPick(state: GameState, actions: Action[]): Map<string, Selection> {
  const pieces = new Map<string, Selection>();
  for (const a of actions) {
    const u = unitOf(a);
    if (!u) continue;
    const at = unitLocation(state, u);
    if (!pieces.has(pieceKey(at, u.kind))) pieces.set(pieceKey(at, u.kind), { hex: at, unit: u });
  }
  return pieces;
}

function producePrompt(state: GameState, actions: Action[], picked: HexId[]): Prompt {
  const turn = state.turn as { section: SectionIndex };
  const { mat } = state.setup.players[state.currentPlayer]!;
  const player = state.players[state.currentPlayer]!;
  const options = actions.flatMap((a) => (a.type === 'produce' ? [a.hex] : []));
  const slots = topValue(player, mat, turn.section, 'hexes') - (state.turn.step === 'producing' ? state.turn.produced.length : 0);
  const full = picked.length >= slots;

  const highlights = new Set<Location>();
  const tapSelects = new Map<Location, Selection>();
  for (const hex of options) {
    const isPicked = picked.includes(hex);
    if (full && !isPicked) continue;
    highlights.add(hex);
    tapSelects.set(hex, { produce: isPicked ? picked.filter((h) => h !== hex) : [...picked, hex] });
  }

  // Produce each picked hex in turn; one can stop counting if an earlier one used up the room for workers.
  const run: Action[] = [];
  let s = state;
  for (const hex of picked) {
    const a: Action = { type: 'produce', hex };
    if (!legalActions(s, s.currentPlayer).some((l) => l.type === 'produce' && l.hex === hex)) continue;
    run.push(a);
    s = applyAction(s, a);
  }
  if (run.length && s.turn.step === 'producing') run.push({ type: 'endProduce' });

  const buttons: Button[] = [];
  if (run.length) buttons.push({ label: 'Produce', actions: run, primary: true });
  for (const a of actions) {
    if (a.type === 'skipTop' || a.type === 'endProduce') buttons.push({ label: label(state, a), action: a, quiet: true });
  }

  return {
    title: title(state),
    buttons,
    highlights,
    tapActions: new Map(),
    tapSelects,
    marked: new Set(picked),
    slots: Array.from({ length: slots }, (_, i) => {
      const hex = picked[i];
      if (!hex) return { empty: 'Tap a hex to produce' };
      const y = produceYield(state, player, hex)!;
      const what = y.what === 'worker' ? (y.amount === 1 ? 'worker' : 'workers') : y.what;
      return { text: `${hex}: ${y.amount} ${what}`, icon: RESOURCE_ICONS[y.what], remove: { produce: picked.filter((h) => h !== hex) } };
    }),
  };
}

const sameAction = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const EFFECTS = ['upgrade', 'deploy', 'build', 'enlist'] as const;
type Effect = Extract<Action, { type: (typeof EFFECTS)[number] }>;
const isEffect = (a: Action): a is Effect => (EFFECTS as readonly string[]).includes(a.type);

/**
 * A bottom-row action. First tap hexes to fill one slot per resource owed;
 * once it's covered, pick what to do (a mech and its hex, a structure and its
 * hex, a recruit, or the two halves of an upgrade on the mat). Then the
 * action's button pays and acts in a single step, so until then any pick can
 * be removed.
 */
function bottomPrompt(state: GameState, actions: Action[], selection: Selection): Prompt {
  const { mat } = state.setup.players[state.currentPlayer]!;
  const turn = state.turn as { section: SectionIndex; paid: number };
  const bottom = mat.sections[turn.section]!.bottom;
  const name = BOTTOM_NAMES[bottom.action];
  const cost = bottomCost(state.players[state.currentPlayer]!, mat, turn.section);
  const owed = cost.amount - turn.paid;
  const canAfford = owed <= 0 || actions.some((a) => a.type === 'pay');
  // Ending the turn asks first if the bottom-row action could still be taken.
  const skip = actions.find((a) => a.type === 'skipBottom');
  const end: Button | undefined = skip && {
    label: label(state, skip),
    action: skip,
    ...(canAfford && { confirm: 'Are you sure? You can still take your bottom-row action.' }),
  };
  const none = { tapActions: new Map<Location, Action>(), tapSelects: new Map<Location, Selection>(), highlights: new Set<Location>(), end };

  // Can't pay for it: say what's missing, and End turn becomes the main button.
  if (!canAfford) return { ...none, title: title(state), buttons: [], end: end && { ...end, primary: true } };

  // Pay from each picked hex in turn, as far as the engine allows.
  const pays: Action[] = [];
  let after = state;
  for (const hex of selection.pay ?? []) {
    if (pays.length >= owed || !legalActions(after, after.currentPlayer).some((a) => a.type === 'pay' && a.hex === hex)) continue;
    pays.push({ type: 'pay', hex });
    after = applyAction(after, { type: 'pay', hex });
  }
  const paid = pays.map((a) => (a as { hex: HexId }).hex);
  const keep = (sel: Selection): Selection => ({ ...sel, pay: paid });
  const slots: NonNullable<Prompt['slots']> = Array.from({ length: owed }, (_, i) =>
    paid[i]
      ? { text: `1 ${cost.resource} from ${paid[i]}`, icon: RESOURCE_ICONS[cost.resource], remove: { pay: paid.filter((_, j) => j !== i) } }
      : { empty: `Tap a hex to pay 1 ${cost.resource}` },
  );
  const marked = new Set<Location>(paid);
  // The resources picked so far come off the board for now; they're only spent when the action goes through.
  const preview = pays.length ? after : undefined;

  if (pays.length < owed) {
    const highlights = new Set<Location>();
    const tapSelects = new Map<Location, Selection>();
    for (const a of legalActions(after, after.currentPlayer)) {
      if (a.type !== 'pay') continue;
      highlights.add(a.hex);
      tapSelects.set(a.hex, { pay: [...paid, a.hex] });
    }
    return { ...none, title: title(state), buttons: [], highlights, tapSelects, marked, slots, preview };
  }

  // Paid in full. If that ends the turn (nothing to do but take the coins), offer just that.
  if (after.currentPlayer !== state.currentPlayer || after.turn.step !== 'bottom') {
    const button = { label: bottom.coins ? `Pay and take ${plural(bottom.coins, 'coin')}` : 'Pay', actions: pays, primary: true };
    return { ...none, title: title(state), buttons: [button], marked, slots, preview };
  }
  const now = legalActions(after, after.currentPlayer);
  const options = now.filter(isEffect);
  if (!options.length) {
    const buttons = now.filter((a) => a.type !== 'skipBottom').map((a) => ({ label: label(after, a), actions: [...pays, a], primary: true }));
    return { ...none, title: title(after), buttons, marked, slots, preview };
  }

  let chosen: Effect | undefined;
  const choices: Button[] = [];
  const highlights = new Set<Location>();
  const tapSelects = new Map<Location, Selection>();
  let selected: Location | undefined;
  let upgrade: Prompt['upgrade'];
  let enlist: Prompt['enlist'];
  let choice: Prompt['choice'];

  if (bottom.action === 'upgrade') {
    const ups = options as Extract<Effect, { type: 'upgrade' }>[];
    const { top, bottom: low } = selection.upgrade ?? {};
    chosen = ups.find((a) => sameAction(a.top, top) && a.bottom === low);
    const tops = ups.map((a) => a.top).filter((t, i, all) => all.findIndex((u) => sameAction(u, t)) === i);
    const bottoms = [...new Set(ups.map((a) => a.bottom))];
    upgrade = {
      tops: tops.map((t) => {
        const on = sameAction(t, top);
        return { top: t, chosen: on, select: keep({ upgrade: { top: on ? undefined : t, bottom: low } }) };
      }),
      bottoms: bottoms.map((b) => ({ section: b, chosen: b === low, select: keep({ upgrade: { top, bottom: b === low ? undefined : b } }) })),
    };
    const field = top && FIELD_NAMES[top.field];
    slots.push(
      top
        ? { text: `More ${field} (${TOP_NAMES[mat.sections[top.section]!.top.action]})`, remove: keep({ upgrade: { bottom: low } }) }
        : { empty: 'Tap a glowing top-row value on your mat' },
      low !== undefined
        ? { text: `Cheaper ${BOTTOM_NAMES[mat.sections[low]!.bottom.action]}`, remove: keep({ upgrade: { top } }) }
        : { empty: 'Tap a glowing bottom-row cost on your mat' },
    );
  } else if (bottom.action === 'enlist') {
    // Pick a recruit spot on the mat, then its one-time bonus in a pop-up.
    const recruits = options as Extract<Effect, { type: 'enlist' }>[];
    const spot = selection.recruit;
    const { faction } = state.setup.players[state.currentPlayer]!;
    enlist = [...new Set(recruits.map((a) => a.section))].map((section) => ({
      section,
      bonus: mat.sections[section]!.bottom.recruitBonus,
      chosen: section === spot,
      select: keep(section === spot ? {} : { recruit: section }),
    }));
    chosen = recruits.find((a) => a.section === spot && sameAction(a, selection.effect));
    const amount = (bonus: RecruitBonus) => faction.recruitBonuses.find((r) => r.bonus === bonus)?.amount ?? 0;
    const now = (bonus: RecruitBonus) => `+${amount(bonus)} ${BONUS_NAMES[bonus]}`;
    if (spot !== undefined && !chosen) {
      choice = {
        message: `Recruit on ${BOTTOM_NAMES[mat.sections[spot]!.bottom.action]}. Choose your one-time bonus:`,
        options: recruits.filter((a) => a.section === spot).map((a) => ({ label: now(a.bonus), icon: BONUS_ICONS[a.bonus], amount: amount(a.bonus), select: keep({ recruit: spot, effect: a }) })),
        cancel: keep({}),
      };
    }
    const ongoing = spot !== undefined && mat.sections[spot]!.bottom;
    slots.push(
      ongoing
        ? { text: `Recruit on ${BOTTOM_NAMES[ongoing.action]}: +1 ${ONE_BONUS[ongoing.recruitBonus]} each time`, icon: BONUS_ICONS[ongoing.recruitBonus], remove: keep({}) }
        : { empty: 'Tap a glowing recruit spot on your mat' },
      chosen
        ? { text: `Now: ${now(chosen.bonus)}`, icon: BONUS_ICONS[chosen.bonus], remove: keep({ recruit: spot }) }
        : { empty: 'Then choose a one-time bonus' },
    );
  } else {
    // Deploy and Build happen on a worker's hex: tap it, then choose.
    chosen = options.find((a) => sameAction(a, selection.effect));
    for (const a of options) {
      const hex = (a as { hex: HexId }).hex;
      highlights.add(hex);
      tapSelects.set(hex, keep({ hex }));
    }
    selected = selection.hex && highlights.has(selection.hex) ? selection.hex : undefined;
    for (const a of options) {
      if ((a as { hex: HexId }).hex !== selected) continue;
      const on = a === chosen;
      choices.push({ label: label(after, a), select: keep(on ? { hex: selected } : { hex: selected, effect: a }), chosen: on });
    }
    const what = bottom.action === 'deploy' ? 'the mech' : 'the structure';
    slots.push(
      selected
        ? { text: `${bottom.action === 'deploy' ? 'Mech goes' : 'Build'} on ${selected}`, remove: keep({}) }
        : { empty: `Tap a worker's hex for ${what}` },
    );
  }

  // The choices, the picked one standing out, then the action's own button last.
  const buttons: Button[] = choices.map((b) => ({ ...b, ...(chosen && !b.chosen && { dim: true }) }));
  if (chosen) buttons.push({ label: name, actions: [...pays, chosen], primary: true });
  // Paid in full, so the paying hexes stop standing out: they'd hide where the mech or structure goes.
  return { ...none, title: title(after), buttons, highlights, tapSelects, selected, slots, upgrade, enlist, choice, preview };
}

/**
 * Trade: tap a worker's hex, then choose resources to fill one slot each (all
 * go on that hex); one button trades them. Popularity instead asks first if
 * resources were already picked.
 */
function tradePrompt(state: GameState, actions: Action[], trade: Selection['trade'] = { resources: [] }): Prompt {
  const { mat } = state.setup.players[state.currentPlayer]!;
  const turn = state.turn as { section: SectionIndex };
  const top = mat.sections[turn.section]!.top;
  const count = top.action === 'trade' ? top.resources : 0;
  const { hex, resources } = trade;

  const highlights = new Set<Location>();
  const tapSelects = new Map<Location, Selection>();
  for (const a of actions) {
    if (a.type !== 'tradeResource') continue;
    highlights.add(a.hex);
    tapSelects.set(a.hex, { trade: { hex: a.hex, resources } });
  }
  const slots: NonNullable<Prompt['slots']> = Array.from({ length: count }, (_, i) => {
    const r = resources[i];
    if (!r) return { empty: hex ? 'Choose a resource below' : "Tap a worker's hex, then choose a resource" };
    return { text: `1 ${r} on ${hex}`, icon: RESOURCE_ICONS[r], remove: { trade: { hex, resources: resources.filter((_, j) => j !== i) } } };
  });

  const buttons: Button[] = [];
  if (hex && resources.length < count) {
    for (const a of actions) {
      if (a.type === 'tradeResource' && a.hex === hex) {
        buttons.push({ label: label(state, a), select: { trade: { hex, resources: [...resources, a.resource] } } });
      }
    }
  }
  if (hex && resources.length === count) {
    buttons.push({ label: 'Trade', actions: resources.map((resource) => ({ type: 'tradeResource', resource, hex })), primary: true });
  }
  for (const a of actions) {
    if (a.type === 'tradePopularity') {
      buttons.push({
        label: label(state, a),
        action: a,
        ...(resources.length && { confirm: 'Are you sure? You picked resources to trade; gain popularity instead?' }),
      });
    }
    if (a.type === 'skipTop') buttons.push({ label: label(state, a), action: a, quiet: true });
  }
  return { title: title(state), buttons, highlights, tapActions: new Map(), tapSelects, selected: hex, marked: new Set(hex ? [hex] : []), slots };
}
