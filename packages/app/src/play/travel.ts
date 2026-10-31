// A unit's move, for the map to animate: the hexes it passed through and
// what it carried. Worked out from the game before and after the actions.
import type { Action, GameState, Location, Resource, ResourcePile, UnitRef } from '@scythe/engine';

export interface Travel {
  id: number;
  seat: number;
  kind: 'character' | 'mechs' | 'workers';
  /** Where it started, then each hex it entered. */
  path: Location[];
  /** Workers and resources that came along, unloaded where it ends up. */
  workers: number;
  resources: ResourcePile;
}

const KIND = { character: 'character', mech: 'mechs', worker: 'workers' } as const;

const locationOf = (state: GameState, seat: number, unit: UnitRef): Location => {
  const p = state.players[seat]!;
  return unit.kind === 'character' ? p.character : (unit.kind === 'mech' ? p.mechs : p.workers)[unit.index]!;
};

/** The move made by `actions` (one unit, one hex or several), or null if they moved nothing. */
export function travelOf(before: GameState, after: GameState, actions: Action[], id: number): Travel | null {
  const moves = actions.filter((a) => a.type === 'moveUnit');
  if (!moves.length) return null;
  const unit = moves[0]!.unit;
  const seat = before.currentPlayer;
  const path: Location[] = [locationOf(before, seat, unit), ...moves.map((m) => m.to)];
  const end = path[path.length - 1]!;
  const was = before.players[seat]!.workers;
  const now = after.players[seat]!.workers;
  const workers = now.filter((at, i) => at === end && was[i] !== end && !(unit.kind === 'worker' && unit.index === i)).length;
  const resources: ResourcePile = {};
  for (const [r, n] of Object.entries(after.resources[end] ?? {}) as [Resource, number][]) {
    const gained = n - (before.resources[end]?.[r] ?? 0);
    if (gained > 0) resources[r] = gained;
  }
  return { id, seat, kind: KIND[unit.kind], path, workers, resources };
}
