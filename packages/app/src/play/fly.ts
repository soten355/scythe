// Little animations for gains: copies of an icon arc from where it is to a
// target (the current faction's spot in the top bar), one after another.

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
