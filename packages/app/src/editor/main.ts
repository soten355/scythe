// Map editor: paint terrain, markers, rivers and home bases onto a hex grid,
// then export the layout text for packages/content. Plain DOM + SVG, no
// framework (the UI framework hasn't been chosen yet).
import { baseBoardLayout } from '@scythe/content';
import { buildBoard } from '@scythe/engine';
import './editor.css';
import {
  addCol,
  addRow,
  edgeKey,
  formatLayout,
  fromLayout,
  HOME_IDS,
  key,
  labelOf,
  slotPosition,
  slotsTouch,
  toggleHome,
  toggleRiver,
  toLayout,
  type EditorMap,
  type SlotKey,
  type TerrainCode,
} from './model';

const STORAGE_KEY = 'scythe-map-editor';
const S = 40; // hex radius in SVG units
const W = Math.sqrt(3) * S; // hex width

const TERRAINS: [TerrainCode, string, string][] = [
  ['Fa', 'Farm', '#e8d36a'],
  ['Fo', 'Forest', '#4f8a4a'],
  ['Mo', 'Mountain', '#9a8f86'],
  ['Tu', 'Tundra', '#b9d3c9'],
  ['Vi', 'Village', '#d58a5a'],
  ['~~', 'Lake', '#6fa8dc'],
  ['FF', 'Factory', '#7a4e8a'],
];
const FILL = Object.fromEntries(TERRAINS.map(([code, , color]) => [code, color]));

type Tool =
  | { kind: 'terrain'; code: TerrainCode }
  | { kind: 'erase' }
  | { kind: 'tunnel' }
  | { kind: 'encounter' }
  | { kind: 'river' }
  | { kind: 'home'; id: string };

// ---- state -----------------------------------------------------------------

function startingMap(): EditorMap {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved) as EditorMap;
    } catch {
      // Fall through to the draft if the saved copy is unreadable.
    }
  }
  return draftMap();
}

function draftMap(): EditorMap {
  // Pad the draft with a spare row and column on every side.
  let map = fromLayout(baseBoardLayout);
  map = addRow(addRow(map, 'top'), 'bottom');
  return addCol(addCol(map, 'left'), 'right');
}

let map = startingMap();
let tool: Tool = { kind: 'terrain', code: 'Fa' };
const history: EditorMap[] = [];

function commit(next: EditorMap) {
  history.push(map);
  if (history.length > 200) history.shift();
  map = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  render();
}

function undo() {
  const prev = history.pop();
  if (!prev) return;
  map = prev;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  render();
}

// ---- actions on a slot -----------------------------------------------------

function applyToSlot(m: EditorMap, k: SlotKey): EditorMap {
  const cell = m.cells[k];
  switch (tool.kind) {
    case 'terrain':
      return { ...m, cells: { ...m.cells, [k]: { tunnel: false, encounter: false, ...cell, code: tool.code } } };
    case 'erase': {
      if (!cell) return m;
      const { [k]: _gone, ...cells } = m.cells;
      return {
        ...m,
        cells,
        rivers: m.rivers.filter((e) => !e.split('|').includes(k)),
        homes: Object.fromEntries(Object.entries(m.homes).map(([id, ks]) => [id, ks.filter((x) => x !== k)])),
      };
    }
    case 'tunnel':
      return cell ? { ...m, cells: { ...m.cells, [k]: { ...cell, tunnel: !cell.tunnel } } } : m;
    case 'encounter':
      return cell ? { ...m, cells: { ...m.cells, [k]: { ...cell, encounter: !cell.encounter } } } : m;
    case 'home':
      return cell ? toggleHome(m, tool.id, k) : m;
    case 'river':
      return m;
  }
}

// Terrain and erase can be dragged across many hexes; toggles act once per tap.
const isPaintTool = () => tool.kind === 'terrain' || tool.kind === 'erase';

// ---- rendering ---------------------------------------------------------------

const root = document.querySelector<HTMLDivElement>('#editor')!;
root.innerHTML = `
  <aside class="tools"></aside>
  <div class="hint"></div>
  <div class="board"></div>
  <dialog>
    <h3 style="margin-top:0">Export map</h3>
    <div class="check"></div>
    <p style="font-size:0.85rem;opacity:0.8">Copy this text and paste it into the chat with Claude.</p>
    <textarea readonly></textarea>
    <div class="row"><button data-act="copy">Copy</button><button data-act="close">Close</button></div>
  </dialog>
`;
const toolsEl = root.querySelector<HTMLElement>('.tools')!;
const hintEl = root.querySelector<HTMLElement>('.hint')!;
const boardEl = root.querySelector<HTMLElement>('.board')!;
const dialog = root.querySelector('dialog')!;

function sameTool(a: Tool, b: Tool) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function toolButton(t: Tool, label: string, swatch?: string) {
  const sel = sameTool(t, tool) ? ' selected' : '';
  const sw = swatch ? `<span class="swatch" style="background:${swatch}"></span>` : '';
  return `<button class="${sel}" data-tool='${JSON.stringify(t)}'>${sw}${label}</button>`;
}

