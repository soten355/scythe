// Screenshots of the game with a skin, to check the board's look without a
// phone: starts the app (its dev server), opens it in a hidden browser
// (Playwright's Chromium) at iPhone and Mac sizes, opens the
// skin file, starts a game and saves pictures of the map to
// tools/out/screens/. Run with `npm run screenshots -- <skin file>` (paths
// from the tools folder, e.g. ../art/reap/reap.scythe-skin.json).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, webkit, type Page } from 'playwright';
import { createServer } from 'vite';

const [skinFile] = process.argv.slice(2);
const app = resolve(import.meta.dirname, '../../packages/app');
const server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { port: 5299, strictPort: false }, logLevel: 'error' });
await server.listen();
const address = server.resolvedUrls!.local[0]!;
if (!skinFile) throw new Error('Give the skin file: npm run screenshots -- art/reap/my.scythe-skin.json');
const out = resolve(import.meta.dirname, '../out/screens');
mkdirSync(out, { recursive: true });

const SIZES = [
  { name: 'iphone', viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'mac', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
];

async function openSkin(page: Page) {
  await page.goto(address + '#skins');
  await page.locator('input[type=file]').first().setInputFiles(resolve(skinFile!));
  // Opening a skin puts it in use.
  await page.getByText(/put it in use/).waitFor({ timeout: 60_000 });
}

async function startGame(page: Page) {
  await page.goto(address);
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  // The painted map is ready once its one picture is on the board.
  await page.locator('image.passive').first().waitFor({ state: 'attached', timeout: 60_000 }).catch(async (e) => {
    await page.screenshot({ path: join(out, 'stuck.png') });
    throw e;
  });
  await page.waitForTimeout(1500);
}

// Chromium (Chrome's engine) by default: headless WebKit paints the baked map
// black (an old version did too, while real Safari draws it), so it's only for
// checking layout: BROWSER=webkit.
const browser = await (process.env.BROWSER === 'webkit' ? webkit : chromium).launch();
for (const size of SIZES) {
  const context = await browser.newContext(size);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`[${size.name}] page error:`, e.message));
  await openSkin(page);
  await startGame(page);
  await page.screenshot({ path: join(out, `${size.name}-game.png`) });
  // The painted map on its own, as the board got it.
  const baked = await page.locator('image.passive').first().getAttribute('href');
  if (baked) {
    const png = await page.evaluate(async (url) => {
      const blob = await (await fetch(url)).blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let text = '';
      for (const b of bytes) text += String.fromCharCode(b);
      return btoa(text);
    }, baked);
    writeFileSync(join(out, `${size.name}-map.png`), Buffer.from(png, 'base64'));
  }
  // Closer: zoom in a few times with the board's + button, if there is one.
  const zoomIn = page.getByRole('button', { name: /zoom in/i }).first();
  if (await zoomIn.isVisible().catch(() => false)) {
    for (let i = 0; i < 3; i++) await zoomIn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(out, `${size.name}-close.png`) });
  }
  console.log(`${size.name}: saved`);
  await context.close();
}
await browser.close();
await server.close();
