// The map screen on a phone (a whole screen just for the map): what each
// faction has out on the map, so tapping one can point the camera at it, and
// what's on a hex when it's tapped. Only what the table can see.
import { RESOURCES, STRUCTURES, type GameState, type HexId, type Location, type Resource, type Structure, type Terrain } from '@scythe/engine';

export interface FactionOnMap {
  seat: number;
  name: string;
  color: string;
  /** Where its units and structures are, its home base given as `base:<id>` (as the board names it). */
  spots: string[];
  mechs: number;
  workers: number;
  structures: number;
  stars: number;
  power: number;
}

/** Each faction in seat order, with what it has on the map. */
export function factionsOnMap(state: GameState): FactionOnMap[] {
  return state.players.map((p, seat) => {
    const { faction } = state.setup.players[seat]!;
    const named = (at: Location) => (at === 'home' ? `base:${faction.homeBase}` : at);
    const built = Object.values(p.structures).filter((h): h is HexId => !!h);
    const spots = [p.character, ...p.mechs, ...p.workers, ...built].map(named);
    return {
      seat,
      name: faction.name,
      color: faction.color,
      spots: [...new Set(spots)],
      mechs: p.mechs.length,
      workers: p.workers.length,
      structures: built.length,
      stars: p.stars.length,
      power: p.power,
    };
  });
}

export interface HexReport {
  hex: HexId;
  terrain: Terrain;
  units: { seat: number; name: string; color: string; character: boolean; mechs: number; workers: number }[];
  structures: { seat: number; color: string; structure: Structure }[];
  resources: { resource: Resource; amount: number }[];
  /** Its encounter token is still there. */
  encounter: boolean;
}

/** What's on a hex: whose units, what's built, what's lying there. Null for anything that isn't a hex of the map. */
export function hexReport(state: GameState, at: Location): HexReport | null {
  const hex = state.setup.board.hexes[at];
  if (!hex) return null;
  const units = state.players.flatMap((p, seat) => {
    const character = p.character === at;
    const mechs = p.mechs.filter((m) => m === at).length;
    const workers = p.workers.filter((w) => w === at).length;
    if (!character && !mechs && !workers) return [];
    const { faction } = state.setup.players[seat]!;
    return [{ seat, name: faction.name, color: faction.color, character, mechs, workers }];
  });
  const structures = state.players.flatMap((p, seat) =>
    STRUCTURES.filter((s) => p.structures[s] === at).map((structure) => ({ seat, color: state.setup.players[seat]!.faction.color, structure })),
  );
  const pile = state.resources[at] ?? {};
  const resources = RESOURCES.filter((r) => (pile[r] ?? 0) > 0).map((resource) => ({ resource, amount: pile[resource]! }));
  return { hex: at, terrain: hex.terrain, units, structures, resources, encounter: state.encounterTokens.includes(at) };
}
