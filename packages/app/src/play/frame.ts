// The game's frame (`.game-frame` in App.svelte). The game is always laid out
// sideways. iPhones won't let a web app lock its rotation, so on a phone held
// upright the frame is drawn turned a quarter turn, its left edge along the
// phone's top. Screen positions (taps, getBoundingClientRect) then don't match
// the game's own, and these convert them. Anywhere else they change nothing.
import type { Point } from './geometry';

/** Keep in step with the rule for `.game-frame` in App.svelte. */
const TURNED = '(orientation: portrait) and (pointer: coarse) and (max-width: 600px)';

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

/** A spot on the screen, as the turned game sees it. */
export const turnedPoint = (x: number, y: number, screenWidth: number): Point => [y, screenWidth - x];

/** A box on the screen, as the turned game sees it. */
export const turnedRect = (r: Box, screenWidth: number): Box => ({
  left: r.top,
  right: r.bottom,
  top: screenWidth - r.right,
  bottom: screenWidth - r.left,
  width: r.height,
  height: r.width,
});

const isTurned = (el: Element) => !!el.closest('.game-frame') && matchMedia(TURNED).matches;

/** Where a screen position (a tap, say) falls, as `el`'s game sees it. */
export const framePoint = (el: Element, x: number, y: number): Point => (isTurned(el) ? turnedPoint(x, y, innerWidth) : [x, y]);

/** `el`'s box, as its game sees it. */
export function frameRect(el: Element): Box {
  const r = el.getBoundingClientRect();
  return isTurned(el) ? turnedRect(r, innerWidth) : r;
}

/** The frame the game is drawn in, if it's on the page. */
export const gameFrame = () => document.querySelector<HTMLElement>('.game-frame');
