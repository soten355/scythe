import { buildBoard, type BoardLayout } from '@scythe/engine';

// The base game map. See packages/engine/src/board.ts for the code letters:
// Fa farm, Fo forest, Mo mountain, Tu tundra, Vi village, ~~ lake,
// FF factory, -- no hex; T = tunnel, * = encounter; @id = home base spot.
// Rows with hexes run A to H (the top row has only home bases); hexes count
// from 1 in each row. The top row and B, D, F, H sit half a hex right.
//
// Entered by the owner in the map editor (editor.html in the app) from the
// physical board. To change it, edit it there and paste the export here.
export const baseBoardLayout: BoardLayout = {
  rows: [
    /*   */ '--  @nw --  --  @ne',
    /* A */ '--  Mo  Fa  Vi* Fo  Tu  Vi',
    /* B */ '~~  Tu* ~~  TuT Mo* Fa  Mo*',
    /* C */ '@w  Fo  MoT Fo  ~~  FoT Vi  @e',
    /* D */ 'Fa  Vi* ~~  FF  Mo  Tu* Fa',
    /* E */ 'Fo* Fo  FaT Tu  ~~  ViT ~~',
    /* F */ 'Mo  Vi* Vi* TuT Fo  Mo* Tu',
    /* G */ '@sw Tu  ~~  Fa  Mo* Vi  Fa  @se',
    /* H */ '--  --  @s  Vi',
  ],
  rivers: [
    'A3|A4', 'A3|B4', 'A4|B4', 'A5|A6', 'A5|B6', 'B2|C1',
    'B4|B5', 'B5|B6', 'B5|C5', 'B6|C6', 'B7|C6', 'C1|C2',
    'C2|D2', 'C5|C6', 'C5|D6', 'D1|E1', 'D1|E2', 'D2|E2',
    'D2|E3', 'D5|D6', 'D6|E6', 'E1|F1', 'E2|F1', 'E2|F2',
    'E3|F2', 'F2|F3', 'F3|G3', 'F4|G3', 'F4|G4', 'F5|G4',
    'G4|G5',
  ],
  // Neutral IDs by compass position; factions are assigned to them elsewhere.
  homeBases: {
    nw: ['A1', 'A2'],
    ne: ['A4', 'A5'],
    e: ['C6', 'D7'],
    se: ['F7', 'G6'],
    s: ['G3', 'H1'],
    sw: ['F1', 'G1'],
    w: ['C1', 'D1'],
  },
  shiftEvenRows: true,
};

export const baseBoard = buildBoard(baseBoardLayout);
