// Board geometry: hexes, terrain, rivers, tunnels and home bases.
//
// A map is written as a BoardLayout: one string per row, top to bottom, with
// a two-letter terrain code per hex. Rows are lettered A, B, C... and hexes
// are numbered from 1 left to right, so hex IDs read like "C4". Odd rows
// (B, D, F...) sit half a hex to the right of the row above, unless
// shiftEvenRows is set, in which case rows A, C, E... do.
//
// Codes: Fa farm, Fo forest, Mo mountain, Tu tundra, Vi village, ~~ lake,
// FF factory, -- no hex. Suffix T marks a tunnel, * an encounter token.

export type Terrain = 'farm' | 'forest' | 'mountain' | 'tundra' | 'village' | 'lake' | 'factory';
export type HexId = string;
export type HomeBaseId = string;

export interface Hex {
  id: HexId;
  /** Axial coordinates, used for adjacency. */
  q: number;
  r: number;
  terrain: Terrain;
  tunnel: boolean;
  encounter: boolean;
}

export interface Board {
  hexes: Record<HexId, Hex>;
  /** Hexes sharing an edge with each hex (including lakes; ignores rivers). */
  adjacent: Record<HexId, HexId[]>;
  /** Each river runs along the edge between two touching hexes. */
  rivers: [HexId, HexId][];
  /** Home bases sit off the grid; each lists the hexes it borders. */
  homeBases: Record<HomeBaseId, HexId[]>;
}

export interface BoardLayout {
  rows: string[];
  /** Edges written as "A3|A4". */
  rivers: string[];
  homeBases: Record<HomeBaseId, HexId[]>;
  /** Shift rows A, C, E... right instead of B, D, F... */
  shiftEvenRows?: boolean;
}

const TERRAIN_CODES: Record<string, Terrain> = {
  Fa: 'farm',
  Fo: 'forest',
  Mo: 'mountain',
  Tu: 'tundra',
  Vi: 'village',
  '~~': 'lake',
  FF: 'factory',
};

const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const AXIAL_DIRECTIONS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
];

export function buildBoard(layout: BoardLayout): Board {
  const hexes: Record<HexId, Hex> = {};

  layout.rows.forEach((row, r) => {
    row.trim().split(/\s+/).forEach((token, i) => {
      if (token === '--') return;
      const id = `${ROW_LETTERS[r]}${i + 1}`;
      const terrain = TERRAIN_CODES[token.slice(0, 2)];
      if (!terrain) throw new Error(`unknown terrain code "${token.slice(0, 2)}" at ${id}`);
      const flags = token.slice(2);
      if (/[^T*]/.test(flags)) throw new Error(`unknown marker "${flags}" at ${id}`);
      // Offset to axial conversion ("odd-r" or "even-r" layout).
      const q = i + 1 - (layout.shiftEvenRows ? (r + (r & 1)) / 2 : (r - (r & 1)) / 2);
      hexes[id] = { id, q, r, terrain, tunnel: flags.includes('T'), encounter: flags.includes('*') };
    });
  });

  const byCoord = new Map(Object.values(hexes).map((h) => [`${h.q},${h.r}`, h.id]));
  const adjacent: Record<HexId, HexId[]> = {};
  for (const { id, q, r } of Object.values(hexes)) {
    adjacent[id] = AXIAL_DIRECTIONS.flatMap(([dq, dr]) => byCoord.get(`${q + dq},${r + dr}`) ?? []);
  }

  const board: Board = { hexes, adjacent, rivers: [], homeBases: {} };

  for (const edge of layout.rivers) {
    const [a = '', b = ''] = edge.split('|');
    if (!hexes[a] || !hexes[b] || !neighbors(board, a).includes(b)) {
      throw new Error(`river ${edge} must join two touching hexes`);
    }
    board.rivers.push([a, b]);
  }

  for (const [id, borders] of Object.entries(layout.homeBases)) {
    for (const hexId of borders) {
      if (!hexes[hexId] || hexes[hexId].terrain === 'lake') {
        throw new Error(`home base ${id} borders ${hexId}, which is not a land hex`);
      }
    }
    board.homeBases[id] = [...borders];
  }

  return board;
}

/** Hexes that share an edge with this one (including lakes; ignores rivers). */
export function neighbors(board: Board, id: HexId): readonly HexId[] {
  return board.adjacent[id] ?? [];
}

export function hasRiver(board: Board, a: HexId, b: HexId): boolean {
  return board.rivers.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export function homeBaseNeighbors(board: Board, id: HomeBaseId): readonly HexId[] {
  return board.homeBases[id] ?? [];
}
