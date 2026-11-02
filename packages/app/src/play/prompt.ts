// Turns the engine's legal actions into what the screen shows: which hexes
// to highlight, the instruction line and the buttons. No DOM here, so it can
// be unit tested.
//
// Tapping works in up to two stages:
//   1. Nothing selected: highlight every hex that has something to do.
//   2. A hex selected: buttons for what can happen there, including picking
//      one of your units on it to move. A unit selected: highlight where it
//      can go; tap a hex to move it there. Before that it can pick things
//      up (Pick up all, or one at a time, each in a slot that puts it back);
//      they go with it when it moves.
// In a fight, each side sets its power dial and picks cards in the side
// panel, then locks them in with one button.
// Producing and bottom-row actions are different: you pick everything first
// (hexes to produce on or pay from fill slots in the side panel, and any slot
// can be removed), then one button (Produce, Deploy, Build, Upgrade, Enlist)
// does it all as a single step.
import {
  activeSeat,
  applyAction,
  bottomCost,
  encounterCard,
  encounterOptionLimit,
  factoryCard,
  FACTORY,
  heldFactoryCard,
  unitsToMove,
  maxCombatCards,
  MAX_DIAL,
  RESOURCES,
  legalActions,
  objectiveCard,
  produceCost,
  produceYield,
  shortfall,
  topValue,
  type Action,
  type BottomActionType,
  type CombatResult,
  type EncounterCost,
  type EncounterGain,
  type FactoryCard,
  type GameState,
  type HexId,
  type Location,
  type Need,
  type RecruitBonus,
  type Resource,
  type ResourcePile,
  type SectionIndex,
  type Structure,
  type TopUpgrade,
  type UnitRef,
} from '@scythe/engine';

/** A place as the side panel names it: a hex ("B3"), your home base, or another one ("the W home base"). */
export function placeName(at: Location): string {
  if (at === 'home') return 'your home base';
  if (at.startsWith('base:')) return `the ${at.slice('base:'.length).toUpperCase()} home base`;
  return at;
}
import { BONUS_ICONS, RESOURCE_ICONS, STRUCTURE_ICONS, type Icon } from './icons';

export interface Selection {
  hex?: Location;
  unit?: UnitRef;
  /** Hexes picked to produce on, in the order tapped. */
  produce?: HexId[];
  /** Where traded resources go, and which ones, in the order picked. */
  trade?: { hex?: HexId; resources: Resource[] };
  /** Hexes picked to pay the bottom action's cost from, one per resource. */
  pay?: HexId[];
  /** Coercion: the value of a combat card paid in place of one resource. */
  card?: number;
  /** The bottom action picked (a mech to deploy, a structure, a recruit). */
  effect?: Action;
  /** The two halves of an upgrade, picked on the mat. */
  upgrade?: { top?: TopUpgrade; bottom?: SectionIndex };
  /** The structure picked to build (before where). */
  structure?: Structure;
  /** The bottom-row section picked on the mat for a recruit. */
  recruit?: SectionIndex;
  /** What the selected unit picks up before it moves: workers (by index) and resources, in the order picked. */
  carry?: Carry;
  /** In a fight: cards picked (by position in your hand, in the order picked) and the power dialed. */
  combat?: { cards: number[]; power: number };
}

