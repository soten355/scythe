// Little animations for gains: copies of an icon arc from where it is to a
// target (the current faction's spot in the top bar), one after another.
import type { Icon } from './icons';
import { MECH_PARTS } from './shapes';

/** Flies `count` copies of `icon` to `target`, then gives the target a little bump. Resolves when done. */
export async function flyTo(icon: Element, target: Element, count: number): Promise<void> {
  const from = icon.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  await Promise.all(
    Array.from({ length: Math.max(1, count) }, (_, i) => {
      const copy = icon.cloneNode(true) as HTMLElement;
      Object.assign(copy.style, {
        position: 'fixed',
        left: `${from.left}px`,
        top: `${from.top}px`,
        margin: '0',
        zIndex: '50',
        pointerEvents: 'none',
      });
      document.body.append(copy);
      return copy
        .animate(
          [
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 50}px) scale(1.5)`, opacity: 1, offset: 0.35 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0.3 },
          ],
          { duration: 850, delay: i * 180, easing: 'ease-in-out', fill: 'forwards' },
        )
        .finished.then(() => copy.remove());
    }),
  );
  await target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 300 }).finished;
}

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

/** A big moment: an icon (with a smaller one under it, say a recruit's bonus), or a mech being put together. */
export type Moment = { icon: Icon; below?: Icon; target: string } | { mech: { color: string; initial: string }; target: string };

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
  Object.entries({ y: '0.6', 'font-size': '6', 'font-weight': '700', 'text-anchor': 'middle', fill: '#fff' }).forEach(([k, v]) => label.setAttribute(k, v));
  label.textContent = initial;
  el.append(...parts, label);
  // The label goes on last.
  return { el, parts: [parts[0]!, parts[1]!, parts[2]!, label] };
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
    return pin(el, over, target, parts);
  }
  return pin(moment.below ? stacked(moment.icon, moment.below) : iconElement(moment.icon), over, target);
}

async function pin(el: Element, over: Element, target: Element | null, parts?: Element[]): Promise<void> {
  const box = over.getBoundingClientRect();
  const [cx, cy] = [box.left + box.width / 2, box.top + box.height / 2];
  Object.assign((el as HTMLElement).style, {
    position: 'fixed',
    left: `${cx}px`,
    top: `${cy}px`,
    fontSize: `${Math.min(110, box.height * 0.35)}px`,
    lineHeight: '1',
    zIndex: '50',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 6px 12px rgb(0 0 0 / 0.5))',
  });
  document.body.append(el);
  // A target that isn't on screen (a closed drawer, say): just fade out in place.
  const to = target?.getBoundingClientRect();
  const visible = to && to.width > 0 && to.bottom > 0 && to.top < innerHeight;
  const [dx, dy] = visible ? [to.left + to.width / 2 - cx, to.top + to.height / 2 - cy] : [0, 0];
  const at = (x: number, y: number, scale: number) => `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
  // A piece on the map: end at its size there.
  const onMap = target instanceof SVGElement;
  const end = !visible ? 0.6 : onMap ? to.width / el.getBoundingClientRect().width : 0.18;
  // The piece on the map waits under the big one until it lands.
  if (onMap) target.style.visibility = 'hidden';

  if (parts) {
    // Put together: each part drops into place with a little clunk, then the whole mech settles.
    await el.animate([{ transform: at(0, 0, 1), opacity: 0 }, { transform: at(0, 0, 1), opacity: 1 }], { duration: 150, fill: 'forwards' }).finished;
    for (const p of parts) p.setAttribute('opacity', '0');
    for (const [i, p] of parts.entries()) {
      p.removeAttribute('opacity');
      if (i === parts.length - 1) continue; // the label just appears
      await p.animate(
        [
          { transform: 'translateY(-5px)', opacity: 0 },
          { transform: 'translateY(0.4px)', opacity: 1, offset: 0.75 },
          { transform: 'translateY(0)', opacity: 1 },
        ],
        { duration: 300, easing: 'ease-in' },
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