function renderTools() {
  toolsEl.innerHTML = `
    <section><h2>Terrain (tap or drag)</h2><div class="group">
      ${TERRAINS.map(([code, name, color]) => toolButton({ kind: 'terrain', code }, name, color)).join('')}
      ${toolButton({ kind: 'erase' }, 'No hex')}
    </div></section>
    <section><h2>Markers (tap to toggle)</h2><div class="group">
      ${toolButton({ kind: 'tunnel' }, 'Tunnel')}
      ${toolButton({ kind: 'encounter' }, '★ Encounter')}
      ${toolButton({ kind: 'river' }, 'River')}
    </div></section>
    <section><h2>Home bases (tap hexes they touch)</h2><div class="group homes">
      ${HOME_IDS.map((id) => toolButton({ kind: 'home', id }, id.toUpperCase())).join('')}
    </div></section>
    <section><h2>Grid</h2><div class="group">
      <button data-act="row-top">+ Row top</button>
      <button data-act="row-bottom">+ Row bottom</button>
      <button data-act="col-left">+ Col left</button>
      <button data-act="col-right">+ Col right</button>
    </div></section>
    <section><h2>Map</h2><div class="group">
      <button data-act="undo">Undo</button>
      <button data-act="export">Export…</button>
      <button data-act="reset">Reset to draft</button>
      <button data-act="clear">Clear all</button>
    </div></section>
  `;
}

const HINTS: Record<Tool['kind'], string> = {
  terrain: 'Tap a hex to paint it. Drag to paint several.',
  erase: 'Tap a hex to remove it from the board. Drag to remove several.',
  tunnel: 'Tap a hex to add or remove a tunnel.',
  encounter: 'Tap a hex to add or remove an encounter token.',
  river: 'Tap the edge between two hexes to add or remove a river.',
  home: 'Tap the hexes this home base touches (highlighted in red). Tap again to remove.',
};

function hexPoints(cx: number, cy: number, r = S) {
  return [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 180) * (60 * i - 30);
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(' ');
}

function center(k: SlotKey): [number, number] {
  const [x, y] = slotPosition(map, k);
  return [x * W, y * 1.5 * S];
}

/** The two corners of the edge shared by two touching slots. */
function sharedEdge(a: SlotKey, b: SlotKey): [number, number, number, number] {
  const [ax, ay] = center(a);
  const [bx, by] = center(b);
  // The edge is perpendicular to the line between centers, at its midpoint.
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const len = Math.hypot(bx - ax, by - ay);
  const ux = -(by - ay) / len;
  const uy = (bx - ax) / len;
  const half = S / 2;
  return [mx + ux * half, my + uy * half, mx - ux * half, my - uy * half];
}

function homesOf(k: SlotKey) {
  return HOME_IDS.filter((id) => map.homes[id]?.includes(k)).map((id) => id.toUpperCase());
}

function renderBoard() {
  const parts: string[] = [];
  const slots: SlotKey[] = [];
  for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) slots.push(key(r, c));
  const selectedHome = tool.kind === 'home' ? (map.homes[tool.id] ?? []) : [];

  for (const k of slots) {
    const [cx, cy] = center(k);
    const cell = map.cells[k];
    if (!cell) {
      parts.push(
        `<polygon data-slot="${k}" points="${hexPoints(cx, cy)}" fill="#ffffff08" stroke="#ffffff30" stroke-dasharray="4 4"/>`,
      );
      continue;
    }
    const outline = selectedHome.includes(k) ? 'stroke="#ff3b30" stroke-width="5"' : 'stroke="#222" stroke-width="1.5"';
    parts.push(`<polygon data-slot="${k}" points="${hexPoints(cx, cy)}" fill="${FILL[cell.code]}" ${outline}/>`);
    parts.push(`<text x="${cx}" y="${cy - 12}" class="lbl">${labelOf(map, k)}</text>`);
    const marks = [cell.tunnel && 'TUNNEL', cell.encounter && '★'].filter(Boolean).join(' ');
    if (marks) parts.push(`<text x="${cx}" y="${cy + 6}" class="mark">${marks}</text>`);
    const homes = homesOf(k);
    if (homes.length) parts.push(`<text x="${cx}" y="${cy + 23}" class="home">⌂ ${homes.join(' ')}</text>`);
  }

  for (const edge of map.rivers) {
    const [a = '', b = ''] = edge.split('|');
    const [x1, y1, x2, y2] = sharedEdge(a, b);
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1450c8" stroke-width="7" stroke-linecap="round" pointer-events="none"/>`);
  }

  if (tool.kind === 'river') {
    // Every edge between two hexes gets a wide invisible tap target.
    const filled = slots.filter((k) => map.cells[k]);
    for (let i = 0; i < filled.length; i++) {
      for (let j = i + 1; j < filled.length; j++) {
        const a = filled[i]!;
        const b = filled[j]!;
        if (!slotsTouch(map, a, b)) continue;
        const [x1, y1, x2, y2] = sharedEdge(a, b);
        parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffffff70" stroke-width="2" stroke-dasharray="3 4" pointer-events="none"/>`);
        parts.push(`<line data-edge="${edgeKey(a, b)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="16"/>`);
      }
    }
  }

  const minX = -W;
  const minY = -1.5 * S;
  const width = (map.cols + 1.5) * W;
  const height = (map.rows + 0.5) * 1.5 * S + S;
  boardEl.innerHTML = `
    <svg viewBox="${minX} ${minY} ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <style>
        text { font-family: system-ui, sans-serif; text-anchor: middle; pointer-events: none; fill: #111; }
        .lbl { font-size: 13px; font-weight: 700; }
        .mark { font-size: 10px; font-weight: 800; }
        .home { font-size: 10px; font-weight: 800; fill: #8b0000; }
      </style>
      ${parts.join('\n')}
    </svg>`;
}

