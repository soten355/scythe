// Data model for the map editor. The editor works on a padded grid of slots
// ("row,col", 0-based); toLayout trims empty edges and produces the same
// BoardLayout text format the content files use.
import { hexIdGrid, type BoardLayout } from '@scythe/engine';

export type TerrainCode = 'Fa' | 'Fo' | 'Mo' | 'Tu' | 'Vi' | '~~' | 'FF';
export type SlotKey = string;

export interface Cell {
  code: TerrainCode;
  tunnel: boolean;
  encounter: boolean;
}

export interface EditorMap {
  rows: number;
  cols: number;
  /** True when rows 0, 2, 4... sit half a hex to the right. */
  shiftEven: boolean;
  cells: Record<SlotKey, Cell>;
  /** Edges as "r,c|r,c", endpoints sorted. */
  rivers: string[];
  /** Hexes each home base borders. */
  homes: Record<string, SlotKey[]>;
  /** Empty slot where each home base sits (drawn there, not a hex). */
  homeSpots: Record<string, SlotKey>;
}

export const HOME_IDS = ['nw', 'ne', 'e', 'se', 's', 'sw', 'w'];


export const key = (row: number, col: number): SlotKey => `${row},${col}`;
export const parseKey = (k: SlotKey): [number, number] => {
  const [r = 0, c = 0] = k.split(',').map(Number);
  return [r, c];
};
export const edgeKey = (a: SlotKey, b: SlotKey): string => [a, b].sort().join('|');

export function isShifted(map: EditorMap, row: number): boolean {
  return (row % 2 === 1) !== map.shiftEven;
}

/** Slot center in hex-width units (x) and row units (y). */
export function slotPosition(map: EditorMap, k: SlotKey): [number, number] {
  const [r, c] = parseKey(k);
  return [c + (isShifted(map, r) ? 0.5 : 0), r];
}

export function slotsTouch(map: EditorMap, a: SlotKey, b: SlotKey): boolean {
  const [ax, ay] = slotPosition(map, a);
  const [bx, by] = slotPosition(map, b);
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return (dy === 0 && dx === 1) || (dy === 1 && dx === 0.5);
}

export function fromLayout(layout: BoardLayout): EditorMap {
  const cells: Record<SlotKey, Cell> = {};
  const homeSpots: Record<string, SlotKey> = {};
  const byLabel: Record<string, SlotKey> = {};
  const ids = hexIdGrid(layout.rows);
  let cols = 0;
  layout.rows.forEach((row, r) => {
    const tokens = row.trim().split(/\s+/);
    cols = Math.max(cols, tokens.length);
    tokens.forEach((token, c) => {
      if (token === '--') return;
      const k = key(r, c);
      if (token.startsWith('@')) {
        homeSpots[token.slice(1)] = k;
        return;
      }
      cells[k] = {
        code: token.slice(0, 2) as TerrainCode,
        tunnel: token.slice(2).includes('T'),
        encounter: token.slice(2).includes('*'),
      };
      byLabel[ids[r]![c]!] = k;
    });
  });
  const slot = (label: string): SlotKey => {
    const k = byLabel[label];
    if (!k) throw new Error(`layout refers to missing hex ${label}`);
    return k;
  };
  const homes: Record<string, SlotKey[]> = {};
  for (const id of HOME_IDS) homes[id] = [];
  for (const [id, labels] of Object.entries(layout.homeBases)) homes[id] = labels.map(slot);
  return {
    rows: layout.rows.length,
    cols,
    shiftEven: layout.shiftEvenRows ?? false,
    cells,
    rivers: layout.rivers.map((edge) => {
      const [a = '', b = ''] = edge.split('|');
      return edgeKey(slot(a), slot(b));
    }),
    homes,
    homeSpots,
  };
}

function remap(map: EditorMap, dr: number, dc: number): EditorMap {
  const move = (k: SlotKey) => {
    const [r, c] = parseKey(k);
    return key(r + dr, c + dc);
  };
  return {
    ...map,
    cells: Object.fromEntries(Object.entries(map.cells).map(([k, cell]) => [move(k), cell])),
    rivers: map.rivers.map((e) => {
      const [a = '', b = ''] = e.split('|');
      return edgeKey(move(a), move(b));
    }),
    homes: Object.fromEntries(Object.entries(map.homes).map(([id, ks]) => [id, ks.map(move)])),
    homeSpots: Object.fromEntries(Object.entries(map.homeSpots).map(([id, k]) => [id, move(k)])),
  };
}

export function addRow(map: EditorMap, side: 'top' | 'bottom'): EditorMap {
  if (side === 'bottom') return { ...map, rows: map.rows + 1 };
  // Shifting every row down by one flips which rows are offset, so flip the
  // flag too and the picture stays the same.
  return { ...remap(map, 1, 0), rows: map.rows + 1, shiftEven: !map.shiftEven };
}

export function addCol(map: EditorMap, side: 'left' | 'right'): EditorMap {
  if (side === 'right') return { ...map, cols: map.cols + 1 };
  return { ...remap(map, 0, 1), cols: map.cols + 1 };
}

