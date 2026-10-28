import { buildBoard } from '@scythe/engine';

// The base game map. See packages/engine/src/board.ts for the code letters:
// Fa farm, Fo forest, Mo mountain, Tu tundra, Vi village, ~~ lake,
// FF factory, -- no hex; T = tunnel, * = encounter.
// Rows run A (top) to H (bottom); odd rows (B, D, F, H) sit half a hex right.
//
// Draft taken from a community reading of the printed board. Not yet checked
// against the physical board; run `npm run board-preview` to compare.
export const baseBoard = buildBoard({
  rows: [
    /* A */ 'Fo  Mo  Fa  Vi* Fo  Tu  Vi',
    /* B */ '~~  Tu* ~~  TuT Mo* Fa  Mo*',
    /* C */ '--  Fo  MoT Fo  ~~  FoT Vi',
    /* D */ 'Fa  Vi* ~~  FF  Mo  Tu* Fa',
    /* E */ 'Fa* Fo  TuT Tu  ~~  ViT ~~',
    /* F */ 'Mo  Vi* Vi* FaT Fo  Mo* Tu',
    /* G */ '--  Tu  ~~  Fo  Mo* Fa  Vi',
    /* H */ '--  --  --  Vi',
  ],
  rivers: [
    'A3|A4', 'A4|A5', 'A5|A6', 'A5|B5', 'A6|A7', 'A6|B6',
    'B4|A5', 'B5|B6', 'B5|C6', 'C2|B2', 'C6|C7', 'C6|D6',
    'C7|B6', 'C7|B7', 'D1|E2', 'D5|D6', 'E1|D1', 'E1|F1',
    'E2|D2', 'E2|F2', 'E6|D6', 'F1|E2', 'F2|E3', 'F2|F3',
    'F3|G4', 'F4|G5', 'G4|F4', 'G5|F5', 'G5|G6',
  ],
  // Neutral IDs by compass position; factions are assigned to them elsewhere.
  homeBases: {
    nw: ['A2', 'A3'],
    ne: ['A5', 'A6'],
    e: ['C7', 'D7'],
    se: ['F7', 'G7'],
    s: ['G4', 'H4'],
    sw: ['F1', 'G2'],
    w: ['C2', 'D1'],
  },
});
