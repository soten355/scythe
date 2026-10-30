// The map camera: which part of the board is on screen (a rectangle in board
// coordinates, shaped like the map area), how it zooms and pans, and where
// the game guides it: to the current player's units at the start of their
// turn, then to the hexes their top-row action works on, then to the
// bottom-row action's hexes.
import type { GameState, Location } from '@scythe/engine';
import type { Point } from './geometry';
import type { Prompt } from './prompt';
import { phase } from './turn';

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The whole board, and how close the camera may get (narrowest view width). */
export interface Limits {
  world: View;
  minW: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The widest view: the whole board, shaped like the screen. */
const maxWidth = ({ world }: Limits, aspect: number) => Math.max(world.w, world.h * aspect);

/** Keeps the view's middle over the board (or centres it once the whole board fits). */
function settle(cx: number, cy: number, w: number, aspect: number, limits: Limits): View {
  const { world } = limits;
  const h = w / aspect;
  if (w >= maxWidth(limits, aspect) - 1e-9) {
    cx = world.x + world.w / 2;
    cy = world.y + world.h / 2;
  } else {
    cx = clamp(cx, world.x, world.x + world.w);
    cy = clamp(cy, world.y, world.y + world.h);
  }
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** The view that shows `area` as large as possible, within the zoom limits. */
export function fitView(area: View, aspect: number, limits: Limits): View {
  const w = clamp(Math.max(area.w, area.h * aspect), limits.minW, maxWidth(limits, aspect));
  return settle(area.x + area.w / 2, area.y + area.h / 2, w, aspect, limits);
}

/** Zooms by `factor` (below 1 is closer) around `focus`, which stays put on screen. */
export function zoomAt(v: View, factor: number, focus: Point, aspect: number, limits: Limits): View {
  const w = clamp(v.w * factor, limits.minW, maxWidth(limits, aspect));
  const f = w / v.w;
  const x = focus[0] - (focus[0] - v.x) * f;
  const y = focus[1] - (focus[1] - v.y) * f;
  return settle(x + w / 2, y + w / aspect / 2, w, aspect, limits);
}

/** Moves the view by (dx, dy) board units. */
export function panBy(v: View, dx: number, dy: number, limits: Limits): View {
  return settle(v.x + v.w / 2 + dx, v.y + v.h / 2 + dy, v.w, v.w / v.h, limits);
}

/** The board point at a fraction across and down the view. */
export const worldOf = (v: View, [fx, fy]: Point): Point => [v.x + fx * v.w, v.y + fy * v.h];

/** Partway (t from 0 to 1) from one view to another. */
export const between = (a: View, b: View, t: number): View => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
});

/** Where the current player's units and structures are. */
function unitSpots(state: GameState): Location[] {
  const p = state.players[state.currentPlayer]!;
  const spots = [p.character, ...p.mechs, ...p.workers, ...Object.values(p.structures).filter((h): h is string => !!h)];
  return [...new Set(spots)];
}

/**
 * Where to point the camera, and a key that changes whenever there's
 * somewhere new to look: a new turn, a different section, the bottom row,
 * and each step within an action (a unit picked, a unit moved, a hex picked)
 * that changes which hexes matter. The board skips moves too small to notice.
 */
export function guide(state: GameState, prompt: Prompt): { key: string; spots: Location[] } | null {
  const turn = state.turn;
  const t = state.turnsTaken;
  if (turn.step === 'chooseSection') return { key: `${t}:start`, spots: unitSpots(state) };
  if (turn.step === 'end') return null;
  const stage = phase(state) === 'bottom' ? (prompt.paying ? 'pay' : 'act') : 'top';
  // The hexes you can tap now, and the one picked (a selected unit's hex, say).
  const spots = [...new Set([...prompt.highlights, ...(prompt.selected ? [prompt.selected] : [])])].sort();
  const look = spots.length ? spots : unitSpots(state);
  return { key: `${t}:${turn.section}:${stage}:${look.join(',')}`, spots: look };
}