export interface Carry {
  workers: number[];
  resources: Resource[];
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
  /** Tapping one of these hexes applies the action (after `tapFirst`). */
  tapActions: Map<Location, Action>;
  /** Applied just before a tapped action, as one step: the selected unit picking things up before it moves. */
  tapFirst?: Action[];
  /** Hexes more than one step away (Speed): tapping one moves there hex by hex (after `tapFirst`), as one step. */
  tapRoutes?: Map<Location, Action[]>;
  /** What the selected unit has picked up so far; the map draws it on the unit instead of its hex. */
  cargo?: { at: Location; workers: number[]; resources: ResourcePile };
  /** Tapping one of these hexes changes the selection. */
  tapSelects: Map<Location, Selection>;
  selected?: Location;
  /** More hexes drawn as selected (the ones picked to produce on or pay from). */
  marked?: Set<Location>;
  /** Slots in the side panel: what's been picked so far, and what's still to pick. */
  slots?: (Slot | { empty: string })[];
  /** Ends the turn; shown apart from the other buttons (as the main one when nothing else can be done). */
  end?: Button;
  /** Still picking hexes to pay a bottom-row action's cost from. */
  paying?: boolean;
  /** The game as it will be once the picks so far go through (resources picked to pay with taken off), to draw meanwhile. */
  preview?: GameState;
  /** While upgrading: what can be picked on the mat. */
  upgrade?: {
    tops: { top: TopUpgrade; chosen: boolean; select: Selection }[];
    bottoms: { section: SectionIndex; chosen: boolean; select: Selection }[];
  };
  /** At an encounter: the card, shown in a pop-up, with an action for each option that can be taken now. */
  encounter?: {
    name: string;
    story: string;
    hex: HexId;
    /** "Choose one" or, with Meander, "Choose up to two". */
    note: string;
    options: { text: string; cost: string; gain: string; taken: boolean; action?: Action }[];
    /** Take nothing (more): after a first option with Meander, or when none can be paid for. */
    stop?: Button;
  };
  /** Factory cards to choose one from, shown in a pop-up: each card's top part and move, and the action keeping it. */
  factoryOffer?: { cards: { name: string; top: string; move: string; action: Action }[] };
  /** A choice to make in a pop-up (a structure to build; a recruit's spot, then its one-time bonus); cancel goes back, when there's somewhere to go back to. */
  choice?: { message: string; options: { label: string; icon: Icon; select: Selection }[]; cancel?: Selection };
  /**
   * The current player's pieces that can be tapped to pick that unit, keyed
   * "hex|kind" (workers on one hex are one piece), and the one picked.
   */
  pieces?: Map<string, Selection>;
  selectedPiece?: string;
  /** While choosing for a fight: the power dial, your hand of cards, and what the other side has to fight with. */
  combat?: {
    hex: HexId;
    role: 'attack' | 'defend';
    opponent: { name: string; color: string; power: number; cards: number; maxCards: number };
    /** One card per character or mech in the fight. */
    maxCards: number;
    powers: { power: number; chosen: boolean; select: Selection }[];
    /** A card with no `select` can't be picked now (you've played as many as you can). */
    hand: { value: number; chosen: boolean; select?: Selection }[];
    total: number;
  };
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
const STRUCTURE_NAMES: Record<Structure, string> = { mine: 'Mine', mill: 'Mill', armory: 'Armory', monument: 'Monument' };
/** What each structure gives, in a few words. */
const STRUCTURE_BONUS: Record<Structure, string> = {
  mine: 'a tunnel only you can use',
  mill: 'produces as an extra hex',
  armory: '+1 power when you trade',
  monument: '+1 popularity when you bolster',
};
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
  a.type === 'moveUnit' || a.type === 'carryWorker' || a.type === 'carryResource' || a.type === 'dropWorker' || a.type === 'dropResource'
    ? a.unit
    : undefined;

export function label(state: GameState, action: Action): string {
  const { faction, mat } = state.setup.players[state.currentPlayer]!;
  const player = state.players[state.currentPlayer]!;
  const turn = state.turn;
  // Values from the mat only come up for a mat section (never the Factory card).
  const section = (turn.step === 'chooseSection' ? 0 : turn.section) as SectionIndex;
  const onFactory = turn.step !== 'chooseSection' && turn.section === FACTORY;
  switch (action.type) {
    case 'chooseSection': {
      if (action.section === FACTORY) return 'Factory card';
      const s = mat.sections[action.section as 0]!;
      return `${TOP_NAMES[s.top.action]} / ${BOTTOM_NAMES[s.bottom.action]}`;
    }
    case 'skipTop':
      if (turn.step === 'factoryTop') return 'Skip to the move';
      return onFactory ? 'Skip the move' : 'Skip the top action';
    case 'takeFactoryCard':
      return `Keep ${factoryCard(state, action.card).name}`;
    case 'completeObjective':
      return `★ Complete objective: ${objectiveCard(state, action.card).name}`;
    case 'factoryPay':
      return `Pay 1 ${action.resource} from ${action.hex}`;
    case 'factoryUse':
      return 'Pay and use it';
    case 'skipBottom':
      return 'End turn';
    case 'gainCoins':
      return `Gain ${plural(topValue(player, mat, section, 'coins'), 'coin')} instead`;
    case 'moveUnit':
      return `Move to ${placeName(action.to)}`;
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
    case 'payWithCard':
      if (onFactory) return `Pay a ${action.value} combat card instead of a resource`;
      return `Pay a ${action.value} combat card instead of 1 ${bottomCost(player, mat, section).resource}`;
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
    case 'fight':
      return `Fight on ${action.hex}`;
    case 'combatCard':
      return `Card ${action.value}`;
    case 'combatPower':
      return `${action.power} power`;
    case 'dropWorker':
      return 'Drop off a worker';
    case 'dropResource':
      return `Drop off 1 ${action.resource}`;
    case 'beforeCombat':
      return action.use ? 'Use it' : "Don't use it";
    case 'encounterOption':
      return `Option ${action.option + 1}`;
    case 'encounterResource':
      return `1 ${action.resource}`;
    case 'endEncounter':
      return 'Done';
    case 'retreat':
      return action.to === 'home' ? 'Retreat home' : `Retreat to ${action.to}`;
  }
}

/** Headings for the two halves of the chosen section, shown in the side panel. */
/** Where a row of the chosen section stands this turn: still to come, under way, done, or skipped. */
export type RowStatus = 'waiting' | 'now' | 'done' | 'skipped';

/** The chosen section's two rows for the side panel: what each does and costs, and how far the turn has got. */
export function sectionHeadings(state: GameState): { top: string; bottom: string; status: { top: RowStatus; bottom: RowStatus } } | null {
  const turn = state.turn;
  if (turn.step === 'chooseSection') return null;
  if (turn.section === FACTORY) {
    // The card's top part, then its move (in place of a bottom row).
    const card = heldFactoryCard(state, state.currentPlayer)!;
    const onTop = turn.step === 'factoryTop' || turn.step === 'factoryRewards';
    return {
      top: `Factory card · ${costText(card.cost)} → ${gainText(card.gain, '')}`,
      bottom: `Then ${moveText(card)}`,
      status: { top: onTop ? 'now' : 'done', bottom: turn.step === 'end' ? 'done' : onTop ? 'waiting' : 'now' },
    };
  }
  const { mat } = state.setup.players[state.currentPlayer]!;
  const { top, bottom } = mat.sections[turn.section]!;
  const cost = bottomCost(state.players[state.currentPlayer]!, mat, turn.section);
  const onBottom = turn.step === 'bottom' || turn.step === 'end';
  return {
    top: TOP_NAMES[top.action] + ('cost' in top ? ` · pay ${plural(top.cost, 'coin')}` : ''),
    bottom: `${BOTTOM_NAMES[bottom.action]} · pay ${cost.amount} ${cost.resource} · get ${plural(bottom.coins, 'coin')}`,
    status: {
      top: !onBottom ? 'now' : turn.skippedTop ? 'skipped' : 'done',
      bottom: turn.step === 'end' ? 'done' : onBottom ? 'now' : 'waiting',
    },
  };
}

/** A Factory card's move in words: "move 1 unit up to 2 hexes". */
export function moveText(card: FactoryCard): string {
  const { units, hexes } = card.move;
  return `move ${plural(units, 'unit')}${hexes > 1 ? ` up to ${hexes} hexes${units > 1 ? ' each' : ''}` : ' 1 hex'}`;
}

/** How to pick what a bottom-row action does. */
const EFFECT_HOW: Record<BottomActionType, string> = {
  upgrade: 'tap a glowing top-row value and a glowing bottom-row cost on your mat',
  deploy: "tap a glowing worker's hex, then choose a mech",
  build: "choose a structure, then tap a glowing worker's hex",
  enlist: 'choose a recruit spot, then a one-time bonus',
};

/** The instruction line for the current step of the turn. */
export function title(state: GameState): string {
  const { faction, mat } = state.setup.players[state.currentPlayer]!;
  const player = state.players[state.currentPlayer]!;
  const turn = state.turn;
  const who = faction.name;
  if (turn.step === 'chooseSection') return `${who}: select an action from your mat`;
  if (turn.step === 'factoryCard') return `${who} · The Factory: choose a Factory card to keep`;
  if (turn.section === FACTORY) {
    const card = heldFactoryCard(state, state.currentPlayer)!;
    switch (turn.step) {
      case 'factoryTop': {
        const pays = turnActions(state);
        if (pays.every((a) => a.type === 'skipTop')) return `${who} · Factory card: can't pay ${costText(card.cost).toLowerCase()}; skip to the move`;
        if (pays.some((a) => a.type === 'factoryUse')) return `${who} · Factory card: paid; use it for ${gainText(card.gain, '')}`;
        return `${who} · Factory card: tap glowing hexes you control to pay ${costText(card.cost).replace(/^Pay /, '')}`;
      }
      case 'factoryRewards':
        return `${who} · Factory card: free ${BOTTOM_NAMES[turn.todo[0]!]}: ${EFFECT_HOW[turn.todo[0]!]}`;
      case 'top':
        return `${who} · Factory move: tap a unit (${moveText(card)})`;
      case 'end':
        return `${who} · Factory move done: end your turn`;
    }
  }
  const sec = turn.section === FACTORY ? undefined : mat.sections[turn.section];
  const { top, bottom } = sec ?? mat.sections[0];
  const short = turn.section === FACTORY ? { top: [], bottom: [] } : shortfall(state, state.currentPlayer, turn.section);
  switch (turn.step) {
    case 'top':
      if (short.top.length) return `${who} · ${TOP_NAMES[top.action]}: can't ${top.action}, need ${needText(short.top)}`;
      switch (top.action) {
        case 'move':
          return `${who} · Move: tap a unit to move it (up to ${unitsToMove(state, turn.section)})`;
        case 'trade':
          return `${who} · Trade: pay ${top.cost} coin for resources (tap a worker's hex) or popularity`;
        case 'produce': {
          const cost = produceCost(player);
          const costs = (['power', 'popularity', 'coins'] as const).filter((k) => cost[k]).map((k) => `1 ${k}`);
          const pay = costs.length ? `, paying ${costs.join(' + ')}` : '';
          return `${who} · Produce: tap up to ${topValue(player, mat, turn.section as SectionIndex, 'hexes')} hexes${pay}`;
        }
        case 'bolster':
          return `${who} · Bolster: pay ${top.cost} coin`;
      }
      break;
    case 'moving':
      if (turn.walking) return `${who} · Move: it can go ${plural(turn.walking.left, 'more hex')}${turn.walking.left === 1 ? '' : 'es'}: tap where, or move another unit`;
      if (turn.load) return `${who} · Move: tap where it goes, or pick up more first`;
      return `${who} · Move: ${turn.moved.length} of ${unitsToMove(state, turn.section)} moved`;
    case 'trading':
      return `${who} · Trade: ${turn.left} more resource${turn.left > 1 ? 's' : ''} to take`;
    case 'producing':
      return `${who} · Produce: ${turn.produced.length} of ${topValue(player, mat, turn.section, 'hexes')} hexes`;
    case 'end':
      return `${who} · ${BOTTOM_NAMES[bottom.action]} done: end your turn`;
    case 'encounter': {
      const task = turn.todo[0];
      if (!task) return `${who} · Encounter on ${turn.hex}: choose from the card`;
      if (task.kind === 'resources') return `${who} · Encounter: choose ${plural(task.left, 'more resource')} (they go on ${turn.hex})`;
      return `${who} · Encounter: free ${BOTTOM_NAMES[task.kind]}: ${EFFECT_HOW[task.kind]}`;
    }
    case 'combat': {
      const name = (seat: number) => state.setup.players[seat]!.faction.name;
      const f = turn.fight;
      if (turn.retreat) {
        const r = turn.retreat;
        return `${name(r.seat)} · Lost on ${r.hex}: retreat your character and mechs home, or tap a lake`;
      }
      if (!f) return `${who} · Fights on ${turn.left.join(' and ')}: tap where to fight first`;
      if (f.before.length) return `${name(f.before[0]!)} · Before the fight on ${f.hex}`;
      const choose = 'set your power and add cards';
      if (activeSeat(state) === f.attacker.seat) return `${who} · Fight on ${f.hex} against ${name(f.defender.seat)}: ${choose}`;
      return `${name(f.defender.seat)} · Defend ${f.hex} against ${who}: ${choose}`;
    }
    case 'bottom': {
      const cost = bottomCost(player, mat, turn.section);
      const name = BOTTOM_NAMES[bottom.action];
      if (turn.paid === 0 && short.bottom.length) return `${who} · ${name}: can't ${bottom.action}, need ${needText(short.bottom)}`;
      if (turn.paid < cost.amount) return `${who} · ${name}: tap glowing hexes you control to pay ${cost.amount} ${cost.resource}`;
      return `${who} · ${name}: ${EFFECT_HOW[bottom.action]}`;
    }
  }
  return who;
}

/** What the current player can do on their turn, leaving out completing objectives (those get their own buttons, see buildPrompt). */
const turnActions = (state: GameState) => legalActions(state, state.currentPlayer).filter((a) => a.type !== 'completeObjective');

/** What to show for the legal actions: the step's own prompt, plus a button for each objective that can be completed now. */
export function buildPrompt(state: GameState, actions: Action[], selection: Selection): Prompt {
  const prompt = stepPrompt(state, actions.filter((a) => a.type !== 'completeObjective'), selection);
  const objectives = actions.flatMap((a): Button[] =>
    a.type === 'completeObjective' ? [{ label: label(state, a), action: a, primary: true }] : [],
  );
  return objectives.length ? { ...prompt, buttons: [...objectives, ...prompt.buttons] } : prompt;
}

function stepPrompt(state: GameState, actions: Action[], selection: Selection): Prompt {
  const turn = state.turn;
  // Picking things up before a unit's first hex: that unit only. A unit partway through its move (Speed) stays selected unless you pick another.
  const forced = turn.step === 'moving' && !turn.walking ? turn.load?.unit : undefined;
  const walking = turn.step === 'moving' ? turn.walking?.unit : undefined;
  const unit = forced ?? selection.unit ?? (selection.hex ? undefined : walking);
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
  if (turn.step === 'encounter') return encounterPrompt(state, actions, selection);
  if (turn.step === 'factoryCard') return factoryOfferPrompt(state, actions);
  if (turn.step === 'factoryTop') return factoryTopPrompt(state, actions);
  if (turn.step === 'factoryRewards') return bottomPrompt(state, actions, selection, turn.todo[0]);
  if (actions.some((a) => a.type === 'produce')) return producePrompt(state, actions, selection.produce ?? []);
  if (turn.step === 'top' && actions.some((a) => a.type === 'tradePopularity')) return tradePrompt(state, actions, selection.trade);
  if (turn.step === 'bottom') return bottomPrompt(state, actions, selection);
  if (turn.step === 'combat') return combatPrompt(state, actions, selection.combat ?? { cards: [], power: 0 });

  // A unit is selected: tap a destination; buttons to pick things up.
  if (unit) {
    for (const a of actions) {
      if (a.type === 'moveUnit' && sameUnit(a.unit, unit)) {
        highlights.add(a.to);
        tapActions.set(a.to, a);
      }
    }
    const carry = carryPrompt(state, actions, unit, selection);
    buttons.push(...carry.buttons);
    const tapRoutes = routes(state, unit, carry.run, tapActions);
    for (const hex of tapRoutes.keys()) highlights.add(hex);
    const isWalking = walking && sameUnit(walking, unit);
    if (isWalking) buttons.push({ label: 'Done moving', action: { type: 'endMove' }, quiet: true });
    else if (!forced) buttons.push({ label: 'Back', select: {}, quiet: true });
    return {
      title: `${title(state)} — ${UNIT_NAMES[unit.kind]} on ${unitLocation(state, unit)}`,
      buttons,
      highlights,
      tapActions,
      tapSelects,
      selected: unitLocation(state, unit),
      ...((carry.slots.length || carry.run.length) && { slots: carry.slots, tapFirst: carry.run, cargo: carry.cargo }),
      ...(tapRoutes.size && { tapRoutes }),
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
    return { title: `${title(state)} — ${placeName(at)}`, buttons, highlights, tapActions, tapSelects, selected: at, pieces };
  }

  // Actions that don't happen on a hex.
  for (const a of actions) {
    if (hexOf(a) || unitOf(a)) continue;
    const quiet = ['skipTop', 'skipBottom', 'endMove', 'endProduce'].includes(a.type);
    buttons.push({ label: label(state, a), action: a, quiet });
  }
  return { title: title(state), buttons, highlights, tapActions, tapSelects, pieces: piecesToPick(state, actions) };
}

/**
 * With Speed, the hexes a unit can reach in more than one step, each with the
 * moves to get there (shortest first), found by asking the engine where it
 * can go next from each hex. `first` is what it picks up before setting off;
 * `near` the hexes one step away, left out here.
 */
function routes(state: GameState, unit: UnitRef, first: Action[], near: Map<Location, Action>): Map<Location, Action[]> {
  const found = new Map<Location, Action[]>();
  const start = unitLocation(state, unit);
  let frontier: { state: GameState; path: Action[] }[];
  try {
    frontier = [{ state: first.reduce(applyAction, state), path: [] }];
  } catch {
    return found;
  }
  const seen = new Set<Location>([start, ...near.keys()]);
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const { state: s, path } of frontier) {
      // Past the first hex, only while this unit is still on its way.
      if (path.length && !(s.turn.step === 'moving' && s.turn.walking && sameUnit(s.turn.walking.unit, unit))) continue;
      for (const a of turnActions(s)) {
        if (a.type !== 'moveUnit' || !sameUnit(a.unit, unit)) continue;
        const to = [...path, a];
        if (path.length && !seen.has(a.to)) {
          seen.add(a.to);
          found.set(a.to, to);
        }
        next.push({ state: applyAction(s, a), path: to });
      }
    }
    frontier = next;
  }
  return found;
}

