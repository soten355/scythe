// Filling an iPhone's screen. Installed on the home screen, iOS can report a page
// shorter than the screen, with the safe margins already taken off (763 tall, not
// 844), which leaves an empty strip at the far end. CSS has no way to ask for the
// real size, so here the page is sized from the screen itself. Everything that
// fills the screen (`position: fixed; inset: 0`) then fills this page, and the
// game's frame reads --screen-width and --screen-height (App.svelte). In Safari or
// on any other device this does nothing.

interface Size {
  width: number;
  height: number;
}

/** The largest short side that counts as a phone: the width the game's frame also uses (play/frame.ts). */
const PHONE = 600;

/** The size to fill, or null if this screen isn't a phone's. */
export function filledSize(screenSize: Size, upright: boolean): Size | null {
  const short = Math.min(screenSize.width, screenSize.height);
  const long = Math.max(screenSize.width, screenSize.height);
  if (short > PHONE) return null;
  return upright ? { width: short, height: long } : { width: long, height: short };
}

/** Size the page to the screen, now and whenever the phone turns. */
export function fillScreen(): void {
  // Only an iPhone's installed app has this; Safari has the browser's own bars to leave room for.
  if (!(navigator as { standalone?: boolean }).standalone) return;
  const upright = matchMedia('(orientation: portrait)');
  const apply = () => {
    const size = filledSize(screen, upright.matches);
    if (!size) return;
    const root = document.documentElement.style;
    root.setProperty('--screen-width', `${size.width}px`);
    root.setProperty('--screen-height', `${size.height}px`);
    root.width = `${size.width}px`;
    root.height = `${size.height}px`;
    const body = document.body.style;
    body.width = `${size.width}px`;
    body.height = `${size.height}px`;
    // Makes `position: fixed` screens measure the body rather than the short page.
    body.contain = 'layout';
  };
  apply();
  upright.addEventListener('change', apply);
  addEventListener('resize', apply);

  // The page is now larger than iOS thinks it is, so it could slide along and push
  // the game off the far edge. Every screen scrolls inside itself, so hold the page
  // still, unless iOS is lifting it to show a text field above the keyboard.
  const holdStill = () => {
    if (!document.activeElement?.matches('input, textarea') && (scrollX || scrollY)) scrollTo(0, 0);
  };
  addEventListener('scroll', holdStill);
  addEventListener('focusout', () => setTimeout(holdStill));
}