export function toggleRiver(map: EditorMap, a: SlotKey, b: SlotKey): EditorMap {
  const e = edgeKey(a, b);
  const rivers = map.rivers.includes(e) ? map.rivers.filter((x) => x !== e) : [...map.rivers, e];
  return { ...map, rivers };
}

export function toggleHome(map: EditorMap, id: string, k: SlotKey): EditorMap {
  const current = map.homes[id] ?? [];
  const next = current.includes(k) ? current.filter((x) => x !== k) : [...current, k];
  return { ...map, homes: { ...map.homes, [id]: next } };
}

/** Puts a home base on a slot, moving it if placed elsewhere; tapping its own slot removes it. */
export function placeHome(map: EditorMap, id: string, k: SlotKey): EditorMap {
  const others = Object.entries(map.homeSpots).filter(([other, spot]) => other !== id && spot !== k);
  const homeSpots = Object.fromEntries(others);
  if (map.homeSpots[id] !== k) homeSpots[id] = k;
  return { ...map, homeSpots };
}

export function homeAt(map: EditorMap, k: SlotKey): string | undefined {
  return Object.keys(map.homeSpots).find((id) => map.homeSpots[id] === k);
}

function bounds(map: EditorMap) {
  const ks = [...Object.keys(map.cells), ...Object.values(map.homeSpots)].map(parseKey);
  if (ks.length === 0) return null;
  return {
    minRow: Math.min(...ks.map(([r]) => r)),
    maxRow: Math.max(...ks.map(([r]) => r)),
    minCol: Math.min(...ks.map(([, c]) => c)),
  };
}

/** The ID a slot will have after export, e.g. "C4"; null for empty slots. Same rule as the engine. */
export function labelOf(map: EditorMap, k: SlotKey): string | null {
  const b = bounds(map);
  if (!b || !map.cells[k]) return null;
  const [r, c] = parseKey(k);
  return hexIdGrid(layoutRows(map, b))[r - b.minRow]?.[c - b.minCol] ?? null;
}

/** The exported rows of terrain codes, from the top-left of everything placed. */
function layoutRows(map: EditorMap, b: NonNullable<ReturnType<typeof bounds>>): string[] {
  const rows: string[] = [];
  for (let r = b.minRow; r <= b.maxRow; r++) {
    const tokens: string[] = [];
    for (let c = b.minCol; c < map.cols; c++) {
      const cell = map.cells[key(r, c)];
      const home = homeAt(map, key(r, c));
      if (cell) tokens.push(cell.code + (cell.tunnel ? 'T' : '') + (cell.encounter ? '*' : ''));
      else tokens.push(home ? `@${home}` : '--');
    }
    while (tokens.at(-1) === '--') tokens.pop();
    rows.push(tokens.join(' '));
  }
  return rows;
}

export function toLayout(map: EditorMap): BoardLayout {
  const b = bounds(map);
  if (!b) return { rows: [], rivers: [], homeBases: {} };
  const rows = layoutRows(map, b);
  const ids = hexIdGrid(rows);
  const label = (k: SlotKey) => {
    const [r, c] = parseKey(k);
    return map.cells[k] ? (ids[r - b.minRow]?.[c - b.minCol] ?? null) : null;
  };
  const rivers = map.rivers
    .map((e) => e.split('|').map(label))
    .filter((pair): pair is [string, string] => pair.every((l) => l !== null))
    .map(([a, b]) => `${a}|${b}`)
    .sort();
  const homeBases: Record<string, string[]> = {};
  for (const [id, ks] of Object.entries(map.homes)) {
    const labels = ks.map(label).filter((l): l is string => l !== null);
    if (labels.length) homeBases[id] = labels;
  }
  const layout: BoardLayout = { rows, rivers, homeBases };
  if (isShifted(map, b.minRow)) layout.shiftEvenRows = true;
  return layout;
}

/** Text in the same shape as the layout object in the content files. */
export function formatLayout(layout: BoardLayout): string {
  const q = (s: string) => `'${s}'`;
  const ids = hexIdGrid(layout.rows);
  const rows = layout.rows.map((row, i) => {
    const padded = row.split(' ').map((t) => t.padEnd(3)).join(' ').trimEnd();
    // The row's letter, as in its hex IDs; blank for a row with only home bases.
    const letter = ids[i]!.find((id) => id)?.[0] ?? ' ';
    return `    /* ${letter} */ ${q(padded)},`;
  });
  const rivers: string[] = [];
  for (let i = 0; i < layout.rivers.length; i += 6) {
    rivers.push(`    ${layout.rivers.slice(i, i + 6).map(q).join(', ')},`);
  }
  const homes = Object.entries(layout.homeBases).map(
    ([id, labels]) => `    ${id}: [${labels.map(q).join(', ')}],`,
  );
  return [
    '{',
    '  rows: [',
    ...rows,
    '  ],',
    '  rivers: [',
    ...rivers,
    '  ],',
    '  homeBases: {',
    ...homes,
    '  },',
    ...(layout.shiftEvenRows ? ['  shiftEvenRows: true,'] : []),
    '}',
  ].join('\n');
}