/**
 * Picking things up before a unit moves: Pick up all, or one thing at a
 * time; each thing picked fills a slot that puts it back down. Nothing
 * happens until the unit moves, when the pick-ups and the move go through as
 * one step. A unit partway through its move (Speed) starts with the slots
 * holding what it already carries: removing one drops it off here.
 */
function carryPrompt(state: GameState, actions: Action[], unit: UnitRef, selection: Selection) {
  const at = unitLocation(state, unit);
  const turn = state.turn;
  const load = turn.step === 'moving' && turn.load && sameUnit(turn.load.unit, unit) ? turn.load : undefined;
  const loaded: Carry = { workers: load?.workers ?? [], resources: RESOURCES.flatMap((r) => Array<Resource>(load?.resources[r] ?? 0).fill(r)) };
  // Everything here this unit could take along: what it carries, and what it could still pick up.
  const workers: number[] = [...loaded.workers];
  const resources: Resource[] = [...loaded.resources];
  for (const a of actions) {
    if (a.type === 'carryWorker' && sameUnit(a.unit, unit)) workers.push(a.worker);
    if (a.type === 'carryResource' && sameUnit(a.unit, unit)) {
      const n = (state.resources[at]?.[a.resource] ?? 0) - (load?.resources[a.resource] ?? 0);
      for (let i = 0; i < n; i++) resources.push(a.resource);
    }
  }
  // The picks (at first, what it carries; on a lake, everything, as it can't stay behind), less any that aren't there any more.
  const onLake = at !== 'home' && state.setup.board.hexes[at]?.terrain === 'lake';
  const wanted = selection.carry ?? (onLake ? { workers, resources } : loaded);
  const picked: Carry = { workers: wanted.workers.filter((w) => workers.includes(w)), resources: [] };
  const left = [...resources];
  for (const r of wanted.resources) {
    const i = left.indexOf(r);
    if (i >= 0) picked.resources.push(...left.splice(i, 1));
  }
  const leftWorkers = workers.filter((w) => !picked.workers.includes(w));
  const pick = (carry: Carry): Selection => ({ ...selection, carry });

  const buttons: Button[] = [];
  if (leftWorkers.length + left.length > 1) buttons.push({ label: 'Pick up all', select: pick({ workers, resources }) });
  if (leftWorkers.length) buttons.push({ label: 'Pick up a worker', select: pick({ ...picked, workers: [...picked.workers, leftWorkers[0]!] }) });
  for (const r of new Set(left)) buttons.push({ label: `Pick up 1 ${r}`, select: pick({ ...picked, resources: [...picked.resources, r] }) });

  const slots: Slot[] = [
    ...picked.workers.map((w) => ({
      text: 'Worker',
      icon: RESOURCE_ICONS.worker,
      remove: pick({ ...picked, workers: picked.workers.filter((x) => x !== w) }),
    })),
    ...picked.resources.map((r, i) => ({
      text: `1 ${r}`,
      icon: RESOURCE_ICONS[r],
      remove: pick({ ...picked, resources: picked.resources.filter((_, j) => j !== i) }),
    })),
  ];
  // What to drop off and pick up to go from what it carries now to the picks.
  const count = (list: Resource[], r: Resource) => list.filter((x) => x === r).length;
  const run: Action[] = [
    ...loaded.workers.filter((w) => !picked.workers.includes(w)).map((worker): Action => ({ type: 'dropWorker', unit, worker })),
    ...RESOURCES.flatMap((resource) =>
      Array<Action>(Math.max(0, count(loaded.resources, resource) - count(picked.resources, resource))).fill({ type: 'dropResource', unit, resource }),
    ),
    ...picked.workers.filter((w) => !loaded.workers.includes(w)).map((worker): Action => ({ type: 'carryWorker', unit, worker })),
    ...RESOURCES.flatMap((resource) =>
      Array<Action>(Math.max(0, count(picked.resources, resource) - count(loaded.resources, resource))).fill({ type: 'carryResource', unit, resource }),
    ),
  ];
  const pile: ResourcePile = {};
  for (const r of picked.resources) pile[r] = (pile[r] ?? 0) + 1;
  return { buttons, slots, run, cargo: { at, workers: picked.workers, resources: pile } };
}

