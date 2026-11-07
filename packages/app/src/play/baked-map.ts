// The hex art, painted once into one picture. Drawn as an SVG pattern, every
// hex's picture is worked out again each time the map moves, which on a phone
// makes dragging crawl. One finished picture is far quicker to move. It's only
// how the art is drawn: the hexes stay on the board to be tapped.
import { HEX_WIDTH, type Point } from './geometry';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BakeHex {
  /** The hex's corners, in board coordinates. */
  corners: Point[];
  /** Its picture. */
  url: string;
  /** A colour behind the picture's see-through parts (none: they stay see-through). */
  fill?: string;
}

export interface BakedMap extends Box {
  /** The finished picture; release it with URL.revokeObjectURL. */
  url: string;
}

/** The longest side of the finished picture, in pixels. */
export const BAKE_MAX_SIDE = 4096;

/** Where a picture goes to cover `box` without stretching, cropped evenly on the long side. */
export function coverRect(box: Box, imageWidth: number, imageHeight: number): Box {
  const scale = Math.max(box.width / imageWidth, box.height / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

const boxOf = (pts: Point[]): Box => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

/** The part of the board that holds these hexes. */
export const bakeArea = (hexes: Point[][]): Box => boxOf(hexes.flat());

/** Pixels per board unit: a hex keeps its art's pixels, as long as the whole picture stays within `maxSide`. */
export const bakeScale = (area: Box, artWidth: number, maxSide: number): number =>
  Math.min(artWidth / HEX_WIDTH, maxSide / Math.max(area.width, area.height));

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

/** Paints the hexes into one picture. Rejects if it can't, and the board then keeps drawing them itself. */
export async function bakeMap(hexes: BakeHex[], maxSide = BAKE_MAX_SIDE): Promise<BakedMap> {
  const urls = [...new Set(hexes.map((h) => h.url))];
  const images = new Map(await Promise.all(urls.map(async (url) => [url, await loadImage(url)] as const)));
  const area = bakeArea(hexes.map((h) => h.corners));
  const scale = bakeScale(area, Math.max(...[...images.values()].map((i) => i.naturalWidth)), maxSide);

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(area.width * scale);
  canvas.height = Math.ceil(area.height * scale);
  const paint = canvas.getContext('2d');
  if (!paint) throw new Error('No canvas to paint on');
  paint.imageSmoothingQuality = 'high';
  paint.setTransform(scale, 0, 0, scale, -area.x * scale, -area.y * scale);

  for (const hex of hexes) {
    const image = images.get(hex.url)!;
    paint.save();
    paint.beginPath();
    hex.corners.forEach(([x, y], i) => (i ? paint.lineTo(x, y) : paint.moveTo(x, y)));
    paint.closePath();
    paint.clip();
    const box = boxOf(hex.corners);
    if (hex.fill) {
      paint.fillStyle = hex.fill;
      paint.fillRect(box.x, box.y, box.width, box.height);
    }
    const to = coverRect(box, image.naturalWidth, image.naturalHeight);
    paint.drawImage(image, to.x, to.y, to.width, to.height);
    paint.restore();
  }

  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
  if (!blob) throw new Error('The picture could not be made');
  return { ...area, url: URL.createObjectURL(blob) };
}
