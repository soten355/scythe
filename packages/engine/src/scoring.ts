// Final scoring. The game ends the moment a player places their last
// (sixth) star. Each player then counts coins in hand, plus coins for each
// star placed, each territory controlled, and each 2 resources controlled,
// at rates set by their popularity tier. The Factory counts as three
// territories; home bases don't count. Structure bonus tiles arrive with
// that content. Ties are broken by units and recruits, then power, then
// popularity, then resources, territories and stars.
import type { HexId } from './board';
import type { GameState } from './game';
import { controlledHexes } from './state';

export interface Rates {
  star: number;
  territory: number;
  /** Coins per 2 resources. */
  resources: number;
}

/** Popularity 0-6, 7-12 and 13-18. */
export const POPULARITY_TIERS: readonly Rates[] = [
  { star: 3, territory: 2, resources: 1 },
  { star: 4, territory: 3, resources: 2 },
  { star: 5, territory: 4, resources: 3 },
];

export function tierOf(popularity: number): Rates {
  return POPULARITY_TIERS[popularity >= 13 ? 2 : popularity >= 7 ? 1 : 0]!;
}

export interface ScoreLine {
  count: number;
  rate: number;
  coins: number;
}

export interface PlayerScore {
  seat: number;
  /** Coins in hand. */
  coins: number;
  popularity: number;
  stars: ScoreLine;
  territories: ScoreLine;
  resources: ScoreLine;
  total: number;
}

/** Territories a player controls: the Factory counts three, every other hex (lakes too) one. */
const territoryCount = (state: GameState, hexes: HexId[]) => hexes.reduce((n, h) => n + (state.setup.board.hexes[h]?.terrain === 'factory' ? 3 : 1), 0);

/** How many territories a player controls now, as final scoring counts them (the Factory as three). */
export const territories = (state: GameState, seat: number): number => territoryCount(state, [...controlledHexes(state, seat)]);

/** Resources lying on hexes the player controls. */
const resourceCount = (state: GameState, hexes: HexId[]) =>
  hexes.reduce((n, h) => n + Object.values(state.resources[h] ?? {}).reduce((a, b) => a + (b ?? 0), 0), 0);

/** Each player's score, in seat order. */
export function score(state: GameState): PlayerScore[] {
  return state.players.map((player, seat) => {
    const rates = tierOf(player.popularity);
    const hexes = [...controlledHexes(state, seat)];
    const line = (count: number, rate: number, per = 1): ScoreLine => ({ count, rate, coins: Math.floor(count / per) * rate });
    const stars = line(player.stars.length, rates.star);
    const land = line(territoryCount(state, hexes), rates.territory);
    const resources = line(resourceCount(state, hexes), rates.resources, 2);
    return {
      seat,
      coins: player.coins,
      popularity: player.popularity,
      stars,
      territories: land,
      resources,
      total: player.coins + stars.coins + land.coins + resources.coins,
    };
  });
}

export interface Standing extends PlayerScore {
  /** 1 for the winner; players level on every tie-breaker share a place. */
  place: number;
}

/** Players from first to last: most coins, then the tie-breakers in order. */
export function standings(state: GameState): Standing[] {
  const scores = score(state);
  const keys = (s: PlayerScore): number[] => {
    const p = state.players[s.seat]!;
    return [
      s.total,
      p.workers.length + p.mechs.length + Object.values(p.structures).filter(Boolean).length + p.recruits.length,
      p.power,
      p.popularity,
      s.resources.count,
      s.territories.count,
      s.stars.count,
    ];
  };
  const compare = (a: PlayerScore, b: PlayerScore) => {
    const [ka, kb] = [keys(a), keys(b)];
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i]! - ka[i]!;
    return 0;
  };
  const sorted = [...scores].sort((a, b) => compare(a, b) || a.seat - b.seat);
  return sorted.map((s) => ({ ...s, place: 1 + sorted.findIndex((t) => compare(s, t) === 0) }));
}
