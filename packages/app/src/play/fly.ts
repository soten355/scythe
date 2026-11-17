// Big moments over the map: a large icon pinned in the middle, then flown to
// where it belongs.
import { frameRect, gameFrame } from './frame';
import type { Icon } from './icons';
import { inkOn } from './ink';
import type { Resource } from '@scythe/engine';
import { goods, MAX_SHOWN, structureParts, type Part } from './build-art';
import { MECH_PARTS } from './shapes';

/** An icon (see icons.ts) as a standalone element. */
function iconElement(icon: Icon): HTMLElement {
  if ('image' in icon) {
    const img = document.createElement('img');
    img.src = import.meta.env.BASE_URL + icon.image;
    Object.assign(img.style, { width: '1em', height: '1em' });
    return img;
  }
  const span = document.createElement('span');
  span.textContent = icon.text;
  return span;
}

/** A big moment: an icon (with a smaller one under it, say a recruit's bonus), a mech or a structure being put together, or a hex's goods being produced and stacked. */
export type Moment =
  | { icon: Icon; below?: Icon; target: string; sides?: Side[] }
  | { mech: { color: string; initial: string }; target: string }
  | { structure: { color: string }; target: string }
  | { produce: { what: Resource | 'worker'; amount: number; color: string }; target: string };

/**
 * A smaller gain beside the icon (a recruit's one-time bonus: "+2 ⚡"; an
 * encounter's rewards), flown to the first of `targets` on screen; on a chip
 * of `color` when it says whose it is (recruit bonuses paid to neighbours).
 */
type Side = { text: string; icon: Icon; targets: string[]; color?: string };

const SVG = 'http://www.w3.org/2000/svg';

