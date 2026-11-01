// The new game screen's choices: the map, how many players, and each seat's
// faction and mat. Picking a faction or mat another seat has swaps the two.
import type { Board, EncounterCard, Faction, GameSetup, PlayerMat } from '@scythe/engine';

/** A map to play on. The standard one comes first and is picked by default; more can be added later. */
export interface MapOption {
  id: string;
  name: string;
  board: Board;
}

/** Everything there is to choose from. */
export interface Catalog {
  maps: MapOption[];
  factions: Faction[];
  mats: PlayerMat[];
  /** The encounter deck every new game uses (none: no encounters). */
  encounters?: EncounterCard[];
}

export interface SetupChoice {
  map: string;
  /** In seating order (clockwise). */
  players: { faction: string; mat: string }[];
}

/** Solo games need the Automa, which comes later. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 7;

export const maxPlayers = (catalog: Catalog) => Math.min(MAX_PLAYERS, catalog.factions.length, catalog.mats.length);

export function defaultChoice(catalog: Catalog): SetupChoice {
  return setPlayerCount({ map: catalog.maps[0]!.id, players: [] }, MIN_PLAYERS, catalog);
}

/** Adds seats with the first unused faction and mat each, or drops seats from the end. */
export function setPlayerCount(choice: SetupChoice, count: number, catalog: Catalog): SetupChoice {
  const n = Math.max(0, Math.min(count, maxPlayers(catalog)));
  const players = choice.players.slice(0, n);
  while (players.length < n) {
    const faction = catalog.factions.find((f) => !players.some((p) => p.faction === f.id))!;
    const mat = catalog.mats.find((m) => !players.some((p) => p.mat === m.id))!;
    players.push({ faction: faction.id, mat: mat.id });
  }
  return { ...choice, players };
}

/** The same choice, with any map, faction or mat no longer offered swapped for the first unused one (unchanged if all are still there). */
export function fitChoice(choice: SetupChoice, catalog: Catalog): SetupChoice {
  const has = <T extends { id: string }>(items: T[], id: string) => items.some((x) => x.id === id);
  const map = has(catalog.maps, choice.map) ? choice.map : catalog.maps[0]!.id;
  let changed = map !== choice.map;
  const players = choice.players.map((p) => ({ ...p }));
  for (const p of players) {
    if (!has(catalog.factions, p.faction)) {
      p.faction = catalog.factions.find((f) => !players.some((q) => q.faction === f.id))?.id ?? p.faction;
      changed = true;
    }
    if (!has(catalog.mats, p.mat)) {
      p.mat = catalog.mats.find((m) => !players.some((q) => q.mat === m.id))?.id ?? p.mat;
      changed = true;
    }
  }
  if (players.length > maxPlayers(catalog)) return setPlayerCount({ map, players }, maxPlayers(catalog), catalog);
  return changed ? { map, players } : choice;
}

function pick(choice: SetupChoice, seat: number, field: 'faction' | 'mat', id: string): SetupChoice {
  const players = choice.players.map((p) => ({ ...p }));
  const other = players.findIndex((p, i) => i !== seat && p[field] === id);
  if (other >= 0) players[other]![field] = players[seat]![field];
  players[seat]![field] = id;
  return { ...choice, players };
}

export const setFaction = (choice: SetupChoice, seat: number, id: string) => pick(choice, seat, 'faction', id);
export const setMat = (choice: SetupChoice, seat: number, id: string) => pick(choice, seat, 'mat', id);

/** Deals out factions and mats at random. `random` gives numbers in [0, 1), like Math.random. */
export function shuffleSeats(choice: SetupChoice, catalog: Catalog, random: () => number): SetupChoice {
  const shuffled = <T>(items: T[]) => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
  const factions = shuffled(catalog.factions);
  const mats = shuffled(catalog.mats);
  return { ...choice, players: choice.players.map((_, i) => ({ faction: factions[i]!.id, mat: mats[i]!.id })) };
}

/** What stops the game from starting, in plain words; empty when it's ready. */
export function problems(choice: SetupChoice, catalog: Catalog): string[] {
  const out: string[] = [];
  const map = catalog.maps.find((m) => m.id === choice.map);
  if (!map) out.push('Choose a map.');
  if (choice.players.length < MIN_PLAYERS) out.push(`Choose at least ${MIN_PLAYERS} players.`);
  const factions = choice.players.map((p) => catalog.factions.find((f) => f.id === p.faction));
  const mats = choice.players.map((p) => catalog.mats.find((m) => m.id === p.mat));
  if (factions.some((f) => !f)) out.push('Choose a faction for every seat.');
  if (mats.some((m) => !m)) out.push('Choose a mat for every seat.');
  const twice = <T extends { id: string }>(items: (T | undefined)[]) => items.filter((x, i) => x && items.findIndex((y) => y?.id === x.id) !== i) as T[];
  for (const f of twice(factions)) out.push(`Two seats have ${f.name}.`);
  for (const m of twice(mats)) out.push(`Two seats have the ${m.name} mat.`);
  const seen = new Map<string, Faction>();
  for (const f of factions) {
    if (!f) continue;
    const first = seen.get(f.homeBase);
    if (first && first.id !== f.id) out.push(`${first.name} and ${f.name} start from the same home base.`);
    else seen.set(f.homeBase, f);
    if (map && !map.board.homeBases[f.homeBase]) out.push(`${f.name}'s home base isn't on ${map.name}.`);
  }
  return out;
}

/** The engine's setup for these choices (check `problems` first). */
export function toSetup(choice: SetupChoice, catalog: Catalog, seed: number): GameSetup {
  return {
    seed,
    board: catalog.maps.find((m) => m.id === choice.map)!.board,
    players: choice.players.map((p) => ({
      faction: catalog.factions.find((f) => f.id === p.faction)!,
      mat: catalog.mats.find((m) => m.id === p.mat)!,
    })),
    ...(catalog.encounters?.length && { encounters: catalog.encounters }),
  };
}
