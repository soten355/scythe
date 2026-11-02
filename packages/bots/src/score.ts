// The position score: how well a seat is doing, as one number in roughly
// coins, the way Scythe is won. Bots compare the turns the planner finds by it.
//
// A player's value is what they'd score if the game ended now (coins, plus
// stars, territories and resources at their popularity's rates, plus the
// structure bonus), plus what should pay off before the end: upgrades, mechs,
// structures, recruits, workers, power, combat cards, closeness to each
// star, and the character's distance to encounters and the Factory. Those
// count for less as the game nears its end (when the leader nears 6 stars),
// and for nothing once it's over.
//
// The score is a seat's value minus a share (`rivalry`) of the best other
// player's. It reads only what that seat could know: everyone's combat cards
// count by number, not value (so a plan that draws cards doesn't peek at
// them), and only the seat's own objective cards are looked at.
//
// Every number it weighs is in Weights, plain data: faction personalities
// tilt them, and self-play tuning can adjust them.
import {
  bottomCost,
  controlledHexes,
  hasRiver,
  isGameOver,
  MAX_POPULARITY,
  MAX_POWER,
  MAX_WORKERS,
  neighbors,
  onBoard,
  RESOURCES,
  TERRAIN_PRODUCES,
  objectiveCard,
  objectiveMet,
  structureBonusCoins,
  structureBonusCount,
  structureBonusTile,
  territories,
  tierOf,
  type Board,
  type BottomActionType,
  type GameState,
  type HexId,
  type PlayerMat,
  type PlayerState,
  type Rates,
  type Resource,
  type SectionIndex,
} from '@scythe/engine';

export interface Weights {
  /** Extra worth of a placed star, on top of its coins at the popularity rate. */
  star: number;
  /** Coins per point of popularity (its tier's rates are counted as well). */
  popularity: number;
  /** Per point of power. */
  power: number;
  /** Per combat card in hand. */
  combatCard: number;
  /** Per resource controlled, as fuel for the bottom-row actions still to take (on top of its end-of-game coins). */
  resource: number;
  /** Per kind of resource still needed that a worker of yours can produce (a village counts while you have fewer than 8 workers). */
  produces: number;
  // Worth of what pays off over the rest of the game, at the start of it (falling to nothing by its end):
  upgrade: number;
  mech: number;
  structure: number;
  recruit: number;
  worker: number;
  /** Holding a Factory card. */
  factoryCard: number;
  /** Most of a star's worth for being close to it: this times (how close, 0-1) squared. */
  nearStar: number;
  /** One of your own objectives whose conditions hold now. */
  objectiveReady: number;
  /** Per hex the character stands from the nearest encounter, or from the Factory before taking a card (subtracted). */
  distance: number;
  /** How much the best other player's value counts against yours (0: ignore the others; 1: only the lead matters). */
  rivalry: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  star: 3,
  popularity: 0.3,
  power: 0.25,
  combatCard: 0.6,
  resource: 0.5,
  produces: 2,
  upgrade: 2.5,
  mech: 3,
  structure: 2,
  recruit: 3,
  worker: 1.5,
  factoryCard: 3,
  nearStar: 3,
  objectiveReady: 3,
  distance: 0.4,
  rivalry: 0.5,
};

/** A player's value, part by part (the parts add up to the total). */
export interface Valuation {
  total: number;
  parts: Record<string, number>;
}

/** The score of `seat`'s position, as seen by that seat: higher is better. */
export function positionScore(state: GameState, seat: number, weights: Weights = DEFAULT_WEIGHTS): number {
  const mine = playerValue(state, seat, seat, weights).total;
  const others = state.players.map((_p, i) => i).filter((i) => i !== seat);
  if (others.length === 0) return mine;
  const best = Math.max(...others.map((i) => playerValue(state, i, seat, weights).total));
  return mine - weights.rivalry * best;
}

