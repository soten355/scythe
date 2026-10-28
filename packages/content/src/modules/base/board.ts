import { buildBoard, type BoardLayout } from '@scythe/engine';

// The base game map. See packages/engine/src/board.ts for the code letters:
// Fa farm, Fo forest, Mo mountain, Tu tundra, Vi village, ~~ lake,
// FF factory, -- no hex; T = tunnel, * = encounter; @id = home base spot.
// Rows run A (top) to I (bottom); rows A, C, E, G, I sit half a hex right.
//
// Entered by the owner in the map editor (editor.html in the app) from the
// physical board. To change it, edit it there and paste the export here.
export const baseBoardLayout: BoardLayout = {
  rows: [
    /* A */ '--  @nw --  --  @ne',
    /* B */ '--  Mo  Fa  Vi* Fo  Tu  Vi',
    /* C */ '~~  Tu* ~~  TuT Mo* Fa  Mo*',
    /* D */ '@w  Fo  MoT Fo  ~~  FoT Vi  @e',
    /* E */ 'Fa  Vi* ~~  FF  Mo  Tu* Fa',
    /* F */ 'Fo* Fo  FaT Tu  ~~  ViT ~~',
    /* G */ 'Mo  Vi* Vi* TuT Fo  Mo* Tu',
    /* H */ '@sw Tu  ~~  Fa  Mo* Vi  Fa  @se',
    /* I */ '--  --  @s  Vi',
  ],
  rivers: [
    'B4|B5', 'B4|C4', 'B5|C4', 'B6|B7', 'B6|C6', 'C2|D2',
    'C4|C5', 'C5|C6', 'C5|D6', 'C6|D7', 'C7|D7', 'D2|D3',
    'D3|E2', 'D6|D7', 'D6|E6', 'E1|F1', 'E1|F2', 'E2|F2',
    'E2|F3', 'E5|E6', 'E6|F6', 'F1|G1', 'F2|G1', 'F2|G2',
    'F3|G2', 'G2|G3', 'G3|H4', 'G4|H4', 'G4|H5', 'G5|H5',
    'H5|H6',
  ],
  // Neutral IDs by compass position; factions are assigned to them elsewhere.
  homeBases: {
    nw: ['B2', 'B3'],
    ne: ['B5', 'B6'],
    e: ['D7', 'E7'],
    se: ['G7', 'H7'],
    s: ['H4', 'I4'],
    sw: ['G1', 'H2'],
    w: ['D2', 'E1'],
  },
  shiftEvenRows: true,
};

export const baseBoard = buildBoard(baseBoardLayout);