/**
 * Combat: with several fights to come, tap which hex to fight on first. In
 * a fight, pick a power (tap a number) and cards (tap to add or take back),
 * then lock them in; the other side can't see them until both have chosen.
 */
function combatPrompt(state: GameState, actions: Action[], picked: NonNullable<Selection['combat']>): Prompt {
  const turn = state.turn as Extract<GameState['turn'], { step: 'combat' }>;
  const highlights = new Set<Location>();
  const tapActions = new Map<Location, Action>();
  const tapSelects = new Map<Location, Selection>();
  const fight = turn.fight;
  if (turn.retreat) {
    // Tap a lake, or use the buttons (home is off to the side of the map).
    const buttons = actions.map((a): Button => ({ label: label(state, a), action: a }));
    for (const a of actions) if (a.type === 'retreat' && a.to !== 'home') (highlights.add(a.to), tapActions.set(a.to, a));
    return { title: title(state), buttons, highlights, tapActions, tapSelects, selected: turn.retreat.hex };
  }
  if (fight?.before.length) {
    const seat = fight.before[0]!;
    const { faction } = state.setup.players[seat]!;
    const unlocked = state.players[seat]!.mechAbilities.map((i) => faction.mechAbilities[i]!);
    const ability = [faction.ability, ...unlocked].find((a) => a.rule?.kind === 'drainPower')!;
    const rule = ability.rule as Extract<NonNullable<typeof ability.rule>, { kind: 'drainPower' }>;
    const other = seat === fight.attacker.seat ? fight.defender.seat : fight.attacker.seat;
    const them = state.setup.players[other]!.faction.name;
    const buttons: Button[] = [
      { label: `Use ${ability.name}: pay ${rule.pay} power, ${them} loses ${rule.loss}`, action: { type: 'beforeCombat', use: true } },
      { label: `Don't use ${ability.name}`, action: { type: 'beforeCombat', use: false }, quiet: true },
    ];
    return { title: title(state), buttons, highlights, tapActions, tapSelects, selected: fight.hex };
  }
  if (!fight) {
    const buttons = actions.map((a): Button => ({ label: label(state, a), action: a }));
    for (const a of actions) if (a.type === 'fight') (highlights.add(a.hex), tapActions.set(a.hex, a));
    return { title: title(state), buttons, highlights, tapActions, tapSelects };
  }

  const attacking = activeSeat(state) === fight.attacker.seat;
  const [mine, theirs] = attacking ? [fight.attacker, fight.defender] : [fight.defender, fight.attacker];
  const me = state.players[mine.seat]!;
  const them = state.players[theirs.seat]!;
  const maxCards = maxCombatCards(state, mine.seat, fight.hex);
  const full = picked.cards.length >= maxCards;
  const toggle = (i: number): Selection => ({
    combat: { ...picked, cards: picked.cards.includes(i) ? picked.cards.filter((c) => c !== i) : [...picked.cards, i] },
  });
  const hand = me.combatCards.map((value, i) => {
    const chosen = picked.cards.includes(i);
    return { value, chosen, ...((chosen || !full) && { select: toggle(i) }) };
  });
  const powers = [];
  for (let power = 0; power <= Math.min(MAX_DIAL, me.power); power++) {
    powers.push({ power, chosen: power === picked.power, select: { combat: { ...picked, power } } });
  }
  const values = picked.cards.map((i) => me.combatCards[i]!);
  const total = picked.power + values.reduce((a, b) => a + b, 0);
  const shown = [`${picked.power} power`, ...values.map((v) => `card ${v}`)].join(' + ');
  const theirName = state.setup.players[theirs.seat]!.faction;

  return {
    title: title(state),
    buttons: [
      {
        label: `Lock in ${total}`,
        primary: true,
        actions: [...values.map((value): Action => ({ type: 'combatCard', value })), { type: 'combatPower', power: picked.power }],
        confirm: `Lock in ${total} (${shown})? ${attacking ? `${theirName.name} chooses next, without seeing it.` : 'Then both sides are revealed.'}`,
      },
    ],
    highlights,
    tapActions,
    tapSelects,
    selected: fight.hex,
    combat: {
      hex: fight.hex,
      role: attacking ? 'attack' : 'defend',
      opponent: {
        name: theirName.name,
        color: theirName.color,
        power: them.power,
        cards: them.combatCards.length,
        maxCards: maxCombatCards(state, theirs.seat, fight.hex),
      },
      maxCards,
      powers,
      hand,
      total,
    },
  };
}

