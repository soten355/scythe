// Paints the map's borders (see borders.ts) into the baked map picture, over
// the hex art: roads, then lake shores, then the rivers (their banks, then
// their water, so the water runs on unbroken where edges meet), each a strip
// of the skin's picture turned to run along its edge. The road picture is the
// road; the river picture gives the water (its middle), the banks (its top
// strip, mirrored to make both sides) and the shore (that bank, on the land
// side only). Edges are softened by drawing each band a few times, a little
// narrower each time; rounded ends make the bends and the pool where a river
// stops. Roads are drawn a little see-through with wide soft edges, so the
// tile shows through at their verges; river water (and lake hexes, in
// baked-map.ts) gets a wash of the skin's lake colour, so it reads as water.
import type { BorderWidths } from '../theme/theme';
import { riverSpan, type BorderEdge } from './borders';
import { SIZE, type Point } from './geometry';

export interface BorderPictures {
  edges: BorderEdge[];
  road?: HTMLImageElement;
  river?: HTMLImageElement;
  widths: BorderWidths;
  /** The skin's water colour: a wash of it makes river water bluer. */
  water?: string;
  /** The lakes, as outlines in the picture's pixels: roads never cross them, and rivers open into them at their corners. */
  keepClear?: Point[][];
}

/** How a band's edge fades: [share of its width, opacity] from the faint outside in. Banks and shores melt into the tiles; water fades into its banks. */
type Feather = readonly (readonly [number, number])[];
const MELT: Feather = [[1, 0.1], [0.92, 0.2], [0.84, 0.34], [0.76, 0.55], [0.68, 1]];
const WATER: Feather = [[1, 0.3], [0.9, 0.55], [0.8, 1]];
/** The rows of the river picture a shore shows (from its top, the grass), where in them its bank meets the water, and where across the shore band the hex edge falls (shares of its height, from the land side). */
const SHORE_ROWS = 0.32;
const SHORE_EDGE = 0.2;
const SHORE_LINE = 0.22;
/** The shore's width, as a share of a bank's. */
const SHORE_WIDTH = 0.8;
/** The shore's strength across it, from the land side (0) to the lake side (1); the hex edge is at SHORE_LINE, so most of it lies on the lake (owner's play-test: it spread too far onto the land and its roads). */
const SHORE_FADE: [number, number][] = [[0, 0], [0.16, 0.85], [0.3, 1], [0.62, 1], [0.84, 0.35], [1, 0]];
/** How far the shallows reach into a lake, as a share of a bank's width. */
const SHALLOWS_DEPTH = 0.6;

/** The average colour of some rows of a picture (shares of its height), washed with a water colour if given. */
function averageColor(img: HTMLImageElement, from: number, to: number, wash?: string): string {
  const c = document.createElement('canvas');
  c.width = c.height = 4;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, img.naturalHeight * from, img.naturalWidth, img.naturalHeight * (to - from), 0, 0, 4, 4);
  if (wash) washWater(g, wash, 0, 0, 4, 4);
  const d = g.getImageData(0, 0, 4, 4).data;
  const sum = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k]! += d[i + k]!;
  return sum.map((v) => Math.round(v / 16)).join(' ');
}

/**
 * Shallows along a shore, inside the lake: a smooth fade from the bank's mud
 * into shallow water and then the lake's own, over the strip of the lake
 * along that edge (cut square to the lake's middle, so neighbouring edges
 * meet without overlapping).
 */
