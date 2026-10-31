// The four top-row actions: Move, Trade, Produce and Bolster.
//
// Still to come in Phase 2, with mech and faction abilities: crossing
// rivers, moving onto lakes, moving two hexes, and combat when moving onto
// another player's units. When a mech moves two hexes, it may drop off and
// pick up any workers and resources at the hex in between, then keep moving
// (one load/move step per hex should handle this).
import { hasRiver, neighbors, type HexId } from './board';
import type { Action, GameState, Load, Location, PlayerState, SectionIndex, TurnStep, UnitRef } from './game';
import type { Resource, TopAction } from './mat';
import { addResources, controlledHexes, current, enemyUnitHexes, gain, MAX_WORKERS, topValue, updatePlayer } from './state';

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
      if (turn.load) return [...carryOptions(state, turn.load.unit, turn.load), ...moveOptions(state, turn.section, turn.moved, turn.load.unit)];
      return [...moveOptions(state, turn.section, turn.moved), { type: 'endMove' }];
    case 'trading':
      // Every traded resource goes on the hex the first one went to.
      return tradeResourceOptions(player).filter((a) => a.type === 'tradeResource' && a.hex === turn.hex);
    case 'producing':
      return [...produceOptions(state, turn.section, turn.produced), { type: 'endProduce' }];
    case 'top':
      switch (top.action) {
        case 'move':
          return [{ type: 'gainCoins' }, ...moveOptions(state, turn.section, [])];
        case 'trade':
          if (player.coins < top.cost) return [];
          return [...tradeResourceOptions(player), { type: 'tradePopularity' }];
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

  switch (action.type) {
    case 'gainCoins':
      return toBottom(updatePlayer(state, seat, gain(player, { coins: value('coins') })));

    case 'carryWorker':
    case 'carryResource': {
      const moved = turn.step === 'moving' ? turn.moved : [];
      const load: Load = (turn.step === 'moving' && turn.load) || { unit: action.unit, workers: [], resources: {} };
      const next: Load =
        action.type === 'carryWorker'
          ? { ...load, workers: [...load.workers, action.worker] }
          : { ...load, resources: { ...load.resources, [action.resource]: (load.resources[action.resource] ?? 0) + 1 } };
      return { ...state, turn: { step: 'moving', section, moved, load: next } };
    }

    case 'moveUnit': {
      const moved = [...(turn.step === 'moving' ? turn.moved : []), action.unit];
      const load = turn.step === 'moving' ? turn.load : undefined;
      const next = moveUnit(state, seat, action.unit, action.to, load);
      if (moved.length >= value('units')) return toBottom(next);
      return { ...next, turn: { step: 'moving', section, moved } };
    }
    case 'endMove':
      return toBottom(state);

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
      return toBottom(updatePlayer(state, seat, gain(payTopCost(player, top), { [action.gain]: value(action.gain), ...monument })));
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
 * mine. Never onto a lake, back home, or (until combat exists) onto other
 * players' units. From home: the hexes bordering the home base.
 */
export function moveTargets(state: GameState, seat: number, at: Location): HexId[] {
  const board = state.setup.board;
  const player = state.players[seat]!;
  const enemies = enemyUnitHexes(state, seat);
  let targets: HexId[];
  if (at === 'home') {
    targets = [...(board.homeBases[state.setup.players[seat]!.faction.homeBase] ?? [])];
  } else {
    targets = neighbors(board, at).filter((to) => !hasRiver(board, at, to));
    const tunnels = Object.values(board.hexes).filter((h) => h.tunnel).map((h) => h.id);
    if (player.structures.mine) tunnels.push(player.structures.mine);
    if (tunnels.includes(at)) targets.push(...tunnels.filter((t) => t !== at));
  }
  return [...new Set(targets)].filter((to) => board.hexes[to]?.terrain !== 'lake' && !enemies.has(to));
}

function moveOptions(state: GameState, section: SectionIndex, moved: UnitRef[], only?: UnitRef): Action[] {
  const { seat, player, mat } = current(state);
  if (moved.length >= topValue(player, mat, section, 'units')) return [];
  const actions: Action[] = [];
  for (const { unit, at } of unitsOf(player)) {
    if (only ? !sameUnit(only, unit) : moved.some((m) => sameUnit(m, unit))) continue;
    for (const to of moveTargets(state, seat, at)) actions.push({ type: 'moveUnit', unit, to });
    if (!only) actions.push(...carryOptions(state, unit));
  }
  return actions;
}

/** What a unit can still pick up before it moves: resources on its hex, and (for a mech) workers there. */
function carryOptions(state: GameState, unit: UnitRef, load?: Load): Action[] {
  const { player } = current(state);
  const at = unitsOf(player).find((u) => sameUnit(u.unit, unit))!.at;
  if (at === 'home' || moveTargets(state, state.currentPlayer, at).length === 0) return [];
  const actions: Action[] = [];
  if (unit.kind === 'mech') {
    player.workers.forEach((w, worker) => {
      if (w === at && !load?.workers.includes(worker)) actions.push({ type: 'carryWorker', unit, worker });
    });
  }
  for (const resource of RESOURCES) {
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

/** A traded resource goes on any hex with one of your workers. */
const tradeResourceOptions = (player: PlayerState): Action[] =>
  [...new Set(player.workers)].flatMap((hex) => RESOURCES.map((resource): Action => ({ type: 'tradeResource', resource, hex })));

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
  const hexes = new Set(player.workers);
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
