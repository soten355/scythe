// Paints the map's borders (see borders.ts) into the baked map picture, over
// the hex art: roads, then lake shores, then the rivers (their banks, then
// their water, so the water runs on unbroken where edges meet), each a strip
// of the skin's picture turned to run along its edge. The road picture is the
// road; the river picture gives the water (its middle), the banks (its top
// strip, mirrored to make both sides) and the shore (its top half: bank,
// then water). Edges are softened by drawing each band a few times, a little
// narrower each time; rounded ends make the bends and the pool where a river
// stops.
import type { BorderWidths } from '../theme/theme';
import { riverSpan, type BorderEdge } from './borders';
import { SIZE, type Point } from './geometry';

export interface BorderPictures {
  edges: BorderEdge[];
  road?: HTMLImageElement;
  river?: HTMLImageElement;
  widths: BorderWidths;
}

/** Part of a strip picture (rows `from` to `to`, as shares of its height), `height` pixels tall, with a mirrored copy after it so it repeats without a seam. With `mirrorBelow`, the part fills the top half and its upside-down copy the bottom (a bank on both sides). */
function strip(img: HTMLImageElement, from: number, to: number, height: number, mirrorBelow = false): HTMLCanvasElement {
  const sy = img.naturalHeight * from;
  const sh = img.naturalHeight * (to - from);
  const part = mirrorBelow ? height / 2 : height;
  const w = Math.max(1, Math.round((img.naturalWidth * part) / sh));
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = Math.max(1, Math.round(height));
  const g = c.getContext('2d')!;
  // One copy of the part at (x, y), flipped left-to-right and/or upside down.
  const put = (x: number, y: number, flipX: boolean, flipY: boolean) => {
    g.save();
    g.translate(x + (flipX ? w : 0), y + (flipY ? part : 0));
    g.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    g.drawImage(img, 0, sy, img.naturalWidth, sh, 0, 0, w, part);
    g.restore();
  };
  put(0, 0, false, false);
  put(w, 0, true, false);
  if (mirrorBelow) {
    put(0, part, false, true);
    put(w, part, true, true);
  }
  return c;
}

/** Turns a's → b's direction so that `side` (if given) is on the strip's top. */
function facing(a: Point, b: Point, side?: Point): [Point, Point] {
  if (!side) return [a, b];
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // The strip's top lies along (dy, -dx) once it's turned to run from a to b.
  return (side[0] - mid[0]) * dy + (side[1] - mid[1]) * -dx > 0 ? [a, b] : [b, a];
}

/**
 * One band of texture from a to b, `width` pixels wide, centred on the line
 * (or, with `half`, only its top half), with soft sides and round ends.
 */
function band(g: CanvasRenderingContext2D, tex: HTMLCanvasElement, a: Point, b: Point, width: number, half = false) {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const pattern = g.createPattern(tex, 'repeat');
  if (!pattern) return;
  pattern.setTransform(new DOMMatrix().translateSelf(a[0], a[1]).rotateSelf((angle * 180) / Math.PI).translateSelf(0, -tex.height / 2));
  // The top half only: a narrower band moved toward the top (along (dy, -dx)).
  const shift = half ? width / 4 : 0;
  const [nx, ny] = [Math.sin(angle) * shift, -Math.cos(angle) * shift];
  const w = half ? width / 2 : width;
  g.save();
  g.strokeStyle = pattern;
  g.lineCap = 'round';
  for (const [k, alpha] of [[1, 0.35], [0.9, 0.55], [0.8, 1]] as const) {
    g.globalAlpha = alpha;
    g.lineWidth = w * k;
    g.beginPath();
    g.moveTo(a[0] + nx, a[1] + ny);
    g.lineTo(b[0] + nx, b[1] + ny);
    g.stroke();
  }
  g.restore();
}

/** A round patch of texture (a river's end pool), soft at its rim. */
function pool(g: CanvasRenderingContext2D, tex: HTMLCanvasElement, at: Point, radius: number) {
  const pattern = g.createPattern(tex, 'repeat');
  if (!pattern) return;
  pattern.setTransform(new DOMMatrix().translateSelf(at[0], at[1] - tex.height / 2));
  g.save();
  g.fillStyle = pattern;
  for (const [k, alpha] of [[1, 0.35], [0.9, 0.55], [0.8, 1]] as const) {
    g.globalAlpha = alpha;
    g.beginPath();
    g.arc(at[0], at[1], radius * k, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Paints the borders. `toPixel` turns a board point into the picture's pixels; `scale` is pixels per board unit. */
export function paintBorders(g: CanvasRenderingContext2D, borders: BorderPictures, toPixel: (p: Point) => Point, scale: number) {
  const px = (share: number) => share * SIZE * scale;
  const road = px(borders.widths.road);
  const water = px(borders.widths.river);
  const bank = px(borders.widths.bank);
  const of = (kind: BorderEdge['kind']) => borders.edges.filter((e) => e.kind === kind);

  if (borders.road) {
    const tex = strip(borders.road, 0, 1, road);
    for (const e of of('road')) band(g, tex, toPixel(e.a), toPixel(e.b), road);
  }
  if (!borders.river) return;
  const img = borders.river;
  // The shore: the river picture's top half (bank, then water), the bank on the land side.
  const shoreTex = strip(img, 0, 0.55, road);
  for (const e of of('shore')) band(g, shoreTex, ...facing(toPixel(e.a), toPixel(e.b), toPixel(e.land!)), road);

  const rivers = of('river');
  const bankTex = strip(img, 0, 0.22, bank, true);
  const waterTex = strip(img, 0.3, 0.7, water);
  const spans = rivers.map((e) => riverSpan(e).map(toPixel) as [Point, Point]);
  // Banks: both sides, or only the land side where a lake is alongside (the water opens into the lake).
  rivers.forEach((e, i) => {
    const [a, b] = spans[i]!;
    if (e.land) band(g, bankTex, ...facing(a, b, toPixel(e.land)), bank, true);
    else band(g, bankTex, a, b, bank);
  });
  // Where a river stops among land, a round pool ringed by bank.
  const ends = rivers.flatMap((e, i) => [...(e.endA ? [spans[i]![0]] : []), ...(e.endB ? [spans[i]![1]] : [])]);
  for (const at of ends) pool(g, bankTex, at, (bank * 1.35) / 2);
  for (const [a, b] of spans) band(g, waterTex, a, b, water);
  for (const at of ends) pool(g, waterTex, at, (water * 1.45) / 2);
}
