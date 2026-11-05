// Theme editor: put your own pictures (made in ComfyUI or anywhere) into the
// game. For now, the board: the map background, art for each terrain's
// hexes, each terrain's symbol, the tunnel and encounter markers, and the
// resource tokens, plus the hex colours; the backdrop behind fights on
// each terrain; and the look and feel (the menus' and panels' colours, fonts
// and pictures). Every change is kept on this device
// at once and used by the game the next time it opens; themes can be saved
// to a file and opened on another device. Plain DOM, no framework; shares
// its look with the other editors.
import type { Terrain } from '@scythe/engine';
import '../shared/forms.css';
import './theme-editor.css';
import { ask, esc, tell } from '../shared/editor-utils';
import { SaveStore } from '../saves/store';
import { exportPicture, exportTheme } from '../saves/files';
import { BUILT_IN } from '../content/catalog';
import { mapPictureFrame } from '../play/map-picture';
import { mapGuide } from '../theme/map-guide';
import { center, corners, points, SIZE, type Point } from '../play/geometry';
import type { Icon } from '../play/icons';
import { boardLook, clearPicture, DEFAULT_COLORS, DEFAULT_THEME, DEFAULT_UI_COLORS, FONTS, parseThemeFile, setColor, setPicture, SLOTS, TERRAINS, UI_COLORS, uiStyle, type FontId, type SlotId, type Theme, type UiColor } from '../theme/theme';
import { pictureFor, sizeKb } from '../theme/pictures';

const store = new SaveStore();
const root = document.querySelector<HTMLDivElement>('#theme-editor')!;
let theme: Theme = DEFAULT_THEME;
let status = '';
/** The skin being edited (the one in use). */
let skinName = 'Original';

