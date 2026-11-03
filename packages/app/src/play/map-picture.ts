// The map picture: one painting of the whole map, made (e.g. in ComfyUI)
// from the map guide, a 1600 x 896 picture of the hexes in flat terrain
// colours. Both are framed the same way: the hexes centred, with a 40-pixel
// margin on the tighter side. So the board draws the picture in this frame
// and it sits exactly under its hexes, zooming and panning with them.
import type { Board } from '@scythe/engine';
import { center, corners, type Point } from './geometry';

export const MAP_PICTURE = { width: 1600, height: 896, margin: 40 } as const;

/** Where the picture goes, in board coordinates (the hexes' own). */
export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function mapPictureFrame(board: Board): Frame {
  const pts = Object.values(board.hexes).flatMap((h) => corners(center(h)));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const { width: W, height: H, margin } = MAP_PICTURE;
  // Picture pixels per board unit.
  const scale = Math.min((W - 2 * margin) / (maxX - minX), (H - 2 * margin) / (maxY - minY));
  const width = W / scale;
  const height = H / scale;
  return { x: (minX + maxX) / 2 - width / 2, y: (minY + maxY) / 2 - height / 2, width, height };
}

/** A board point, in the picture's pixels. */
export const toPicture = (frame: Frame, [x, y]: Point): Point => [
  ((x - frame.x) / frame.width) * MAP_PICTURE.width,
  ((y - frame.y) / frame.height) * MAP_PICTURE.height,
];
