// The four top-row actions: Move, Trade, Produce and Bolster.
//
// Characters and mechs may move onto other players' units; once the move is
// over, combat.ts sends enemy workers home and runs the fights. Abilities
// (abilities.ts) let units cross rivers, use lakes, link villages to the
// Factory and move extra hexes. A unit with extra hexes moves one hex per
// action and may drop off and pick up workers and resources on the way.
import { hasRiver, neighbors, type HexId } from './board';
import type { Action, GameState, Load, Location, PlayerState, SectionIndex, TurnStep, UnitRef } from './game';
import type { Resource, TopAction } from './mat';
import { rulesOf, rulesOfKind } from './abilities';
import { afterMove, drawCombatCards } from './combat';
import { addResources, controlledHexes, current, enemyUnitHexes, gain, MAX_WORKERS, onBoard, topValue, updatePlayer } from './state';

type TopStep = Extract<TurnStep, { step: 'top' | 'moving' | 'trading' | 'producing' }>;

export const RESOURCES: Resource[] = ['oil', 'metal', 'wood', 'food'];

/** What each terrain produces; a village produces workers. */
export const TERRAIN_PRODUCES: Partial<Record<string, Resource | 'worker'>> = {
  farm: 'food',
  forest: 'wood',
  mountain: 'metal',
  tundra: 'oil',
  village: 'worker',
};

export function topActions(state: GameState, turn: TopStep): Action[] {
  const { player, mat } = current(state);
  const top = mat.sections[turn.section].top;
  switch (turn.step) {
    case 'moving':
      // Picking things up before a unit's first hex: only that unit can load more or move.
      if (turn.load && !turn.walking) {
        return [...carryOptions(state, turn.load.unit, turn.load), ...moveOptions(state, turn.section, turn.moved, turn.load)];
      }
      return [...walkOptions(state, turn), ...moveOptions(state, turn.section, turn.moved), { type: 'endMove' }];
    case 'trading':
      // Every traded resource goes on the hex the first one went to.
      return tradeResourceOptions(state, player).filter((a) => a.type === 'tradeResource' && a.hex === turn.hex);
    case 'producing':
      return [...produceOptions(state, turn.section, turn.produced), { type: 'endProduce' }];
    case 'top':
      switch (top.action) {
        case 'move':
          return [{ type: 'gainCoins' }, ...moveOptions(state, turn.section, [])];
        case 'trade':
          if (player.coins < top.cost) return [];
          return [...tradeResourceOptions(state, player), { type: 'tradePopularity' }];
        case 'produce':
          return canPayProduceCost(player) ? produceOptions(state, turn.section, []) : [];
        case 'bolster':
          if (player.coins < top.cost) return [];
          return [
            { type: 'bolster', gain: 'power' },
            { type: 'bolster', gain: 'combatCards' },
          ];
      }
  }
}