async function keep(next: Theme, note = 'Saved on this device: the game uses it the next time it opens.') {
  theme = next;
  render();
  try {
    await store.putTheme(theme);
    skinName = (await store.activeSkin()).name;
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

/** The map the guide and preview use: the default one. */
const MAP = BUILT_IN.maps[0]!.board;

/** With a map picture: the whole default map over it, drawn as the board will draw it. */
function mapPreview(): string {
  const look = boardLook(theme);
  const f = mapPictureFrame(MAP);
  const hexes = Object.values(MAP.hexes)
    .map((h) => {
      const pts = points(corners(center(h)));
      if (look.painted) return look.edges ? `<polygon points="${pts}" fill="none" stroke="rgb(255 246 220 / 0.28)" stroke-width="0.8"/>` : '';
      return `<polygon points="${pts}" fill="${look.fill(h.terrain)}" stroke="#1e1a16" stroke-width="1"/>${icon(look.symbol(h.terrain), ...center(h), SIZE * 0.65, true)}`;
    })
    .join('');
  return `<div class="preview"><svg viewBox="${f.x} ${f.y} ${f.width} ${f.height}"><image href="${esc(look.background!)}" x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}" preserveAspectRatio="none"/>${hexes}</svg></div>`;
}

/** A few hexes, one of each terrain, drawn as the board will draw them, with a tunnel, an encounter and resources on some. */
function preview(): string {
  const look = boardLook(theme);
  if (look.background) return mapPreview();
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
  return `<div class="preview">
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

/** The map picture's settings, and the guide to paint it from. */
function mapSettings(): string {
  return `<div class="guide">
      <span>Map guide: the default map's hexes in flat terrain colours, 1600 × 896, to paint the map picture from.</span>
      <button data-act="guide">Save map guide</button>
      <button data-act="guide-rivers">… with rivers</button>
    </div>
    <label class="check"><input type="checkbox" data-painted ${theme.paintedMap ? 'checked' : ''}> The map picture is the hexes' art (hexes see-through over it, no hex art)</label>
    <label class="check"><input type="checkbox" data-edges ${theme.hexEdges ? 'checked' : ''} ${theme.paintedMap ? '' : 'disabled'}> Faint hex edges over the map picture</label>`;
}

/** The menus' and panels' colours and fonts. */
function lookAndFeel(): string {
  const fontPick = (key: 'bodyFont' | 'headingFont', label: string) =>
    `<label class="font">${label}<select data-font="${key}">${FONTS.map((f) => `<option value="${f.id}" ${theme[key] === f.id ? 'selected' : ''} style="font-family:${esc(f.stack)}">${esc(f.label)}</option>`).join('')}</select></label>`;
  const colors = UI_COLORS.map((c) => {
    const set = theme.uiColors[c.id];
    return `<div class="slot ui-color">
      <input type="color" data-ui-color="${c.id}" value="${set ?? DEFAULT_UI_COLORS[c.id]}">
      <div class="what"><b>${esc(c.label)}</b><small>${esc(c.hint)}</small></div>
      ${set ? `<button data-act="ui-color-reset" data-ui="${c.id}" title="Back to the usual colour">Usual</button>` : ''}
    </div>`;
  }).join('');
  return `<div class="fonts">${fontPick('headingFont', 'Titles')}${fontPick('bodyFont', 'Words')}</div>
    <div class="ui-colors">${colors}</div>`;
}

/** A little menu and panel in the chosen colours and fonts. */
function uiPreview(): string {
  const vars = Object.entries(uiStyle(theme)).map(([k, v]) => `${k}:${v}`).join(';');
  const menu = theme.pictures['ui.menu'];
  const panel = theme.pictures['ui.panel'];
  return `<div class="ui-preview" style="${esc(vars)}">
    <div class="ui-menu" ${menu ? `style="background-image:url('${esc(menu)}')"` : ''}>
      <h1>Scythe</h1>
      <span class="ui-btn primary">Continue</span>
      <span class="ui-btn">New game</span>
    </div>
    <div class="ui-panel" ${panel ? `style="background-image:url('${esc(panel)}')"` : ''}>
      <div class="ui-panel-body">
        <b>Nordic: choose a section</b>
        <span class="ui-btn chosen">Move / Build</span>
        <span class="ui-btn">Trade / Enlist</span>
        <span class="ui-btn primary">End turn</span>
      </div>
    </div>
  </div>`;
}

function render() {
  const groups = [...new Set(SLOTS.map((s) => s.group))];
  const total = Object.values(theme.pictures).reduce((n, url) => n + sizeKb(url ?? ''), 0);
  root.innerHTML = `
    <header>
      <a class="back" href="${import.meta.env.BASE_URL}#workshop">← Workshop</a>
      <span class="editing">Skin: <b>${esc(skinName)}</b>${skinName === 'Original' ? ' (changes start a skin of your own)' : ''}</span>
      <label>Theme name<input type="text" data-name value="${esc(theme.name)}"></label>
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
              ${g === 'Map' ? mapSettings() : ''}
              ${g === 'Menus and panels' ? lookAndFeel() : ''}
              ${g === 'Hex symbols' ? `<label class="check"><input type="checkbox" data-over ${theme.symbolsOverArt ? 'checked' : ''}> Show symbols over hex art and the map picture too</label>` : ''}
              ${SLOTS.filter((s) => s.group === g).map((s) => slotRow(s.id, s.label, s.hint)).join('')}
            </section>`,
          )
          .join('')}
      </div>
      <div class="side">
        <h3>Preview</h3>
        ${preview()}
        ${uiPreview()}
        <p class="note">Best sizes, in pixels: hex art 448 × 512 (the hex's shape), the map background and fight backdrops 1600 × 896, symbols, markers and tokens 256 × 256. Bigger pictures are shrunk to these as they come in, so the board stays quick on the phone. This theme: about ${total} KB.</p>
        <p class="note">Use your own pictures (drawn, photographed or generated), not scans of the published game.</p>
        <p class="note">Each faction's crest, units and structures are set in the faction editor (Workshop → Faction editor); they're kept in this theme too, and go with it in the theme file.</p>
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
    case 'guide':
    case 'guide-rivers': {
      const rivers = btn.dataset.act === 'guide-rivers';
      await exportPicture(rivers ? 'scythe-map-guide-rivers.png' : 'scythe-map-guide.png', await mapGuide(MAP, rivers));
      break;
    }
    case 'ui-color-reset': {
      const uiColors = { ...theme.uiColors };
      delete uiColors[btn.dataset.ui as UiColor];
      await keep({ ...theme, uiColors });
      break;
    }
    case 'reset':
      if (await ask('Go back to the usual look? Every picture and colour in this theme, the factions\' pictures too, is removed from the device (save it to a file first to keep it).')) {
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
  } else if (el.dataset.uiColor) {
    await keep({ ...theme, uiColors: { ...theme.uiColors, [el.dataset.uiColor]: el.value } });
  } else if (el.dataset.font) {
    await keep({ ...theme, [el.dataset.font]: el.value as FontId });
  } else if (el.dataset.color) {
    await keep(setColor(theme, el.dataset.color as Terrain, el.value));
  } else if (el.dataset.painted !== undefined) {
    await keep({ ...theme, paintedMap: el.checked });
  } else if (el.dataset.edges !== undefined) {
    await keep({ ...theme, hexEdges: el.checked });
  } else if (el.dataset.over !== undefined) {
    await keep({ ...theme, symbolsOverArt: el.checked });
  } else if (el.dataset.name !== undefined) {
    await keep({ ...theme, name: el.value.trim() || DEFAULT_THEME.name });
  }
});

render();
store.activeSkin().then(
  (s) => {
    theme = s.theme;
    skinName = s.name;
    render();
  },
  () => show("The theme on this device couldn't be read.", true),
);