/** The value of `seat`'s position, as `viewer` can judge it (only the viewer's own objectives are known). */
export function playerValue(state: GameState, seat: number, viewer: number, weights: Weights = DEFAULT_WEIGHTS): Valuation {
  const player = state.players[seat]!;
  const { faction, mat } = state.setup.players[seat]!;
  // How much of the game is left: 1 at the start, 0 once someone places their last star.
  const left = isGameOver(state) ? 0 : 1 - Math.max(...state.players.map((p, i) => p.stars.length / state.setup.players[i]!.faction.stars));
  const rates = blendedRates(player.popularity, left);
  const stock = resourcesControlled(state, seat);
  const resources = RESOURCES.reduce((n, r) => n + stock[r], 0);
  const structures = Object.values(player.structures).filter(Boolean).length;
  const need = resourcesNeeded(player, mat, structures);
  const tile = structureBonusTile(state);

  const parts: Record<string, number> = {
    // What final scoring would give now.
    coins: player.coins,
    stars: player.stars.length * (rates.star + weights.star),
    territories: territories(state, seat) * rates.territory,
    resources: Math.floor(resources / 2) * rates.resources,
    structureBonus: tile ? structureBonusCoins(tile, structureBonusCount(state, seat, tile)) : 0,
    popularity: player.popularity * weights.popularity,
  };

  if (left > 0) {
    // What pays off before the end, worth less as it nears.
    const future: Record<string, number> = {
      // Resources as fuel: only as many as the bottom-row actions still to take can use.
      fuel: RESOURCES.reduce((n, r) => n + Math.min(stock[r], need[r]), 0) * weights.resource,
      produces: producible(state, player, stock, need) * weights.produces,
      power: player.power * weights.power,
      combatCards: player.combatCards.length * weights.combatCard,
      upgrades: player.upgrades.top.length * weights.upgrade,
      mechs: player.mechs.length * weights.mech,
      structures: structures * weights.structure,
      recruits: player.recruits.length * weights.recruit,
      workers: player.workers.length * weights.worker,
      factoryCard: player.factoryCard ? weights.factoryCard : 0,
      nearStars: nearStars(player, structures, faction.stars) * weights.nearStar,
      objectives: seat === viewer ? readyObjectives(state, seat) * weights.objectiveReady : 0,
      distance: -characterDistance(state, seat) * weights.distance,
    };
    for (const [k, v] of Object.entries(future)) parts[k] = v * left;
  }

  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total, parts };
}

/**
 * Coins per star, territory and 2 resources. At the end, the popularity
 * tier's. Before then, plus part of the next tier's extra coin, for how far
 * the player is toward it (so points toward a tier are worth something
 * before it's reached); this fades in the last third of the game.
 */
function blendedRates(popularity: number, left: number): Rates {
  const tier = tierOf(popularity);
  const [start, next] = popularity >= 13 ? [13, Infinity] : popularity >= 7 ? [7, 13] : [0, 7];
  const toward = next === Infinity ? 0 : ((popularity - start) / (next - start)) * Math.min(1, 3 * left);
  return { star: tier.star + toward, territory: tier.territory + toward, resources: tier.resources + toward };
}

type Stock = Record<Resource, number>;

/** Resources on hexes the player controls, by kind, plus any paid toward this turn's bottom-row action or Factory card. */
function resourcesControlled(state: GameState, seat: number): Stock {
  const stock: Stock = { oil: 0, metal: 0, wood: 0, food: 0 };
  for (const hex of controlledHexes(state, seat)) {
    for (const r of RESOURCES) stock[r] += state.resources[hex]?.[r] ?? 0;
  }
  for (const [r, n] of Object.entries(paidThisTurn(state, seat)) as [Resource, number][]) stock[r] += n;
  return stock;
}

/** How many of each resource the bottom-row actions still to take would cost, at today's (upgraded) costs. */
function resourcesNeeded(player: PlayerState, mat: PlayerMat, structures: number): Stock {
  const need: Stock = { oil: 0, metal: 0, wood: 0, food: 0 };
  const left: Record<BottomActionType, number> = {
    upgrade: 6 - player.upgrades.top.length,
    deploy: 4 - player.mechs.length,
    build: 4 - structures,
    enlist: 4 - player.recruits.length,
  };
  mat.sections.forEach((section, i) => {
    const { amount, resource } = bottomCost(player, mat, i as SectionIndex);
    need[resource] += Math.max(0, left[section.bottom.action]) * amount;
  });
  return need;
}

/** Kinds of resource still short that the player's workers stand ready to produce, plus a village while they have fewer than 8 workers. */
function producible(state: GameState, player: PlayerState, stock: Stock, need: Stock): number {
  const made = new Set(onBoard(player.workers).map((h) => TERRAIN_PRODUCES[state.setup.board.hexes[h]?.terrain ?? '']));
  const short = RESOURCES.filter((r) => need[r] > stock[r] && made.has(r)).length;
  return short + (player.workers.length < MAX_WORKERS && made.has('worker') ? 1 : 0);
}

