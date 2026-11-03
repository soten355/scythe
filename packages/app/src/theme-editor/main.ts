// Theme editor: put your own pictures (made in ComfyUI or anywhere) into the
// game. For now, the board: the map background, art for each terrain's
// hexes, each terrain's symbol, the tunnel and encounter markers, and the
// resource tokens, plus the hex colours. Every change is kept on this device
// at once and used by the game the next time it opens; themes can be saved
// to a file and opened on another device. Plain DOM, no framework; shares
// its look with the other editors.
import type { Terrain } from '@scythe/engine';
import '../shared/forms.css';
import './theme-editor.css';
import { ask, esc, tell } from '../shared/editor-utils';
import { SaveStore } from '../saves/store';
import { exportTheme } from '../saves/files';
import { corners, points, SIZE, type Point } from '../play/geometry';
import type { Icon } from '../play/icons';
import { boardLook, clearPicture, DEFAULT_COLORS, DEFAULT_THEME, parseThemeFile, setColor, setPicture, SLOTS, TERRAINS, type SlotId, type Theme } from '../theme/theme';
import { pictureFor, sizeKb } from '../theme/pictures';

const store = new SaveStore();
const root = document.querySelector<HTMLDivElement>('#theme-editor')!;
let theme: Theme = DEFAULT_THEME;
let status = '';

async function keep(next: Theme, note = 'Saved on this device: the game uses it the next time it opens.') {
  theme = next;
  render();
  try {
    await store.putTheme(theme);
    show(note);
  } catch {
    show("This couldn't be kept on the device (it may be out of room). Save it to a file to keep it.", true);
  }
}

function show(message: string, bad = false) {
  status = message;
  const el = root.querySelector<HTMLElement>('.status');
  if (el) {
    el.textContent = message;
    el.className = bad ? 'status bad' : 'status';
  }
}

// ---- preview -----------------------------------------------------------------

const icon = (i: Icon | undefined, x: number, y: number, size: number, faded = false) => {
  if (!i) return '';
  if ('image' in i) {
    const href = i.image.startsWith('data:') ? i.image : import.meta.env.BASE_URL + i.image;
    return `<image href="${esc(href)}" x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" ${faded ? 'opacity="0.45"' : ''}/>`;
  }
  return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" ${faded ? 'opacity="0.45"' : ''}>${esc(i.text)}</text>`;
};

/** A few hexes, one of each terrain, drawn as the board will draw them, with a tunnel, an encounter and resources on some. */
function preview(): string {
  const look = boardLook(theme);
  const w = SIZE * Math.sqrt(3);
  const spots: Point[] = [
    [0, 0], [w, 0], [2 * w, 0], [3 * w, 0],
    [w / 2, SIZE * 1.5], [1.5 * w, SIZE * 1.5], [2.5 * w, SIZE * 1.5],
  ];
  const defs = TERRAINS.filter((t) => look.art(t))
    .map((t) => `<pattern id="p-${t}" width="1" height="1" patternContentUnits="objectBoundingBox"><image href="${esc(look.art(t)!)}" width="1" height="1" preserveAspectRatio="xMidYMid slice"/></pattern>`)
    .join('');
  const hexes = TERRAINS.map((t, i) => {
    const c = spots[i]!;
    const fill = look.art(t) ? `url(#p-${t})` : look.fill(t);
    let extra = '';
    if (t === 'mountain') extra += icon(look.tunnel, c[0], c[1] - SIZE * 0.62, SIZE * 0.36);
    if (t === 'forest') extra += icon(look.encounter, c[0], c[1] + SIZE * 0.62, SIZE * 0.36);
    if (t === 'farm' || t === 'tundra') {
      const res = t === 'farm' ? (['food', 'wood'] as const) : (['oil', 'metal'] as const);
      extra += res
        .map((r, k) => {
          const x = c[0] - 7 + k * 14;
          const y = c[1] + SIZE * 0.3;
          const url = look.token(r);
          const color = { oil: '#1b1b1b', metal: '#9aa3ad', wood: '#7a4a24', food: '#f0d54a' }[r];
          return `<circle cx="${x}" cy="${y}" r="6" fill="${color}" stroke="#1e1a16" stroke-width="1"/>${url ? `<image href="${esc(url)}" x="${x - 7.5}" y="${y - 7.5}" width="15" height="15"/>` : ''}`;
        })
        .join('');
    }
    return `<polygon points="${points(corners(c))}" fill="${fill}" stroke="#1e1a16" stroke-width="1.5"/>${icon(look.symbol(t), c[0], c[1], SIZE * 0.65, true)}${extra}`;
  }).join('');
  const pad = SIZE + 4;
  return `<div class="preview" style="${look.background ? `background-image:url(${look.background})` : ''}">
    <svg viewBox="${-pad} ${-pad} ${3 * w + 2 * pad} ${SIZE * 1.5 + 2 * pad}">${defs ? `<defs>${defs}</defs>` : ''}${hexes}</svg>
  </div>`;
}

