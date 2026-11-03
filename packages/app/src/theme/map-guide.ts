// The map guide: the map's hexes in flat terrain colours (the usual ones,
// whatever the theme), no text and no outlines, black around them, framed
// as the board draws the map picture (see map-picture.ts). Give it to
// ComfyUI (ControlNet, or as the starting picture) to paint a map picture
// that lines up with the hexes. Browser only (it draws on a canvas).
import type { Board } from '@scythe/engine';
import { center, corners, sharedEdge, SIZE } from '../play/geometry';
import { MAP_PICTURE, mapPictureFrame, toPicture } from '../play/map-picture';
import { DEFAULT_COLORS } from './theme';

/** The guide's river colour, as named in the prompt. */
export const RIVER_COLOR = '#2f6fe0';

export async function mapGuide(board: Board, rivers: boolean): Promise<Blob> {
  const { width, height } = MAP_PICTURE;
  const frame = mapPictureFrame(board);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.lineJoin = 'round';
  for (const h of Object.values(board.hexes)) {
    const pts = corners(center(h)).map((p) => toPicture(frame, p));
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    // Stroked in its own colour too, so neighbours meet with no seam.
    ctx.fillStyle = ctx.strokeStyle = DEFAULT_COLORS[h.terrain];
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
  }
  if (rivers) {
    ctx.strokeStyle = RIVER_COLOR;
    ctx.lineCap = 'round';
    ctx.lineWidth = SIZE * 0.12 * (width / frame.width);
    for (const [a, b] of board.rivers) {
      const [p, q] = sharedEdge(board, a, b).map((pt) => toPicture(frame, pt));
      ctx.beginPath();
      ctx.moveTo(p![0], p![1]);
      ctx.lineTo(q![0], q![1]);
      ctx.stroke();
    }
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The map guide couldn't be made."))), 'image/png'));
}
