// Little animations for gains: copies of an icon arc from where it is to a
// target (the current faction's spot in the top bar), one after another.
import type { Icon } from './icons';

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

/**
 * A big moment (a recruit placed, a star earned): a large icon fades in over
 * the middle of `over`, settles as if pinned there and holds, then shrinks
 * and flies into `target` (which gets a little bump). Resolves when done.
 */
export async function pinTo(icon: Icon, over: Element, target: Element | null): Promise<void> {
  const box = over.getBoundingClientRect();
  const el = iconElement(icon);
  const [cx, cy] = [box.left + box.width / 2, box.top + box.height / 2];
  Object.assign(el.style, {
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
  await el.animate(
    [
      { transform: at(0, 0, 1.7), opacity: 0 },
      { transform: at(0, 0, 0.94), opacity: 1, offset: 0.2, easing: 'ease-out' },
      // Pinned: a little settle, then it holds.
      { transform: at(0, 0, 1), opacity: 1, offset: 0.26 },
      { transform: at(0, 0, 1), opacity: 1, offset: 0.62, easing: 'ease-in' },
      { transform: at(dx, dy, visible ? 0.18 : 0.6), opacity: visible ? 0.9 : 0 },
    ],
    { duration: 1900, fill: 'forwards' },
  ).finished;
  el.remove();
  if (visible) await target!.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300 }).finished;
}