/**
 * Resources paid so far toward this turn's bottom-row action or Factory card,
 * counted as still there: half-way through paying is as good as not having
 * started (so a search doesn't give up on a bottom-row action half-way).
 */
function paidThisTurn(state: GameState, seat: number): Partial<Stock> {
  if (seat !== state.currentPlayer) return {};
  const turn = state.turn;
  if (turn.step === 'bottom' && turn.paid > 0) {
    const { player, mat } = { player: state.players[seat]!, mat: state.setup.players[seat]!.mat };
    return { [bottomCost(player, mat, turn.section).resource]: turn.paid - (turn.coerced ? 1 : 0) };
  }
  if (turn.step === 'factoryTop') {
    const paid: Partial<Stock> = { ...turn.paid };
    if (turn.coerced) {
      // The combat card stood in for one of them; which one doesn't much matter.
      const r = RESOURCES.find((k) => (paid[k] ?? 0) > 0);
      if (r) paid[r]! -= 1;
    }
    return paid;
  }
  return {};
}

/** How close a player is to each star they haven't placed, as (fraction of the way) squared, added up. */
function nearStars(player: PlayerState, structures: number, starsAllowed: number): number {
  if (player.stars.length >= starsAllowed) return 0;
  const goals: [string, number][] = [
    ['upgrades', player.upgrades.top.length / 6],
    ['mechs', player.mechs.length / 4],
    ['structures', structures / 4],
    ['recruits', player.recruits.length / 4],
    ['workers', player.workers.length / MAX_WORKERS],
    ['popularity', player.popularity / MAX_POPULARITY],
    ['power', player.power / MAX_POWER],
  ];
  return goals.filter(([kind]) => !player.stars.includes(kind as PlayerState['stars'][number])).reduce((n, [, f]) => n + Math.min(1, f) ** 2, 0);
}

function readyObjectives(state: GameState, seat: number): number {
  const player = state.players[seat]!;
  if (player.stars.includes('objective')) return 0;
  return player.objectives.filter((id) => objectiveMet(state, seat, objectiveCard(state, id))).length > 0 ? 1 : 0;
}

/** Hexes from the character to the nearest encounter token, or to the Factory while it has no Factory card (whichever is nearer). */
function characterDistance(state: GameState, seat: number): number {
  const player = state.players[seat]!;
  const board = state.setup.board;
  const targets: HexId[] = [...state.encounterTokens];
  if (!player.factoryCard) targets.push(...Object.values(board.hexes).filter((h) => h.terrain === 'factory').map((h) => h.id));
  if (targets.length === 0) return 0;
  const from: HexId[] = player.character in board.hexes ? [player.character] : [...(board.homeBases[state.setup.players[seat]!.faction.homeBase] ?? [])];
  const start = player.character in board.hexes ? 0 : 1;
  const dist = distances(board);
  return start + Math.min(...from.flatMap((a) => targets.map((b) => dist(a, b))));
}

const distanceCache = new WeakMap<Board, (a: HexId, b: HexId) => number>();

/** Steps between two hexes over land, not across rivers (abilities aside), worked out once per board. */
function distances(board: Board): (a: HexId, b: HexId) => number {
  const cached = distanceCache.get(board);
  if (cached) return cached;
  const table = new Map<HexId, Map<HexId, number>>();
  const land = (h: HexId) => board.hexes[h]?.terrain !== 'lake';
  const from = (a: HexId) => {
    let row = table.get(a);
    if (row) return row;
    row = new Map([[a, 0]]);
    const queue = [a];
    for (let i = 0; i < queue.length; i++) {
      const h = queue[i]!;
      for (const n of neighbors(board, h)) {
        if (row.has(n) || !land(n) || hasRiver(board, h, n)) continue;
        row.set(n, row.get(h)! + 1);
        queue.push(n);
      }
    }
    table.set(a, row);
    return row;
  };
  // Unreachable (across a river with no way round): far, but not infinitely.
  const fn = (a: HexId, b: HexId) => from(a).get(b) ?? 10;
  distanceCache.set(board, fn);
  return fn;
}