/** An icon with a smaller one underneath. */
function stacked(icon: Icon, below: Icon): HTMLElement {
  const box = document.createElement('div');
  Object.assign(box.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.08em' });
  const small = iconElement(below);
  small.style.fontSize = '0.45em';
  box.append(iconElement(icon), small);
  return box;
}

/** A mech drawn big, its parts (legs, hull, arms) separate so they can be put together one by one. */
function mechElement(color: string, initial: string): { el: SVGSVGElement; parts: SVGElement[] } {
  const el = document.createElementNS(SVG, 'svg');
  el.setAttribute('viewBox', '-9 -8 18 16');
  Object.assign(el.style, { width: '1.4em', height: '1.25em', overflow: 'visible' });
  const parts = MECH_PARTS.map((d) => {
    const path = document.createElementNS(SVG, 'path');
    Object.entries({ d, fill: color, stroke: '#1e1a16', 'stroke-width': '0.7', 'stroke-linejoin': 'round' }).forEach(([k, v]) => path.setAttribute(k, v));
    return path;
  });
  const label = document.createElementNS(SVG, 'text');
  Object.entries({ y: '0.6', 'font-size': '6', 'font-weight': '700', 'text-anchor': 'middle', fill: inkOn(color) }).forEach(([k, v]) => label.setAttribute(k, v));
  label.textContent = initial;
  el.append(...parts, label);
  // The label goes on last.
  return { el, parts: [parts[0]!, parts[1]!, parts[2]!, label] };
}

/** A drawn part (see build-art.ts) as an SVG group. */
function partElement(part: Part, at: [number, number] = [0, 0]): SVGGElement {
  const g = document.createElementNS(SVG, 'g');
  const place = document.createElementNS(SVG, 'g');
  place.setAttribute('transform', `translate(${at[0]} ${at[1]})${part.scale ? ` scale(${part.scale})` : ''}`);
  const path = document.createElementNS(SVG, 'path');
  Object.entries({ d: part.d, fill: part.fill, stroke: '#1e1a16', 'stroke-width': String(0.6 / (part.scale ?? 1)), 'stroke-linejoin': 'round' }).forEach(([k, v]) => path.setAttribute(k, v));
  place.append(path);
  if (part.lines) {
    const lines = document.createElementNS(SVG, 'path');
    Object.entries({ d: part.lines.d, fill: 'none', stroke: part.lines.stroke, 'stroke-width': '0.45', 'stroke-linecap': 'round' }).forEach(([k, v]) => lines.setAttribute(k, v));
    place.append(lines);
  }
  // The outer group is the one that drops in (its own transform stays free for that).
  g.append(place);
  return g;
}

/** A big drawing in the mech's box, holding `parts` (each its own group). */
function drawing(parts: SVGElement[]): SVGSVGElement {
  const el = document.createElementNS(SVG, 'svg');
  el.setAttribute('viewBox', '-9 -8 18 16');
  Object.assign(el.style, { width: '1.4em', height: '1.25em', overflow: 'visible' });
  el.append(...parts);
  return el;
}

/** A structure drawn big, its parts (footing, walls, roof, chimney, door) separate so it can go up one by one. */
function structureElement(color: string): { el: SVGSVGElement; parts: SVGElement[] } {
  const parts = structureParts(color).map((p) => partElement(p));
  return { el: drawing(parts), parts };
}

/** A hex's goods drawn big, each separate so they can be stacked one by one; past MAX_SHOWN, a count goes on last. */
function goodsElement(what: Resource | 'worker', amount: number, color: string): { el: SVGSVGElement; parts: SVGElement[] } {
  const parts: SVGElement[] = goods(what, amount, color).map(({ at, parts: [first, ...rest] }) => {
    const g = partElement(first!, at);
    for (const p of rest) g.append(...partElement(p, at).childNodes);
    return g;
  });
  if (amount > MAX_SHOWN) {
    const count = document.createElementNS(SVG, 'text');
    Object.entries({ x: '8.5', y: '-3', 'font-size': '4.5', 'font-weight': '700', 'text-anchor': 'start', fill: '#fff', stroke: '#1e1a16', 'stroke-width': '0.4', 'paint-order': 'stroke' }).forEach(([k, v]) => count.setAttribute(k, v));
    count.textContent = `×${amount}`;
    parts.push(count);
  }
  return { el: drawing(parts), parts };
}

/**
 * A big moment (a recruit placed, a star earned, a mech deployed): a large
 * icon fades in over the middle of `over`, settles as if pinned there and
 * holds, then shrinks and flies into `target` (which gets a little bump). A
 * mech is put together instead, piece by piece, then shrinks onto its hex.
 * Resolves when done.
 */
export async function showMoment(moment: Moment, over: Element): Promise<void> {
  const target = document.querySelector(moment.target);
  if ('mech' in moment) {
    const { el, parts } = mechElement(moment.mech.color, moment.mech.initial);
    return pin(el, over, target, { parts, labelLast: true });
  }
  if ('structure' in moment) {
    const { el, parts } = structureElement(moment.structure.color);
    return pin(el, over, target, { parts, labelLast: true });
  }
  if ('produce' in moment) {
    const { what, amount, color } = moment.produce;
    const { el, parts } = goodsElement(what, amount, color);
    return pin(el, over, target, { parts, labelLast: amount > MAX_SHOWN, quick: true });
  }
  const main = pin(moment.below ? stacked(moment.icon, moment.below) : iconElement(moment.icon), over, target);
  if (!moment.sides?.length) return main;
  // Chips (one per player) in a column to the right of the main icon; other gains side by side.
  const chips = moment.sides.every((side) => side.color);
  const place = (i: number): [number, number] => (chips ? [1.05, (i - (moment.sides!.length - 1) / 2) * 0.62] : [1.1 + i * 0.95, 0]);
  await Promise.all([main, ...moment.sides.map((side, i) => pin(sideElement(side), over, onScreen(side.targets), undefined, ...place(i)))]);
}

/** The side gain: its amount and icon, about half the main icon's size. */
function sideElement(side: Side): HTMLElement {
  const el = document.createElement('span');
  const inner = document.createElement('span');
  Object.assign(inner.style, { fontSize: '0.5em', fontWeight: '700', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.1em' });
  if (side.color) Object.assign(inner.style, { fontSize: '0.42em', background: side.color, color: inkOn(side.color), padding: '0.06em 0.22em', borderRadius: '0.5em', border: '0.04em solid #ffe9a8' });
  inner.append(side.text, iconElement(side.icon));
  el.append(inner);
  return el;
}

const isShown = (el: Element | null) => {
  const r = el && frameRect(el);
  return !!r && r.width > 0 && r.bottom > 0 && r.top < (gameFrame()?.clientHeight ?? innerHeight);
};
const onScreen = (selectors: string[]) => selectors.map((s) => document.querySelector(s)).find(isShown) ?? null;

/**
 * Put together part by part (`build`): each drops into place, the last one
 * just appearing when `labelLast` (a mech's letter, a structure's door, a
 * count); `quick` for goods, which stack faster.
 */
type Build = { parts: Element[]; labelLast?: boolean; quick?: boolean };

/** `right`, `down`: how far right of and below the middle to pin it, in the big icon's size. */
async function pin(el: Element, over: Element, target: Element | null, build?: Build, right = 0, down = 0): Promise<void> {
  const box = frameRect(over);
  // Things being put together (a mech, a structure, goods) grow with the screen: about as on a phone there, much bigger on a desktop (owner's play-test: too small on the Mac).
  const size = build ? Math.max(90, Math.min(box.height * 0.34, box.width * 0.22)) : Math.min(110, box.height * 0.35);
  const [cx, cy] = [box.left + box.width / 2 + right * size, box.top + box.height / 2 + down * size];
  Object.assign((el as HTMLElement).style, {
    position: 'fixed',
    left: `${cx}px`,
    top: `${cy}px`,
    fontSize: `${size}px`,
    lineHeight: '1',
    zIndex: '50',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 6px 12px rgb(0 0 0 / 0.5))',
    // Unseen until its animation starts (owner's play-test: the finished mech flashed up before being put together).
    opacity: '0',
  });
  // Its parts hidden before it's ever on screen, so they can appear one by one.
  if (build) for (const p of build.parts) p.setAttribute('opacity', '0');
  (gameFrame() ?? document.body).append(el);
  // A target that isn't on screen (a closed drawer, say): just fade out in place.
  const to = target ? frameRect(target) : undefined;
  const visible = to && isShown(target);
  const [dx, dy] = visible ? [to.left + to.width / 2 - cx, to.top + to.height / 2 - cy] : [0, 0];
  const at = (x: number, y: number, scale: number) => `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
  // A piece on the map: end at its size there.
  const onMap = target instanceof SVGElement;
  const end = !visible ? 0.6 : onMap ? to.width / frameRect(el).width : 0.18;
  // The piece on the map waits under the big one until it lands.
  if (onMap) target.style.visibility = 'hidden';

  if (build) {
    const { parts, labelLast, quick } = build;
    // Put together: each part drops into place with a little clunk, then the whole thing settles.
    await el.animate([{ transform: at(0, 0, 1), opacity: 0 }, { transform: at(0, 0, 1), opacity: 1 }], { duration: 150, fill: 'forwards' }).finished;
    for (const [i, p] of parts.entries()) {
      p.removeAttribute('opacity');
      if (labelLast && i === parts.length - 1) continue; // the label just appears
      await p.animate(
        [
          { transform: 'translateY(-5px)', opacity: 0 },
          { transform: 'translateY(0.4px)', opacity: 1, offset: 0.75 },
          { transform: 'translateY(0)', opacity: 1 },
        ],
        { duration: quick ? 220 : 300, easing: 'ease-in' },
      ).finished;
    }
    await el.animate([{ transform: at(0, 0, 1) }, { transform: at(0, 0, 1.08) }, { transform: at(0, 0, 1) }], { duration: 220, fill: 'forwards' }).finished;
    await el.animate(
      [
        { transform: at(0, 0, 1), opacity: 1, offset: 0 },
        { transform: at(0, 0, 1), opacity: 1, offset: 0.4, easing: 'ease-in' },
        { transform: at(dx, dy, end), opacity: visible ? 1 : 0 },
      ],
      { duration: 1000, fill: 'forwards' },
    ).finished;
  } else {
    await el.animate(
      [
        { transform: at(0, 0, 1.7), opacity: 0 },
        { transform: at(0, 0, 0.94), opacity: 1, offset: 0.2, easing: 'ease-out' },
        // Pinned: a little settle, then it holds.
        { transform: at(0, 0, 1), opacity: 1, offset: 0.26 },
        { transform: at(0, 0, 1), opacity: 1, offset: 0.62, easing: 'ease-in' },
        { transform: at(dx, dy, end), opacity: visible ? 0.9 : 0 },
      ],
      { duration: 1900, fill: 'forwards' },
    ).finished;
  }
  el.remove();
  if (onMap) target.style.visibility = '';
  // Map pieces are placed with an SVG transform that a bump would override.
  if (visible && !onMap) await target!.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300 }).finished;
}