export function applyTop(state: GameState, turn: TopStep, action: Action): GameState {
  const { seat, player, mat } = current(state);
  const section = turn.section;
  const top = mat.sections[section].top;
  const value = (field: string) => topValue(player, mat, section, field);
  const toBottom = (s: GameState): GameState => ({ ...s, turn: { step: 'bottom', section, paid: 0 } });
  const endOfMove = (s: GameState): GameState => afterMove(s, section);

  switch (action.type) {
    case 'gainCoins':
      return toBottom(updatePlayer(state, seat, gain(player, { coins: value('coins') })));

    case 'carryWorker':
    case 'carryResource':
    case 'dropWorker':
    case 'dropResource': {
      const moved = turn.step === 'moving' ? turn.moved : [];
      // Loading a different unit ends any unit's walk.
      const walking = turn.step === 'moving' && turn.walking && sameUnit(turn.walking.unit, action.unit) ? turn.walking : undefined;
      const load = loadOf(turn, action.unit) ?? { unit: action.unit, workers: [], resources: {} };
      const next: Load = { ...load, workers: [...load.workers], resources: { ...load.resources } };
      if (action.type === 'carryWorker') next.workers.push(action.worker);
      else if (action.type === 'dropWorker') next.workers = next.workers.filter((w) => w !== action.worker);
      else {
        const n = (next.resources[action.resource] ?? 0) + (action.type === 'carryResource' ? 1 : -1);
        if (n > 0) next.resources[action.resource] = n;
        else delete next.resources[action.resource];
      }
      return { ...state, turn: { step: 'moving', section, moved, load: next, ...(walking && { walking }) } };
    }

    case 'moveUnit': {
      const walking = turn.step === 'moving' && turn.walking && sameUnit(turn.walking.unit, action.unit) ? turn.walking : undefined;
      const before = turn.step === 'moving' ? turn.moved : [];
      // A walking unit's next hex is part of the same unit's move.
      const moved = walking ? before : [...before, action.unit];
      const from = unitsOf(player).find((u) => sameUnit(u.unit, action.unit))!.at;
      const load = withLakeCargo(state, seat, action.unit, from, loadOf(turn, action.unit));
      const next = moveUnit(state, seat, action.unit, action.to, load);
      const left = walking ? walking.left - 1 : extraHexes(state, seat, action.unit);
      // Moving onto other players' units ends that unit's move.
      const keepGoing = left > 0 && !enemyUnitHexes(state, seat).has(action.to);
      if (!keepGoing && moved.length >= value('units')) return endOfMove(next);
      const walk = keepGoing ? { walking: { unit: action.unit, left }, ...(load && { load }) } : {};
      return { ...next, turn: { step: 'moving', section, moved, ...walk } };
    }
    case 'endMove':
      return endOfMove(state);

    case 'tradePopularity':
      return toBottom(updatePlayer(state, seat, gain(payTopCost(player, top), { popularity: value('popularity'), ...armory(player, top) })));

    case 'tradeResource': {
      let next = state;
      let left: number;
      if (turn.step === 'trading') {
        left = turn.left - 1;
      } else {
        // First resource: pay the cost and take the building bonus once.
        next = updatePlayer(next, seat, gain(payTopCost(player, top), armory(player, top)));
        left = (top.action === 'trade' ? top.resources : 0) - 1;
      }
      next = addResources(next, action.hex, action.resource, 1);
      if (left <= 0) return toBottom(next);
      return { ...next, turn: { step: 'trading', section, left, hex: action.hex } };
    }

    case 'produce': {
      const produced = [...(turn.step === 'producing' ? turn.produced : []), action.hex];
      const paid = turn.step === 'producing' ? state : payProduceCost(state, seat);
      const next = produce(paid, seat, action.hex);
      if (produceOptions(next, section, produced).length === 0) return toBottom(next);
      return { ...next, turn: { step: 'producing', section, produced } };
    }
    case 'endProduce':
      return toBottom(state);

    case 'bolster': {
      const monument = player.structures[top.structure] ? { popularity: 1 } : {};
      const gained = action.gain === 'power' ? { power: value('power') } : {};
      const next = updatePlayer(state, seat, gain(payTopCost(player, top), { ...gained, ...monument }));
      return toBottom(action.gain === 'combatCards' ? drawCombatCards(next, seat, value('combatCards')) : next);
    }
    default:
      throw new Error(`unreachable: ${action.type} during ${turn.step}`);
  }
}

const payTopCost = (player: PlayerState, top: TopAction): PlayerState =>
  'cost' in top ? { ...player, coins: player.coins - top.cost } : player;

/** The armory's building bonus: 1 power whenever you trade. */
const armory = (player: PlayerState, top: TopAction) => (player.structures[top.structure] ? { power: 1 } : {});

// ---- Move ----

const unitsOf = (player: PlayerState): { unit: UnitRef; at: Location }[] => [
  { unit: { kind: 'character' }, at: player.character },
  ...player.mechs.map((at, index) => ({ unit: { kind: 'mech', index } as UnitRef, at })),
  ...player.workers.map((at, index) => ({ unit: { kind: 'worker', index } as UnitRef, at })),
];

const sameUnit = (a: UnitRef, b: UnitRef) => a.kind === b.kind && (a.kind === 'character' || a.index === (b as { index: number }).index);

/**
 * Where a unit at `at` can move in one step: a neighboring land hex not
 * across a river, or from a tunnel (or your mine) to any other tunnel or your
 * mine. Never back home, and workers never onto other players' units
 * (characters and mechs may: that's an attack). From home: the hexes
 * bordering the home base. Abilities add river crossings, lakes and the
 * village-Factory link.
 */
export function moveTargets(state: GameState, seat: number, at: Location, kind: UnitRef['kind'] = 'worker'): HexId[] {
  const board = state.setup.board;
  const player = state.players[seat]!;
  const enemies = enemyUnitHexes(state, seat);
  const fighter = kind !== 'worker';
  const rules = rulesOf(state, seat);
  const terrain = (hex: HexId) => board.hexes[hex]?.terrain;
  const crosses = (to: HexId) =>
    rules.some((r) => r.kind === 'crossRivers' && (r.units === 'workers' ? !fighter : fighter && r.onto.includes(terrain(to)!)));
  // Workers on a lake ride with a mech: they never move off on their own.
  if (!fighter && at !== 'home' && terrain(at) === 'lake') return [];
  let targets: HexId[];
  if (at === 'home') {
    targets = [...(board.homeBases[state.setup.players[seat]!.faction.homeBase] ?? [])];
  } else {
    targets = neighbors(board, at).filter((to) => !hasRiver(board, at, to) || crosses(to));
    const tunnels = Object.values(board.hexes).filter((h) => h.tunnel).map((h) => h.id);
    if (player.structures.mine) tunnels.push(player.structures.mine);
    if (tunnels.includes(at)) targets.push(...tunnels.filter((t) => t !== at));
    if (fighter && rules.some((r) => r.kind === 'villagesToFactory')) {
      const factories = Object.values(board.hexes).filter((h) => h.terrain === 'factory').map((h) => h.id);
      if (terrain(at) === 'village') targets.push(...factories);
      if (terrain(at) === 'factory') targets.push(...[...controlledHexes(state, seat)].filter((h) => terrain(h) === 'village'));
    }
  }
  const lakes = fighter && rules.some((r) => r.kind === 'lakes');
  return [...new Set(targets)].filter((to) => to !== at && (terrain(to) !== 'lake' || lakes) && (fighter || !enemies.has(to)));
}

