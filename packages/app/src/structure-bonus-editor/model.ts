// Data helpers for the structure bonus tile editor.
import { validateStructureBonus, type StructureBonusTile, type StructureCount, type Terrain } from '@scythe/engine';

const TERRAINS: Terrain[] = ['farm', 'forest', 'mountain', 'tundra', 'village', 'lake', 'factory'];

/** A tile as edited: a payout's boxes may be blank (null) while it's filled in. */
export type EditedTile = Omit<StructureBonusTile, 'pays'> & { pays: { atLeast: number | null; coins: number | null }[] };

export function newTile(id: string): EditedTile {
  return { id, name: 'New tile', count: { kind: 'adjacent', feature: 'tunnel' }, pays: [{ atLeast: 1, coins: null }] };
}

/** The first "tile-N" ID no tile has yet. */
export function nextId(tiles: EditedTile[]): string {
  let n = tiles.length + 1;
  while (tiles.some((t) => t.id === `tile-${n}`)) n++;
  return `tile-${n}`;
}

/** A copy to edit, with every part the form edits present. */
export function editable(tile: StructureBonusTile | EditedTile): EditedTile {
  const copy = JSON.parse(JSON.stringify(tile)) as EditedTile;
  if (copy.count.kind === 'on') copy.count = { kind: 'on', tunnel: !!copy.count.tunnel, terrains: copy.count.terrains ?? [] };
  return copy;
}

/** Counts something else, starting afresh. */
export function setCountKind(tile: EditedTile, kind: StructureCount['kind']): EditedTile {
  const count: StructureCount = kind === 'adjacent' ? { kind, feature: 'tunnel' } : kind === 'on' ? { kind, tunnel: false, terrains: [] } : { kind };
  return { ...editable(tile), count };
}

/** Turns a terrain on or off for an "on" tile, keeping the usual order. */
export function toggleTerrain(tile: EditedTile, terrain: Terrain, on: boolean): EditedTile {
  const next = editable(tile);
  if (next.count.kind !== 'on') return next;
  const kinds = new Set(next.count.terrains);
  if (on) kinds.add(terrain);
  else kinds.delete(terrain);
  next.count.terrains = TERRAINS.filter((t) => kinds.has(t));
  return next;
}

/** One more payout step, a count above the last. */
export function addStep(tile: EditedTile): EditedTile {
  const last = tile.pays.at(-1)?.atLeast ?? 0;
  return { ...editable(tile), pays: [...tile.pays, { atLeast: (last ?? 0) + 1, coins: null }] };
}

/** Removes a payout step (but never the last one left). */
export const removeStep = (tile: EditedTile, i: number): EditedTile =>
  tile.pays.length < 2 ? tile : { ...editable(tile), pays: tile.pays.filter((_, j) => j !== i) };

/** A tile as it's stored and played: unticked parts left out, text trimmed. Blank amounts stay, for the check to point out. */
export function cleanTile(tile: EditedTile): StructureBonusTile {
  const c = tile.count;
  const count: StructureCount = c.kind === 'on' ? { kind: 'on', ...(c.tunnel && { tunnel: true }), ...(c.terrains?.length && { terrains: [...c.terrains] }) } : { ...c };
  return { id: tile.id.trim(), name: tile.name.trim(), count, pays: tile.pays.map((s) => ({ atLeast: s.atLeast, coins: s.coins })) as StructureBonusTile['pays'] };
}

/** Problems with all the tiles, each naming its tile; empty when they're ready. */
export function tileProblems(tiles: EditedTile[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const t of tiles) {
    const tile = cleanTile(t);
    const name = tile.name || tile.id || 'A tile';
    for (const p of validateStructureBonus(tile)) problems.push(`${name}: ${p}`);
    if (tile.id && seen.has(tile.id)) problems.push(`${name}: another tile has the ID ${tile.id}`);
    seen.add(tile.id);
  }
  return problems;
}

export function formatTiles(tiles: EditedTile[]): string {
  return JSON.stringify(tiles.map(cleanTile), null, 2);
}