function shallowsAlong(g: CanvasRenderingContext2D, a: Point, b: Point, lake: Point, depth: number, mud: string, water: string) {
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // From the edge to the lake's middle is the hex's apothem; the inner edge is the hex shrunk by `depth`.
  const t = Math.min(0.9, depth / Math.hypot(lake[0] - mid[0], lake[1] - mid[1]));
  const toward = (p: Point): Point => [p[0] + (lake[0] - p[0]) * t, p[1] + (lake[1] - p[1]) * t];
  const inner = toward(mid);
  const fade = g.createLinearGradient(mid[0], mid[1], inner[0], inner[1]);
  // Murky at the very edge (a touch of the mud, never a stripe of it: that read as the hex's outline), then shallow water, then the lake's own.
  fade.addColorStop(0, `rgb(${mud} / 0.3)`);
  fade.addColorStop(0.15, `rgb(${water} / 0.55)`);
  fade.addColorStop(1, `rgb(${water} / 0)`);
  g.save();
  g.fillStyle = fade;
  g.beginPath();
  for (const [i, p] of [a, b, toward(b), toward(a)].entries()) (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
  g.closePath();
  g.fill();
  g.restore();
}
/** Roads: a thin core with a wide, faint, dusty verge fading into the ground (wider than the road itself), and never quite solid, so the tile shows through. */
const ROAD: Feather = [[1.7, 0.1], [1.4, 0.18], [1.15, 0.32], [0.95, 0.55], [0.8, 1]];
const ROAD_ALPHA = 0.85;

/** How strongly water is washed with the water colour: its hue (`color`), then a touch deeper (`multiply`). */
export const WATER_WASH = { color: 0.5, deepen: 0.2 } as const;

/** Washes a picture (or a part of one, already clipped) with the water colour, keeping its light and shade. */
export function washWater(g: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  g.save();
  g.fillStyle = color;
  g.globalCompositeOperation = 'color';
  g.globalAlpha = WATER_WASH.color;
  g.fillRect(x, y, w, h);
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = WATER_WASH.deepen;
  g.fillRect(x, y, w, h);
  g.restore();
}

/** A copy of a strip washed with the water colour (its see-through parts kept). */
function washed(tex: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = tex.width;
  c.height = tex.height;
  const g = c.getContext('2d')!;
  g.drawImage(tex, 0, 0);
  washWater(g, color, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(tex, 0, 0);
  return c;
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
function band(
  g: CanvasRenderingContext2D,
  tex: HTMLCanvasElement,
  a: Point,
  b: Point,
  width: number,
  { half = false, feather = MELT, alpha = 1, offset = 0, cap = 'round' }: { half?: boolean; feather?: Feather; alpha?: number; /** Moves the band toward its top by this many pixels (toward its bottom if negative). */ offset?: number; cap?: CanvasLineCap } = {},
) {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const pattern = g.createPattern(tex, 'repeat');
  if (!pattern) return;
  // The picture runs along the line, centred on it (moved with the band by `offset`; a half band shows its top half).
  pattern.setTransform(new DOMMatrix().translateSelf(a[0], a[1]).rotateSelf((angle * 180) / Math.PI).translateSelf(0, -tex.height / 2 - offset));
  // The top half only: a narrower band moved toward the top (along (dy, -dx)).
  const shift = (half ? width / 4 : 0) + offset;
  const [nx, ny] = [Math.sin(angle) * shift, -Math.cos(angle) * shift];
  const w = half ? width / 2 : width;
  g.save();
  g.strokeStyle = pattern;
  g.lineCap = cap;
  for (const [k, opacity] of feather) {
    g.globalAlpha = opacity * alpha;
    g.lineWidth = w * k;
    g.beginPath();
    g.moveTo(a[0] + nx, a[1] + ny);
    g.lineTo(b[0] + nx, b[1] + ny);
    g.stroke();
  }
  g.restore();
}

/** A round patch of texture (a river's end pool), soft at its rim. */
function pool(g: CanvasRenderingContext2D, tex: HTMLCanvasElement, at: Point, radius: number, feather: Feather = MELT, alpha = 1) {
  const pattern = g.createPattern(tex, 'repeat');
  if (!pattern) return;
  pattern.setTransform(new DOMMatrix().translateSelf(at[0], at[1] - tex.height / 2));
  g.save();
  g.fillStyle = pattern;
  for (const [k, opacity] of feather) {
    g.globalAlpha = opacity * alpha;
    g.beginPath();
    g.arc(at[0], at[1], radius * k, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/**
 * A band of texture from a to b whose strength changes across it (not
 * evenly at both sides): `fade` gives [place across the band from its top
 * (0) to its bottom (1), strength] stops. Painted on a small canvas of its
 * own, then faded with a gradient, so one side can stay solid while the
 * other melts away.
 */
function fadedBand(
  g: CanvasRenderingContext2D,
  tex: HTMLCanvasElement,
  a: Point,
  b: Point,
  width: number,
  offset: number,
  fade: [number, number][],
  /** Fade out over this many pixels toward a and/or b (where it meets a river), rather than ending square. */
  ends: { a?: number; b?: number } = {},
) {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  // Toward the band's top.
  const n: Point = [Math.sin(angle), -Math.cos(angle)];
  const pad = width + Math.abs(offset);
  const [x0, y0] = [Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad];
  const c = document.createElement('canvas');
  c.width = Math.ceil(Math.abs(a[0] - b[0]) + pad * 2);
  c.height = Math.ceil(Math.abs(a[1] - b[1]) + pad * 2);
  const o = c.getContext('2d')!;
  o.translate(-x0, -y0);
  // Square ends: a round one would spill past the corner (onto a road there).
  band(o, tex, a, b, width, { feather: [[1, 1]], offset, cap: 'butt' });
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalCompositeOperation = 'destination-in';
  const mid: Point = [(a[0] + b[0]) / 2 - x0, (a[1] + b[1]) / 2 - y0];
  const top: Point = [mid[0] + n[0] * (width / 2 + offset), mid[1] + n[1] * (width / 2 + offset)];
  const bottom: Point = [mid[0] - n[0] * (width / 2 - offset), mid[1] - n[1] * (width / 2 - offset)];
  const gradient = o.createLinearGradient(top[0], top[1], bottom[0], bottom[1]);
  for (const [at, strength] of fade) gradient.addColorStop(at, `rgb(0 0 0 / ${strength})`);
  o.fillStyle = gradient;
  o.fillRect(0, 0, c.width, c.height);
  if (ends.a || ends.b) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const along = o.createLinearGradient(a[0] - x0, a[1] - y0, b[0] - x0, b[1] - y0);
    along.addColorStop(0, `rgb(0 0 0 / ${ends.a ? 0 : 1})`);
    if (ends.a) along.addColorStop(Math.min(0.45, ends.a / len), 'rgb(0 0 0 / 1)');
    if (ends.b) along.addColorStop(Math.max(0.55, 1 - ends.b / len), 'rgb(0 0 0 / 1)');
    along.addColorStop(1, `rgb(0 0 0 / ${ends.b ? 0 : 1})`);
    o.fillStyle = along;
    o.fillRect(0, 0, c.width, c.height);
  }
  g.drawImage(c, x0, y0);
}

/**
 * A river's water running on past `at` (its mouth) into a lake, a little
 * wider than the river and fading smoothly to nothing over `reach`: painted
 * on a small canvas of its own, then faded along its length with a gradient,
 * so it has neither steps nor a hard end.
 */
function riverIntoLake(g: CanvasRenderingContext2D, tex: HTMLCanvasElement, from: Point, at: Point, water: number, reach: number) {
  const len = Math.hypot(at[0] - from[0], at[1] - from[1]) || 1;
  const dir: Point = [(at[0] - from[0]) / len, (at[1] - from[1]) / len];
  const start: Point = [at[0] - dir[0] * water * 0.5, at[1] - dir[1] * water * 0.5];
  const tip: Point = [at[0] + dir[0] * reach, at[1] + dir[1] * reach];
  const size = Math.ceil(reach * 2 + water * 3);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const o = c.getContext('2d')!;
  // Board pixels, moved so the mouth is in the middle of the small canvas.
  const [ox, oy] = [at[0] - size / 2, at[1] - size / 2];
  o.translate(-ox, -oy);
  band(o, tex, start, tip, water * 1.3, { feather: MELT });
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalCompositeOperation = 'destination-in';
  const fade = o.createLinearGradient(start[0] - ox, start[1] - oy, tip[0] - ox, tip[1] - oy);
  fade.addColorStop(0, 'rgb(0 0 0 / 0.85)');
  fade.addColorStop(0.3, 'rgb(0 0 0 / 0.55)');
  fade.addColorStop(1, 'rgb(0 0 0 / 0)');
  o.fillStyle = fade;
  o.fillRect(0, 0, size, size);
  g.drawImage(c, ox, oy);
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
    const roads = of('road');
    g.save();
    // Roads stay out of the lakes (a round end at a lake's corner would poke into it).
    if (borders.keepClear?.length) {
      g.beginPath();
      g.rect(0, 0, g.canvas.width, g.canvas.height);
      for (const outline of borders.keepClear) {
        outline.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
      }
      g.clip('evenodd');
    }
    for (const e of roads) band(g, tex, toPixel(e.a), toPixel(e.b), road, { alpha: ROAD_ALPHA, feather: ROAD });
    // Where three roads meet, a soft patch of road over the joins, so they blend into one crossing.
    const meets = new Map<string, { at: Point; n: number }>();
    for (const e of roads)
      for (const p of [toPixel(e.a), toPixel(e.b)]) {
        const k = `${Math.round(p[0])},${Math.round(p[1])}`;
        meets.set(k, { at: p, n: (meets.get(k)?.n ?? 0) + 1 });
      }
    // Only the road's surface (the middle of its picture, no verges): the whole strip laid flat looked like a little road across the crossing (owner's play-test).
    const surface = strip(borders.road, 0.3, 0.7, road);
    for (const { at, n } of meets.values()) if (n >= 3) pool(g, surface, at, road * 0.7, ROAD, ROAD_ALPHA);
    g.restore();
  }
  if (!borders.river) return;
  const img = borders.river;
  // The river picture's top strip (grass, then the bank's edge), mirrored to make both sides.
  const bankTex = strip(img, 0, 0.22, bank, true);
  // The shore: one strip of the river picture across the edge, from the land
  // (its grass and reeds, fading into the land's tile) over the bank's mud
  // into its water (washed with the lake's colour, fading into the lake's
  // own), with the hex edge falling between the reeds and the mud; under it,
  // shallows fading from the edge into the lake (owner's play-tests: neither
  // a band of water framing every lake, nor a hard edge, nor a double frame).
  const mud = averageColor(img, 0.16, 0.24);
  const shallow = averageColor(img, 0.26, 0.45, borders.water);
  const shoreTex = strip(img, 0, SHORE_ROWS, bank);
  // The water part (below the bank's edge) washed like the lakes.
  if (borders.water) {
    const sg = shoreTex.getContext('2d')!;
    const top = Math.round(shoreTex.height * (SHORE_EDGE / SHORE_ROWS));
    washWater(sg, borders.water, 0, top, shoreTex.width, shoreTex.height - top);
  }
  // The corners the rivers reach.
  const riverEnds = of('river').flatMap((e) => riverSpan(e).map(toPixel));
  for (const e of of('shore')) {
    const [a, b, land] = [toPixel(e.a), toPixel(e.b), toPixel(e.land!)];
    // The lake's middle: the land's, mirrored across the edge.
    const lake: Point = [a[0] + b[0] - land[0], a[1] + b[1] - land[1]];
    shallowsAlong(g, a, b, lake, bank * SHALLOWS_DEPTH, mud, shallow);
    // Land on the strip's top, moved toward the lake so most of it lies on the lake: a thin fade on the land side, then reeds standing in the shallows and the bank's mud, then its water fading out fast, so it never frames the lake.
    const width = bank * SHORE_WIDTH;
    const [p, q] = facing(a, b, land);
    // Where it meets a river at a corner, it fades out into the river rather than ending square (owner's play-test).
    const meetsRiver = (at: Point) => riverEnds.some((r) => Math.hypot(r[0] - at[0], r[1] - at[1]) < 2);
    const fadeLength = bank * 0.6;
    fadedBand(g, shoreTex, p, q, width, -width * (0.5 - SHORE_LINE), SHORE_FADE, { a: meetsRiver(p) ? fadeLength : 0, b: meetsRiver(q) ? fadeLength : 0 });
  }

  const rivers = of('river');
  const plainWater = strip(img, 0.3, 0.7, water);
  const waterTex = borders.water ? washed(plainWater, borders.water) : plainWater;
  // The water's middle only (no edges), for the patches over joins.
  const plainSurface = strip(img, 0.4, 0.6, water);
  const waterSurface = borders.water ? washed(plainSurface, borders.water) : plainSurface;
  const spans = rivers.map((e) => riverSpan(e).map(toPixel) as [Point, Point]);
  // Banks: both sides, or only the land side where a lake is alongside (the water opens into the lake).
  rivers.forEach((e, i) => {
    const [a, b] = spans[i]!;
    if (e.land) band(g, bankTex, ...facing(a, b, toPixel(e.land)), bank, { half: true });
    else band(g, bankTex, a, b, bank);
  });
  // Where a river stops among land, a round pool ringed by bank.
  const ends = rivers.flatMap((e, i) => [...(e.endA ? [spans[i]![0]] : []), ...(e.endB ? [spans[i]![1]] : [])]);
  for (const at of ends) pool(g, bankTex, at, (bank * 1.35) / 2);
  // Where two or more stretches of river meet (a bend, a fork, or along a lake), soft patches over the joins, so they flow on as one river (owner's play-test, as for the roads: each stretch's picture runs its own way and met the next in a hard cut): bank under the water, then a little water over it.
  const joins = new Map<string, { at: Point; n: number }>();
  for (const p of spans.flat()) {
    const k = `${Math.round(p[0])},${Math.round(p[1])}`;
    joins.set(k, { at: p, n: (joins.get(k)?.n ?? 0) + 1 });
  }
  const joined = [...joins.values()].filter((j) => j.n >= 2).map((j) => j.at);
  for (const at of joined) pool(g, bankTex, at, bank * 0.42, MELT, 0.8);
  for (const [a, b] of spans) band(g, waterTex, a, b, water, { feather: WATER });
  for (const at of ends) pool(g, waterTex, at, (water * 1.45) / 2, WATER);
  for (const at of joined) pool(g, waterSurface, at, water * 0.5, MELT, 0.85);

  // Where a river reaches a lake's corner, its mouth: the river's water runs
  // on into the lake, fading smoothly to nothing, over shallows fanning out
  // inside the lake (owner's play-tests: it stopped against the lake like a
  // pipe, then blurred onto the land, then showed hard-edged steps).
  const lakes = borders.keepClear ?? [];
  const lakeCorners = lakes.flat();
  const atLake = (p: Point) => lakeCorners.some((c) => Math.hypot(c[0] - p[0], c[1] - p[1]) < 2);
  // Only a river between two land hexes flows into a lake; one running along a lake's edge is open to it all along (owner's play-test: its water shot on past the corner).
  const mouths = spans.flatMap(([a, b], i) => (rivers[i]!.land ? [] : ([...(atLake(b) ? [[a, b]] : []), ...(atLake(a) ? [[b, a]] : [])] as [Point, Point][])));
  const reach = water * 2.4;
  if (mouths.length) {
    // The shallows' fan, kept inside the lake (a soft gradient, so no hard edge).
    g.save();
    g.beginPath();
    for (const outline of lakes) {
      outline.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
    }
    g.clip();
    for (const [, at] of mouths) {
      const fan = g.createRadialGradient(at[0], at[1], water * 0.2, at[0], at[1], reach);
      fan.addColorStop(0, `rgb(${shallow} / 0.45)`);
      fan.addColorStop(1, `rgb(${shallow} / 0)`);
      g.fillStyle = fan;
      g.fillRect(at[0] - reach, at[1] - reach, reach * 2, reach * 2);
    }
    g.restore();
  }
  for (const [from, at] of mouths) riverIntoLake(g, waterTex, from, at, water, reach);
}