/** Extra hexes a unit may move after its first (Speed), for the character and mechs. */
const extraHexes = (state: GameState, seat: number, unit: UnitRef) =>
  unit.kind === 'worker' ? 0 : rulesOfKind(state, seat, 'speed').reduce((n, r) => n + r.extra, 0);

/** What this unit is carrying, if the current load is its. */
const loadOf = (turn: TopStep, unit: UnitRef): Load | undefined =>
  turn.step === 'moving' && turn.load && sameUnit(turn.load.unit, unit) ? turn.load : undefined;

const isLake = (state: GameState, at: Location) => at !== 'home' && state.setup.board.hexes[at]?.terrain === 'lake';

/**
 * What goes along when a unit moves: its load, plus, when it's the last of
 * your units on a lake that can take them, everything else there (workers
 * and resources on a lake never leave the mechs; the character carries
 * resources only).
 */
function withLakeCargo(state: GameState, seat: number, unit: UnitRef, from: Location, load: Load | undefined): Load | undefined {
  if (!isLake(state, from) || unit.kind === 'worker') return load;
  const player = state.players[seat]!;
  const others = unitsOf(player).filter((u) => u.at === from && u.unit.kind !== 'worker' && !sameUnit(u.unit, unit));
  const next: Load = { unit, workers: [...(load?.workers ?? [])], resources: { ...load?.resources } };
  if (unit.kind === 'mech' && !others.some((u) => u.unit.kind === 'mech')) {
    player.workers.forEach((w, i) => w === from && !next.workers.includes(i) && next.workers.push(i));
  }
  if (others.length === 0) next.resources = { ...state.resources[from] };
  return next;
}

/** Units that haven't moved yet, while the section allows more: their moves and pick-ups. `load`: only that unit, with it. */
function moveOptions(state: GameState, section: SectionIndex, moved: UnitRef[], load?: Load): Action[] {
  const { player, mat } = current(state);
  if (moved.length >= topValue(player, mat, section, 'units')) return [];
  const actions: Action[] = [];
  for (const { unit, at } of unitsOf(player)) {
    if (load ? !sameUnit(load.unit, unit) : moved.some((m) => sameUnit(m, unit))) continue;
    for (const to of moveTargets(state, state.currentPlayer, at, unit.kind)) actions.push({ type: 'moveUnit', unit, to });
    if (!load) actions.push(...carryOptions(state, unit));
  }
  return actions;
}

/** A unit partway through its move: its next hex, and dropping off or picking up here. */
function walkOptions(state: GameState, turn: Extract<TopStep, { step: 'moving' }>): Action[] {
  if (!turn.walking) return [];
  const unit = turn.walking.unit;
  const load = loadOf(turn, unit);
  const at = unitsOf(current(state).player).find((u) => sameUnit(u.unit, unit))!.at;
  const actions: Action[] = moveTargets(state, state.currentPlayer, at, unit.kind).map((to): Action => ({ type: 'moveUnit', unit, to }));
  actions.push(...carryOptions(state, unit, load));
  // Nothing is dropped off on a lake.
  if (isLake(state, at)) return actions;
  for (const worker of load?.workers ?? []) actions.push({ type: 'dropWorker', unit, worker });
  for (const resource of RESOURCES) if (load?.resources[resource]) actions.push({ type: 'dropResource', unit, resource });
  return actions;
}

/** What a unit can still pick up before it moves: resources on its hex, and (for a mech) workers there. */
function carryOptions(state: GameState, unit: UnitRef, load?: Load): Action[] {
  const { player } = current(state);
  const at = unitsOf(player).find((u) => sameUnit(u.unit, unit))!.at;
  if (moveTargets(state, state.currentPlayer, at, unit.kind).length === 0) return [];
  const actions: Action[] = [];
  if (unit.kind === 'mech') {
    player.workers.forEach((w, worker) => {
      if (w === at && !load?.workers.includes(worker)) actions.push({ type: 'carryWorker', unit, worker });
    });
  }
  for (const resource of at === 'home' ? [] : RESOURCES) {
    if ((state.resources[at]?.[resource] ?? 0) > (load?.resources[resource] ?? 0)) {
      actions.push({ type: 'carryResource', unit, resource });
    }
  }
  return actions;
}