/** What a finished fight comes to, for the pop-up that reveals both sides. */
export function combatSummary(state: GameState, result: CombatResult): { title: string; lines: string[] } {
  const name = (seat: number) => state.setup.players[seat]!.faction.name;
  const side = (s: CombatResult['attacker']) => {
    const total = s.power + s.cards.reduce((a, b) => a + b, 0);
    return `${name(s.seat)}: ${[`${s.power} power`, ...s.cards.map(String)].join(' + ')} = ${total}`;
  };
  const loser = result.winner === result.attacker.seat ? result.defender.seat : result.attacker.seat;
  return {
    title: `${name(result.winner)} wins on ${result.hex}`,
    lines: [side(result.attacker), side(result.defender), `${name(loser)} retreats to their home base.`],
  };
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

  // Every legal hex stays tappable: a picked one un-picks; once the slots are full, a new one swaps out the oldest pick.
  const highlights = new Set<Location>();
  const tapSelects = new Map<Location, Selection>();
  for (const hex of options) {
    const isPicked = picked.includes(hex);
    highlights.add(hex);
    tapSelects.set(hex, { produce: isPicked ? picked.filter((h) => h !== hex) : [...(full ? picked.slice(1) : picked), hex] });
  }

  // Produce each picked hex in turn; one can stop counting if an earlier one used up the room for workers.
  const run: Action[] = [];
  let s = state;
  for (const hex of picked) {
    const a: Action = { type: 'produce', hex };
    if (!turnActions(s).some((l) => l.type === 'produce' && l.hex === hex)) continue;
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
 * A bottom-row action (or, with `free`, one an encounter gives). First tap hexes to fill one slot per resource owed;
 * once it's covered, pick what to do (a mech and its hex, a structure and its
 * hex, a recruit, or the two halves of an upgrade on the mat). Then the
 * action's button pays and acts in a single step, so until then any pick can
 * be removed.
 */
function bottomPrompt(state: GameState, actions: Action[], selection: Selection, free?: BottomActionType): Prompt {
  const { mat } = state.setup.players[state.currentPlayer]!;
  const turn = state.turn as { section: SectionIndex; paid: number };
  // A free action (from an encounter or the Factory card) has no section of its own to pay for.
  const bottom = mat.sections[turn.section]?.bottom ?? mat.sections[0].bottom;
  const kind = free ?? bottom.action;
  const name = BOTTOM_NAMES[kind];
  const cost = bottomCost(state.players[state.currentPlayer]!, mat, (free ? 0 : turn.section) as SectionIndex);
  const owed = free ? 0 : cost.amount - turn.paid;
  const canAfford = owed <= 0 || actions.some((a) => a.type === 'pay' || a.type === 'payWithCard');
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

  // Pay with a combat card first (Coercion), then from each picked hex in turn, as far as the engine allows.
  const pays: Action[] = [];
  let after = state;
  const card: Action = { type: 'payWithCard', value: selection.card ?? -1 };
  const coerced = selection.card !== undefined && actions.some((a) => a.type === 'payWithCard' && a.value === selection.card);
  if (coerced) (pays.push(card), (after = applyAction(after, card)));
  for (const hex of selection.pay ?? []) {
    if (pays.length >= owed || !turnActions(after).some((a) => a.type === 'pay' && a.hex === hex)) continue;
    pays.push({ type: 'pay', hex });
    after = applyAction(after, { type: 'pay', hex });
  }
  const paid = pays.flatMap((a) => (a.type === 'pay' ? [a.hex] : []));
  /** Keeps the combat card picked to pay with, if any, in a new selection. */
  const keepCard = (sel: Selection): Selection => (coerced ? { ...sel, card: selection.card } : sel);
  const keep = (sel: Selection): Selection => keepCard({ ...sel, pay: paid });
  const cardSlots: NonNullable<Prompt['slots']> = coerced ? [{ text: `Combat card (${selection.card}) in place of 1 ${cost.resource}`, icon: BONUS_ICONS.combatCard, remove: { pay: paid } }] : [];
  const slots: NonNullable<Prompt['slots']> = [
    ...cardSlots,
    ...Array.from({ length: owed - cardSlots.length }, (_, i) =>
      paid[i]
        ? { text: `1 ${cost.resource} from ${paid[i]}`, icon: RESOURCE_ICONS[cost.resource], remove: keepCard({ pay: paid.filter((_, j) => j !== i) }) }
        : { empty: `Tap a hex to pay 1 ${cost.resource}` },
    ),
  ];
  const marked = new Set<Location>(paid);
  // The resources picked so far come off the board for now; they're only spent when the action goes through.
  const preview = pays.length ? after : undefined;

  if (pays.length < owed) {
    const highlights = new Set<Location>();
    const tapSelects = new Map<Location, Selection>();
    for (const a of turnActions(after)) {
      if (a.type !== 'pay') continue;
      highlights.add(a.hex);
      tapSelects.set(a.hex, keepCard({ pay: [...paid, a.hex] }));
    }
    // Coercion: a combat card can stand in for one of the resources.
    const buttons: Button[] = turnActions(after).flatMap((a) =>
      a.type === 'payWithCard' ? [{ label: `Pay a ${a.value} combat card instead of 1 ${cost.resource}`, select: { pay: paid, card: a.value } }] : [],
    );
    return { ...none, title: title(state), buttons, highlights, tapSelects, marked, slots, preview, paying: true };
  }

  // Paid in full. If that ends the turn (nothing to do but take the coins), offer just that.
  if (!free && (after.currentPlayer !== state.currentPlayer || after.turn.step !== 'bottom')) {
    const button = { label: bottom.coins ? `Pay and take ${plural(bottom.coins, 'coin')}` : 'Pay', actions: pays, primary: true };
    return { ...none, title: title(state), buttons: [button], marked, slots, preview };
  }
  const now = turnActions(after);
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
  let choice: Prompt['choice'];

  if (kind === 'upgrade') {
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
  } else if (kind === 'enlist') {
    // A pop-up asks for the recruit spot, then another for its one-time bonus.
    const recruits = options as Extract<Effect, { type: 'enlist' }>[];
    const spot = selection.recruit;
    const { faction } = state.setup.players[state.currentPlayer]!;
    chosen = recruits.find((a) => a.section === spot && sameAction(a, selection.effect));
    const amount = (bonus: RecruitBonus) => faction.recruitBonuses.find((r) => r.bonus === bonus)?.amount ?? 0;
    const now = (bonus: RecruitBonus) => `+${amount(bonus)} ${BONUS_NAMES[bonus]}`;
    const ongoing = (section: SectionIndex) => {
      const b = mat.sections[section]!.bottom;
      return `${BOTTOM_NAMES[b.action]}: +1 ${ONE_BONUS[b.recruitBonus]} each time`;
    };
    if (spot === undefined) {
      choice = {
        message: 'Choose where your recruit goes:',
        options: [...new Set(recruits.map((a) => a.section))].map((section) => ({
          label: ongoing(section),
          icon: BONUS_ICONS[mat.sections[section]!.bottom.recruitBonus],
          select: keep({ recruit: section }),
        })),
        // Back un-picks the last payment.
        ...(!free && { cancel: { pay: paid.slice(0, -1) } }),
      };
    } else if (!chosen) {
      choice = {
        message: `Recruit on ${BOTTOM_NAMES[mat.sections[spot]!.bottom.action]}. Choose your one-time bonus:`,
        options: recruits.filter((a) => a.section === spot).map((a) => ({ label: now(a.bonus), icon: BONUS_ICONS[a.bonus], select: keep({ recruit: spot, effect: a }) })),
        cancel: keep({}),
      };
    }
    slots.push(
      spot !== undefined
        ? { text: `Recruit on ${ongoing(spot)}`, icon: BONUS_ICONS[mat.sections[spot]!.bottom.recruitBonus], remove: keep({}) }
        : { empty: 'Choose a recruit spot' },
      chosen
        ? { text: `Now: ${now(chosen.bonus)}`, icon: BONUS_ICONS[chosen.bonus], remove: keep({ recruit: spot }) }
        : { empty: 'Then choose a one-time bonus' },
    );
  } else if (kind === 'build') {
    // Choose the structure first, then tap one of the hexes where it can go.
    const builds = options as Extract<Effect, { type: 'build' }>[];
    const structure = selection.structure;
    chosen = builds.find((a) => sameAction(a, selection.effect));
    if (!structure) {
      // A pop-up asks which structure; Back un-picks the last payment (a free Build from an encounter has nothing to go back to).
      choice = {
        message: 'Choose a structure to build:',
        options: [...new Set(builds.map((a) => a.structure))].map((s) => ({
          label: `${STRUCTURE_NAMES[s]}: ${STRUCTURE_BONUS[s]}`,
          icon: STRUCTURE_ICONS[s],
          select: keep({ structure: s }),
        })),
        ...(!free && { cancel: { pay: paid.slice(0, -1) } }),
      };
    } else {
      for (const a of builds) {
        if (a.structure !== structure) continue;
        highlights.add(a.hex);
        tapSelects.set(a.hex, keep({ structure, effect: a }));
      }
      selected = chosen?.hex;
    }
    slots.push(
      structure ? { text: `Build the ${STRUCTURE_NAMES[structure].toLowerCase()}`, remove: keep({}) } : { empty: 'Choose a structure' },
      chosen ? { text: `On ${chosen.hex}`, remove: keep({ structure }) } : { empty: "Then tap a worker's hex" },
    );
  } else {
    // Deploy happens on a worker's hex: tap it, then choose the mech (the last one picks itself).
    chosen = options.find((a) => sameAction(a, selection.effect));
    for (const a of options) {
      const hex = (a as { hex: HexId }).hex;
      highlights.add(hex);
      tapSelects.set(hex, keep({ hex }));
    }
    selected = selection.hex && highlights.has(selection.hex) ? selection.hex : undefined;
    const here = options.filter((a) => (a as { hex: HexId }).hex === selected);
    if (here.length === 1) chosen = here[0];
    for (const a of options) {
      if ((a as { hex: HexId }).hex !== selected) continue;
      const on = a === chosen;
      choices.push({ label: label(after, a), select: keep(on ? { hex: selected } : { hex: selected, effect: a }), chosen: on });
    }
    slots.push(selected ? { text: `Mech goes on ${selected}`, remove: keep({}) } : { empty: "Tap a worker's hex for the mech" });
  }

  // The choices, the picked one standing out, then the action's own button last.
  const buttons: Button[] = choices.map((b) => ({ ...b, ...(chosen && !b.chosen && { dim: true }) }));
  if (chosen) buttons.push({ label: name, actions: [...pays, chosen], primary: true });
  // Paid in full, so the paying hexes stop standing out: they'd hide where the mech or structure goes.
  return { ...none, title: title(after), buttons, highlights, tapSelects, selected, slots, upgrade, choice, preview };
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

/** An encounter option's or Factory card's cost in words: "Free", "Pay 2 coins", "Lose 2 popularity", "Pay 1 wood and 1 coin". */
export function costText(cost: EncounterCost & { resources?: ResourcePile }): string {
  const pays = [
    ...RESOURCES.filter((r) => cost.resources?.[r]).map((r) => `${cost.resources![r]} ${r}`),
    ...(cost.coins ? [plural(cost.coins, 'coin')] : []),
    ...(cost.power ? [`${cost.power} power`] : []),
  ];
  const parts = [...(pays.length ? [`pay ${pays.join(' and ')}`] : []), ...(cost.popularity ? [`lose ${cost.popularity} popularity`] : [])];
  if (!parts.length) return 'Free';
  const text = parts.join(' and ');
  return text[0]!.toUpperCase() + text.slice(1);
}

/** What an encounter option gives, in words: "2 power, 1 combat card, 2 workers on A3, a free Deploy". */
export function gainText(gain: EncounterGain, hex: HexId): string {
  const parts: string[] = [];
  if (gain.coins) parts.push(plural(gain.coins, 'coin'));
  if (gain.power) parts.push(`${gain.power} power`);
  if (gain.popularity) parts.push(`${gain.popularity} popularity`);
  if (gain.combatCards) parts.push(plural(gain.combatCards, 'combat card'));
  const onHex: string[] = [];
  if (gain.workers) onHex.push(plural(gain.workers, 'worker'));
  for (const r of RESOURCES) if (gain.resources?.[r]) onHex.push(`${gain.resources[r]} ${r}`);
  if (gain.anyResources) onHex.push(`${gain.anyResources} resource${gain.anyResources === 1 ? '' : 's'} of your choice`);
  if (onHex.length) parts.push(hex ? `${onHex.join(', ')} on ${hex}` : onHex.join(', '));
  for (const a of gain.actions ?? []) parts.push(`a free ${BOTTOM_NAMES[a]}`);
  return parts.join(', ') || 'Nothing';
}

const NUMBER_WORDS = ['none', 'one', 'two', 'three'];

/**
 * An encounter. With nothing left to choose for the options taken, the card
 * shows in a pop-up with one button per option (greyed out when it can't be
 * paid for). Then, in the side panel: resources of the player's choice, one
 * button each, and free bottom-row actions picked as on the bottom row.
 */
function encounterPrompt(state: GameState, actions: Action[], selection: Selection): Prompt {
  const turn = state.turn as Extract<GameState['turn'], { step: 'encounter' }>;
  const task = turn.todo[0];
  if (task && task.kind !== 'resources') return bottomPrompt(state, actions, selection, task.kind);
  const base = { title: title(state), highlights: new Set<Location>(), tapActions: new Map<Location, Action>(), tapSelects: new Map<Location, Selection>(), selected: turn.hex };
  if (task) {
    return { ...base, buttons: actions.map((a): Button => ({ label: label(state, a), action: a })) };
  }
  const card = encounterCard(state, turn.card);
  const limit = encounterOptionLimit(state, state.currentPlayer);
  const stop = actions.find((a) => a.type === 'endEncounter');
  return {
    ...base,
    buttons: [],
    encounter: {
      name: card.name,
      story: card.story,
      hex: turn.hex,
      note: limit === 1 ? 'Choose one' : turn.picked.length ? `Choose up to ${NUMBER_WORDS[limit - turn.picked.length] ?? limit - turn.picked.length} more` : `Choose up to ${NUMBER_WORDS[limit] ?? limit}`,
      options: card.options.map((o, i) => ({
        text: o.text,
        cost: costText(o.cost),
        gain: gainText(o.gain, turn.hex),
        taken: turn.picked.includes(i),
        action: actions.find((a) => a.type === 'encounterOption' && a.option === i),
      })),
      ...(stop && { stop: { label: turn.picked.length ? 'Done' : 'Take nothing', action: stop, quiet: true } }),
    },
  };
}

const emptyPrompt = (state: GameState) => ({
  title: title(state),
  highlights: new Set<Location>(),
  tapActions: new Map<Location, Action>(),
  tapSelects: new Map<Location, Selection>(),
});

/** The Factory cards on offer, in a pop-up: tap one to keep it. */
function factoryOfferPrompt(state: GameState, actions: Action[]): Prompt {
  const cards = actions.flatMap((a) => {
    if (a.type !== 'takeFactoryCard') return [];
    const card = factoryCard(state, a.card);
    return [{ name: card.name, top: `${costText(card.cost)} → ${gainText(card.gain, '')}`, move: moveText(card), action: a }];
  });
  return { ...emptyPrompt(state), buttons: [], factoryOffer: { cards } };
}

/**
 * Using the Factory card's top part: tap glowing hexes you control to pay
 * each resource (a hex with several kinds pays them in turn), or a combat
 * card with Coercion; then one button pays the rest and takes the reward.
 */
function factoryTopPrompt(state: GameState, actions: Action[]): Prompt {
  const prompt: Prompt = { ...emptyPrompt(state), buttons: [] };
  for (const a of actions) {
    if (a.type === 'factoryPay') {
      prompt.highlights.add(a.hex);
      if (!prompt.tapActions.has(a.hex)) prompt.tapActions.set(a.hex, a);
    } else if (a.type === 'factoryUse') {
      prompt.buttons.push({ label: label(state, a), action: a, primary: true });
    } else {
      prompt.buttons.push({ label: label(state, a), action: a, quiet: a.type === 'skipTop' });
    }
  }
  return prompt;
}
