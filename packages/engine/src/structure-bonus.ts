// Structure bonus tiles: one is drawn at random at setup and shown to all.
// At the end of the game each player counts what the tile asks about their
// structures (built ones, wherever they are, whoever controls the hex) and
// gets the coins for the highest step reached, whatever their popularity.
//
// A tile is data, so the real ones can be entered in an editor: what it
// counts, and its payout steps. A game whose setup has no tiles (one saved
// before them) draws none.
import type { HexId, Terrain } from './board';
import type { GameState } from './game';
import { nextInt } from './rng';

export type StructureFeature = 'tunnel' | 'lake' | 'encounter';

export type StructureCount =
  /** Hexes of this kind next to any of your structures, each hex once. */
  | { kind: 'adjacent'; feature: StructureFeature }
  /** Your structures on a tunnel (printed on the map: a Mine doesn't make one), or on one of these terrains. */
  | { kind: 'on'; tunnel?: boolean; terrains?: Terrain[] }
  /** Your structures in the longest straight row of hexes side by side, along any of the three lines; rivers don't break it. */
  | { kind: 'inRow' };

export interface StructureBonusTile {
  /** Neutral ID, e.g. "structure-bonus-01". */
  id: string;
  name: string;
  count: StructureCount;
  /** Coins for reaching each step, lowest first: the highest step reached pays. */
  pays: { atLeast: number; coins: number }[];
}

export const STRUCTURE_FEATURES: StructureFeature[] = ['tunnel', 'lake', 'encounter'];
const TERRAINS: Terrain[] = ['farm', 'forest', 'mountain', 'tundra', 'village', 'lake', 'factory'];
/** One way along each of the three lines through a hex. */
const LINES: [number, number][] = [
  [1, 0],
  [0, 1],
  [1, -1],
];

/** Draws the game's tile, if the game has any. */
export function setupStructureBonus(state: GameState): GameState {
  const tiles = state.setup.structureBonuses ?? [];
  if (tiles.length === 0) return state;
  const [pick, rng] = nextInt(state.rng, tiles.length);
  return { ...state, rng, structureBonus: tiles[pick]!.id };
}

/** The tile drawn for this game, if any. */
export const structureBonusTile = (state: GameState): StructureBonusTile | undefined =>
  state.structureBonus ? state.setup.structureBonuses?.find((t) => t.id === state.structureBonus) : undefined;

/** How many of what the tile counts this player has now. */
export function structureBonusCount(state: GameState, seat: number, tile: StructureBonusTile): number {
  const { hexes, adjacent } = state.setup.board;
  const built = Object.values(state.players[seat]!.structures).filter((h): h is HexId => !!h);
  const count = tile.count;
  switch (count.kind) {
    case 'adjacent': {
      const near = new Set(built.flatMap((h) => adjacent[h] ?? []));
      const has = (h: HexId) => {
        const hex = hexes[h];
        return count.feature === 'tunnel' ? !!hex?.tunnel : count.feature === 'lake' ? hex?.terrain === 'lake' : !!hex?.encounter;
      };
      return [...near].filter(has).length;
    }
    case 'on':
      return built.filter((h) => (count.tunnel && hexes[h]?.tunnel) || count.terrains?.includes(hexes[h]!.terrain)).length;
    case 'inRow': {
      const at = new Set(built.map((h) => `${hexes[h]!.q},${hexes[h]!.r}`));
      let best = 0;
      for (const h of built) {
        const { q, r } = hexes[h]!;
        for (const [dq, dr] of LINES) {
          let n = 1;
          while (at.has(`${q + dq * n},${r + dr * n}`)) n++;
          best = Math.max(best, n);
        }
      }
      return best;
    }
  }
}

/** Coins for a count: the highest step reached, or none. */
export function structureBonusCoins(tile: StructureBonusTile, count: number): number {
  return tile.pays.reduce((coins, step) => (count >= step.atLeast ? step.coins : coins), 0);
}

/** What's wrong with a tile, in plain words; empty when it's fine. */
export function validateStructureBonus(tile: StructureBonusTile): string[] {
  const problems: string[] = [];
  if (!tile.name?.trim()) problems.push('name is missing');
  if (!tile.id?.trim()) problems.push('ID is missing');
  const c = tile.count;
  const known =
    (c?.kind === 'adjacent' && STRUCTURE_FEATURES.includes(c.feature)) ||
    (c?.kind === 'on' && (c.terrains ?? []).every((t) => TERRAINS.includes(t))) ||
    c?.kind === 'inRow';
  if (!known) problems.push('it counts something unknown');
  else if (c.kind === 'on' && !c.tunnel && !c.terrains?.length) problems.push('it must count structures on tunnels or on some terrain');
  if (!Array.isArray(tile.pays) || tile.pays.length === 0) return [...problems, 'it needs at least one payout'];
  const whole = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0;
  if (!tile.pays.every((s, i) => whole(s.atLeast) && whole(s.coins) && (i === 0 || s.atLeast > tile.pays[i - 1]!.atLeast)))
    problems.push('payouts must be whole numbers of 0 or more, each step higher than the last');
  return problems;
}