function render() {
  renderTools();
  renderBoard();
  hintEl.textContent = HINTS[tool.kind];
}

// ---- input -------------------------------------------------------------------

toolsEl.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  if (!btn) return;
  if (btn.dataset.tool) {
    tool = JSON.parse(btn.dataset.tool) as Tool;
    render();
    return;
  }
  switch (btn.dataset.act) {
    case 'row-top': return commit(addRow(map, 'top'));
    case 'row-bottom': return commit(addRow(map, 'bottom'));
    case 'col-left': return commit(addCol(map, 'left'));
    case 'col-right': return commit(addCol(map, 'right'));
    case 'undo': return undo();
    case 'export': return openExport();
    case 'reset':
      if (confirm('Replace your edits with the original draft map?')) commit(draftMap());
      return;
    case 'clear':
      if (confirm('Remove every hex, river and home base?')) {
        commit({ ...map, cells: {}, rivers: [], homes: Object.fromEntries(HOME_IDS.map((id) => [id, []])) });
      }
      return;
  }
});

// Pointer handling: paint tools follow the finger/mouse while pressed; other
// tools act once on press.
let painting = false;
let lastSlot: SlotKey | null = null;

function slotAt(x: number, y: number): SlotKey | null {
  const el = document.elementFromPoint(x, y);
  return el instanceof SVGElement ? (el.dataset.slot ?? null) : null;
}

boardEl.addEventListener('pointerdown', (e) => {
  const target = e.target as SVGElement;
  if (target.dataset.edge) {
    const [a = '', b = ''] = target.dataset.edge.split('|');
    commit(toggleRiver(map, a, b));
    return;
  }
  const k = target.dataset.slot;
  if (!k) return;
  const next = applyToSlot(map, k);
  if (next !== map) commit(next);
  if (isPaintTool()) {
    painting = true;
    lastSlot = k;
  }
});

window.addEventListener('pointermove', (e) => {
  if (!painting) return;
  const k = slotAt(e.clientX, e.clientY);
  if (!k || k === lastSlot) return;
  lastSlot = k;
  // Dragging continues one stroke: change the map without a new undo step.
  map = applyToSlot(map, k);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  renderBoard();
});

window.addEventListener('pointerup', () => {
  painting = false;
  lastSlot = null;
});

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  }
});

// ---- export ------------------------------------------------------------------

function openExport() {
  const layout = toLayout(map);
  const text = formatLayout(layout);
  const check = dialog.querySelector<HTMLElement>('.check')!;
  try {
    const board = buildBoard(layout);
    const hexes = Object.values(board.hexes);
    const homes = Object.entries(board.homeBases).map(([id, h]) => `${id.toUpperCase()} ${h.length}`);
    check.className = 'check';
    check.textContent =
      `✓ ${hexes.length} hexes · ${hexes.filter((h) => h.tunnel).length} tunnels · ` +
      `${hexes.filter((h) => h.encounter).length} encounters · ${board.rivers.length} rivers · ` +
      `home bases: ${homes.join(', ') || 'none'}`;
  } catch (err) {
    check.className = 'check bad';
    check.textContent = `Problem: ${(err as Error).message}`;
  }
  dialog.querySelector('textarea')!.value = text;
  dialog.querySelector<HTMLElement>('[data-act="copy"]')!.textContent = 'Copy';
  dialog.showModal();
}

dialog.addEventListener('click', async (e) => {
  const act = (e.target as HTMLElement).closest('button')?.dataset.act;
  if (act === 'close') dialog.close();
  if (act === 'copy') {
    const area = dialog.querySelector('textarea')!;
    try {
      await navigator.clipboard.writeText(area.value);
    } catch {
      area.select();
      document.execCommand('copy');
    }
    (e.target as HTMLElement).textContent = 'Copied ✓';
  }
});

render();
