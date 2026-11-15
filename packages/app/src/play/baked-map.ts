// The hex art, painted once into one picture. Drawn as an SVG pattern, every
// hex's picture is worked out again each time the map moves, which on a phone
// makes dragging crawl. One finished picture is far quicker to move. It's only
// how the art is drawn: the hexes stay on the board to be tapped. A skin's
// road, river and shore (see borders.ts) are painted into it too.
import type { BorderWidths } from '../theme/theme';
import type { BorderEdge } from './borders';
import { HEX_WIDTH, type Point } from './geometry';
import { paintBorders } from './paint-borders';

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
/** The borders to paint over the hexes, and the skin's pictures for them. */
export interface BakeBorders {
  edges: BorderEdge[];
  road?: string;
  river?: string;
  widths: BorderWidths;
}

export async function bakeMap(hexes: BakeHex[], { maxSide = BAKE_MAX_SIDE, borders }: { maxSide?: number; borders?: BakeBorders } = {}): Promise<BakedMap> {
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

  if (borders && (borders.road || borders.river)) {
    const [road, river] = await Promise.all([borders.road, borders.river].map((url) => (url ? loadImage(url) : Promise.resolve(undefined))));
    paint.setTransform(1, 0, 0, 1, 0, 0);
    paintBorders(paint, { edges: borders.edges, road, river, widths: borders.widths }, ([x, y]) => [(x - area.x) * scale, (y - area.y) * scale], scale);
  }

  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
  if (!blob) throw new Error('The picture could not be made');
  return { ...area, url: URL.createObjectURL(blob) };
}

/**
 * Painted maps, kept so each is painted only once: the game rebuilds its
 * state after every action, and the board comes and goes (the map screen,
 * fights), but the picture only changes with the look or the map. Kept per
 * look (by the object itself) and map (by `key`); the oldest are let go.
 */
export function bakedStore(max = 4, release: (url: string) => void = (url) => URL.revokeObjectURL(url)) {
  const looks = new WeakMap<object, Map<string, Promise<BakedMap>>>();
  let order: { look: object; key: string; picture: Promise<BakedMap> }[] = [];
  return {
    get(look: object, key: string, paint: () => Promise<BakedMap>): Promise<BakedMap> {
      let kept = looks.get(look);
      if (!kept) looks.set(look, (kept = new Map()));
      const had = kept.get(key);
      if (had) return had;
      const picture = paint();
      kept.set(key, picture);
      order.push({ look, key, picture });
      picture.catch(() => {
        if (kept.get(key) === picture) kept.delete(key);
        order = order.filter((o) => o.picture !== picture);
      });
      while (order.length > max) {
        const old = order.shift()!;
        if (looks.get(old.look)?.get(old.key) === old.picture) looks.get(old.look)!.delete(old.key);
        old.picture.then((p) => release(p.url), () => {});
      }
      return picture;
    },
  };
}

/** The app's one store of painted maps. */
export const bakedMaps = bakedStore();