// ---- the page ------------------------------------------------------------------

function slotRow(id: SlotId, label: string, hint: string): string {
  const url = theme.pictures[id];
  const terrain = id.startsWith('hex.') ? (id.slice(4) as Terrain) : null;
  return `<div class="slot">
    <div class="thumb ${id.startsWith('hex.') ? 'hex' : ''}">${url ? `<img src="${esc(url)}" alt="">` : '<span>—</span>'}</div>
    <div class="what"><b>${esc(label)}</b><small>${esc(hint)}${url ? ` · ${sizeKb(url)} KB` : ''}</small></div>
    ${terrain ? `<label class="color" title="Colour where there's no picture">Colour<input type="color" data-color="${terrain}" value="${theme.colors[terrain] ?? DEFAULT_COLORS[terrain]}"></label>` : ''}
    <button data-act="choose" data-slot="${id}">${url ? 'Change…' : 'Choose…'}</button>
    ${url ? `<button data-act="clear" data-slot="${id}">Clear</button>` : ''}
  </div>`;
}

function render() {
  const groups = [...new Set(SLOTS.map((s) => s.group))];
  const total = Object.values(theme.pictures).reduce((n, url) => n + sizeKb(url ?? ''), 0);
  root.innerHTML = `
    <header>
      <a class="back" href="${import.meta.env.BASE_URL}">← Back to app</a>
      <label>Theme<input type="text" data-name value="${esc(theme.name)}"></label>
      <span class="spacer"></span>
      <button data-act="open">Open theme file…</button>
      <button data-act="file">Save theme file</button>
      <button data-act="reset">Back to the usual look</button>
    </header>
    <div class="theme-body">
      <div class="slots">
        ${groups
          .map(
            (g) => `<section><h3>${esc(g)}</h3>
              ${g === 'Hex symbols' ? `<label class="check"><input type="checkbox" data-over ${theme.symbolsOverArt ? 'checked' : ''}> Show symbols over hex art too</label>` : ''}
              ${SLOTS.filter((s) => s.group === g).map((s) => slotRow(s.id, s.label, s.hint)).join('')}
            </section>`,
          )
          .join('')}
      </div>
      <div class="side">
        <h3>Preview</h3>
        ${preview()}
        <p class="note">Best sizes, in pixels: hex art 448 × 512 (the hex's shape), the map background 1600 × 896, symbols, markers and tokens 256 × 256. Bigger pictures are shrunk to these as they come in, so the board stays quick on the phone. This theme: about ${total} KB.</p>
        <p class="note">Use your own pictures (drawn, photographed or generated), not scans of the published game.</p>
      </div>
    </div>
    <input type="file" accept="image/*" data-picture hidden>
    <input type="file" accept=".json,application/json" data-themefile hidden>
    <div class="status">${esc(status)}</div>`;
}

// ---- input -----------------------------------------------------------------------

let choosing: SlotId | null = null;

root.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
  if (!btn) return;
  const slot = btn.dataset.slot as SlotId | undefined;
  switch (btn.dataset.act) {
    case 'choose':
      choosing = slot!;
      root.querySelector<HTMLInputElement>('[data-picture]')!.click();
      break;
    case 'clear':
      await keep(clearPicture(theme, slot!));
      break;
    case 'file':
      await exportTheme(theme);
      break;
    case 'open':
      root.querySelector<HTMLInputElement>('[data-themefile]')!.click();
      break;
    case 'reset':
      if (await ask('Go back to the usual look? Every picture and colour in this theme is removed from the device (save it to a file first to keep it).')) {
        await keep(DEFAULT_THEME, 'Back to the usual look.');
      }
      break;
  }
});

root.addEventListener('change', async (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.picture !== undefined) {
    const file = el.files?.[0];
    el.value = '';
    if (!file || !choosing) return;
    const slot = choosing;
    show('Shrinking the picture…');
    try {
      await keep(setPicture(theme, slot, await pictureFor(slot, file)));
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), true);
    }
  } else if (el.dataset.themefile !== undefined) {
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;
    try {
      const opened = parseThemeFile(await file.text());
      if (await ask(`Use the theme "${opened.name}"? It replaces the one on this device (save that to a file first to keep it).`)) {
        await keep(opened, `Opened "${opened.name}": saved on this device.`);
      }
    } catch (err) {
      await tell(err instanceof Error ? err.message : String(err));
    }
  } else if (el.dataset.color) {
    await keep(setColor(theme, el.dataset.color as Terrain, el.value));
  } else if (el.dataset.over !== undefined) {
    await keep({ ...theme, symbolsOverArt: el.checked });
  } else if (el.dataset.name !== undefined) {
    await keep({ ...theme, name: el.value.trim() || DEFAULT_THEME.name });
  }
});

render();
store.theme().then(
  (t) => {
    theme = t;
    render();
  },
  () => show("The theme on this device couldn't be read.", true),
);