/** Moves a unit, with whatever it picked up, to `to`. */
function moveUnit(state: GameState, seat: number, unit: UnitRef, to: HexId, load: Load | undefined): GameState {
  const player = state.players[seat]!;
  const from = unitsOf(player).find((u) => sameUnit(u.unit, unit))!.at;
  const carried: Pick<Load, 'workers' | 'resources'> = load && sameUnit(load.unit, unit) ? load : { workers: [], resources: {} };
  const isUnit = (kind: 'mech' | 'worker', i: number) => sameUnit(unit, { kind, index: i });
  let next = updatePlayer(state, seat, {
    character: unit.kind === 'character' ? to : player.character,
    mechs: player.mechs.map((at, i) => (isUnit('mech', i) ? to : at)),
    workers: player.workers.map((at, i) => (isUnit('worker', i) || carried.workers.includes(i) ? to : at)),
  });
  if (from !== 'home') {
    for (const [resource, n] of Object.entries(carried.resources) as [Resource, number][]) {
      next = addResources(addResources(next, from, resource, -n), to, resource, n);
    }
  }
  return next;
}

// ---- Trade ----

/** A traded resource goes on any hex with one of your workers (not a lake, where they ride on a mech). */
const tradeResourceOptions = (state: GameState, player: PlayerState): Action[] =>
  [...new Set(onBoard(player.workers))].filter((hex) => !isLake(state, hex)).flatMap((hex) => RESOURCES.map((resource): Action => ({ type: 'tradeResource', resource, hex })));

// ---- Produce ----

const workersOn = (player: PlayerState, hex: HexId) => player.workers.filter((w) => w === hex).length;

/**
 * Producing costs more as your workers grow: with 4 or more on the board,
 * 1 power; 6 or more, also 1 popularity; all 8, also 1 coin.
 */
export function produceCost(player: PlayerState): { power: number; popularity: number; coins: number } {
  const n = player.workers.length;
  return { power: n >= 4 ? 1 : 0, popularity: n >= 6 ? 1 : 0, coins: n >= 8 ? 1 : 0 };
}

const canPayProduceCost = (player: PlayerState) => {
  const cost = produceCost(player);
  return player.power >= cost.power && player.popularity >= cost.popularity && player.coins >= cost.coins;
};

function payProduceCost(state: GameState, seat: number): GameState {
  const player = state.players[seat]!;
  const cost = produceCost(player);
  return updatePlayer(state, seat, {
    power: player.power - cost.power,
    popularity: player.popularity - cost.popularity,
    coins: player.coins - cost.coins,
  });
}

/**
 * How much a hex would produce: one per worker of yours there, plus one if
 * your mill is on it (villages: new workers, up to 8 in all).
 */
export function yieldOf(state: GameState, player: PlayerState, hex: HexId): { what: Resource | 'worker'; amount: number } | null {
  const what = TERRAIN_PRODUCES[state.setup.board.hexes[hex]?.terrain ?? ''];
  if (!what) return null;
  const producers = workersOn(player, hex) + (player.structures.mill === hex ? 1 : 0);
  const amount = what === 'worker' ? Math.min(producers, MAX_WORKERS - player.workers.length) : producers;
  return amount > 0 ? { what, amount } : null;
}

/**
 * Hexes with your workers, and your mill's hex if you control it, that would
 * produce something. The mill's hex is an extra one: it doesn't count toward
 * the section's hex limit, so once that's used up only the mill's hex is left.
 */
function produceOptions(state: GameState, section: SectionIndex, produced: HexId[]): Action[] {
  const { seat, player, mat } = current(state);
  const hexes = new Set(onBoard(player.workers));
  const mill = player.structures.mill;
  if (mill && controlledHexes(state, seat).has(mill)) hexes.add(mill);
  const limitReached = produced.filter((hex) => hex !== mill).length >= topValue(player, mat, section, 'hexes');
  return [...hexes]
    .filter((hex) => !produced.includes(hex) && yieldOf(state, player, hex))
    .filter((hex) => !limitReached || hex === mill)
    .map((hex) => ({ type: 'produce', hex }));
}

function produce(state: GameState, seat: number, hex: HexId): GameState {
  const player = state.players[seat]!;
  const y = yieldOf(state, player, hex)!;
  if (y.what === 'worker') {
    return updatePlayer(state, seat, { workers: [...player.workers, ...Array<HexId>(y.amount).fill(hex)] });
  }
  return addResources(state, hex, y.what, y.amount);
}
