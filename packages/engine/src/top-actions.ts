// The four top-row actions: Move, Trade, Produce and Bolster.
//
// Basic versions for now. Still to come with the movement and production
// rules: rivers for some units, tunnels and the mine, carrying workers and
// resources, the mill, and the extra cost of producing as workers grow.
import { hasRiver, neighbors, type HexId } from './board';
import type { Action, GameState, Location, PlayerState, SectionIndex, TurnStep, UnitRef } from './game';
import type { Resource, TopAction } from './mat';
import { addResources, current, enemyUnitHexes, gain, MAX_WORKERS, topValue, updatePlayer } from './state';

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
      return [...moveOptions(state, turn.section, turn.moved), { type: 'endMove' }];
    case 'trading':
      return tradeResourceOptions(player);
    case 'producing':
      return [...produceOptions(state, turn.produced), { type: 'endProduce' }];
    case 'top':
      switch (top.action) {
        case 'move':
          return [{ type: 'gainCoins' }, ...moveOptions(state, turn.section, [])];
        case 'trade':
          if (player.coins < top.cost) return [];
          return [...tradeResourceOptions(player), { type: 'tradePopularity' }];
        case 'produce':
          return produceOptions(state, []);
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

    case 'moveUnit': {
      const moved = [...(turn.step === 'moving' ? turn.moved : []), action.unit];
      const next = updatePlayer(state, seat, moveUnit(player, action.unit, action.to));
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
      return { ...next, turn: { step: 'trading', section, left } };
    }

    case 'produce': {
      const produced = [...(turn.step === 'producing' ? turn.produced : []), action.hex];
      const next = produce(state, seat, action.hex);
      if (produced.length >= value('hexes')) return toBottom(next);
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

/** Each unit moves one hex: not onto lakes, across rivers, back home, or (until combat exists) onto other players' units. */
function moveOptions(state: GameState, section: SectionIndex, moved: UnitRef[]): Action[] {
  const { seat, player, mat, faction } = current(state);
  if (moved.length >= topValue(player, mat, section, 'units')) return [];
  const board = state.setup.board;
  const enemies = enemyUnitHexes(state, seat);
  const actions: Action[] = [];
  for (const { unit, at } of unitsOf(player)) {
    if (moved.some((m) => sameUnit(m, unit))) continue;
    const targets = at === 'home' ? (board.homeBases[faction.homeBase] ?? []) : neighbors(board, at);
    for (const to of targets) {
      if (board.hexes[to]?.terrain === 'lake' || enemies.has(to)) continue;
      if (at !== 'home' && hasRiver(board, at, to)) continue;
      actions.push({ type: 'moveUnit', unit, to });
    }
  }
  return actions;
}

function moveUnit(player: PlayerState, unit: UnitRef, to: HexId): Partial<PlayerState> {
  if (unit.kind === 'character') return { character: to };
  const key = unit.kind === 'mech' ? 'mechs' : 'workers';
  return { [key]: player[key].map((at, i) => (i === unit.index ? to : at)) };
}

// ---- Trade ----

/** A traded resource goes on any hex with one of your workers. */
const tradeResourceOptions = (player: PlayerState): Action[] =>
  [...new Set(player.workers)].flatMap((hex) => RESOURCES.map((resource): Action => ({ type: 'tradeResource', resource, hex })));

// ---- Produce ----

const workersOn = (player: PlayerState, hex: HexId) => player.workers.filter((w) => w === hex).length;

/** How much a hex with your workers would produce: one per worker (villages: new workers, up to 8 in all). */
function yieldOf(state: GameState, player: PlayerState, hex: HexId): { what: Resource | 'worker'; amount: number } | null {
  const what = TERRAIN_PRODUCES[state.setup.board.hexes[hex]?.terrain ?? ''];
  if (!what) return null;
  const workers = workersOn(player, hex);
  const amount = what === 'worker' ? Math.min(workers, MAX_WORKERS - player.workers.length) : workers;
  return amount > 0 ? { what, amount } : null;
}

function produceOptions(state: GameState, produced: HexId[]): Action[] {
  const { player } = current(state);
  return [...new Set(player.workers)]
    .filter((hex) => !produced.includes(hex) && yieldOf(state, player, hex))
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
