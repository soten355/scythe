// Structure bonus tile editor: enter the tiles one by one (what each counts
// about your structures, and the coins for each step), then add them to the
// game or save them to a file. Plain DOM, no framework; shares its look with
// the card editors.
import { STRUCTURE_FEATURES, type StructureCount, type Terrain } from '@scythe/engine';
import '../shared/forms.css';
import '../faction-editor/faction-editor.css';
import '../encounter-editor/encounter-editor.css';
import '../objective-editor/objective-editor.css';
import { EMPTY_LIBRARY } from '../content/library';
import { addToGame, ask, esc, setPath, showExport, tell } from '../shared/editor-utils';
import { exportContent } from '../saves/files';
import { countText, paysText } from '../play/structure-bonus-text';
import { addStep, cleanTile, editable, formatTiles, newTile, nextId, removeStep, setCountKind, tileProblems, toggleTerrain, type EditedTile } from './model';

const STORAGE_KEY = 'scythe-structure-bonus-editor';
const KINDS: [StructureCount['kind'], string][] = [
  ['adjacent', 'Spots next to your structures'],
  ['on', 'Your structures on…'],
  ['inRow', 'Your longest straight row of structures'],
];
const FEATURE_NAMES: Record<string, string> = { tunnel: 'Tunnels', lake: 'Lakes', encounter: 'Encounter spots' };
const TERRAINS: Terrain[] = ['farm', 'forest', 'mountain', 'tundra', 'village', 'lake', 'factory'];

interface EditorState {
  tiles: EditedTile[];
  selected: number;
}

function load(): EditorState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state = JSON.parse(saved) as EditorState;
      if (state.tiles.length) return { tiles: state.tiles.map(editable), selected: Math.min(state.selected, state.tiles.length - 1) };
    }
  } catch {
    // Fall through to a fresh start if the saved copy is unreadable.
  }
  return { tiles: [newTile('tile-1')], selected: 0 };
}

let state = load();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const tile = () => state.tiles[state.selected]!;
const update = (next: EditedTile) => {
  state = { ...state, tiles: state.tiles.map((t, i) => (i === state.selected ? next : t)) };
  save();
};

// ---- rendering ---------------------------------------------------------------

const root = document.querySelector<HTMLDivElement>('#structure-bonus-editor')!;

const title = (s: string) => s[0]!.toUpperCase() + s.slice(1);
/** A number box; blank means not filled in yet. */
const num = (path: string, value: number | null | undefined, label: string) =>
  `<label class="amount">${label}<input type="number" inputmode="numeric" min="0" step="1" data-path="${path}" value="${typeof value === 'number' && Number.isFinite(value) ? value : ''}"></label>`;
const text = (path: string, value: string) => `<input type="text" data-path="${path}" data-text value="${esc(value)}">`;

function countFields(t: EditedTile): string {
  const c = t.count;
  if (c.kind === 'adjacent') {
    return `<label>Which<select data-path="count.feature" data-text>${STRUCTURE_FEATURES.map((f) => `<option value="${f}" ${f === c.feature ? 'selected' : ''}>${FEATURE_NAMES[f]}</option>`).join('')}</select></label>`;
  }
  if (c.kind === 'on') {
    return `<div class="actions">
      <label class="check"><input type="checkbox" data-tunnel ${c.tunnel ? 'checked' : ''}> Tunnels</label>
      ${TERRAINS.map((x) => `<label class="check"><input type="checkbox" data-terrain="${x}" ${c.terrains?.includes(x) ? 'checked' : ''}> ${title(x)}</label>`).join('')}
    </div>`;
  }
  return '';
}

/** How the game will show the tile. */
function preview(): string {
  const t = cleanTile(tile());
  const ok = t.pays.every((s) => Number.isFinite(s.atLeast) && Number.isFinite(s.coins));
  const counts = t.count.kind !== 'on' || t.count.tunnel || t.count.terrains?.length;
  return `${counts ? countText(t.count) : 'Your structures on… (tick at least one)'} · ${ok ? paysText(t.pays) : 'fill in every payout'}`;
}

function render() {
  const t = tile();
  root.innerHTML = `
    <header>
      <a class="back" href="${import.meta.env.BASE_URL}#workshop">← Workshop</a>
      <select data-act="pick">${state.tiles.map((x, i) => `<option value="${i}" ${i === state.selected ? 'selected' : ''}>${i + 1}. ${esc(x.name || x.id)}</option>`).join('')}</select>
      <button data-act="new">New tile</button>
      <button data-act="duplicate">Duplicate</button>
      <button data-act="delete">Delete</button>
      <span class="spacer"></span>
      <button data-act="add" title="New games draw from these tiles in place of the sample ones">Add tiles to game</button>
      <button data-act="file">Save tiles to a file</button>
      <button data-act="export" class="primary">Export…</button>
    </header>
    <div class="details">
      <label>Name${text('name', t.name)}</label>
      <label>ID${text('id', t.id)}</label>
    </div>
    <div class="checks">
      <div class="card check-row">
        <label>Counts<select data-kind>${KINDS.map(([k, name]) => `<option value="${k}" ${k === t.count.kind ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
        ${countFields(t)}
      </div>
      ${t.pays
        .map(
          (s, i) => `<div class="card check-row">
            <label><b>Step ${i + 1}</b></label>
            ${num(`pays.${i}.atLeast`, s.atLeast, 'At least')}
            ${num(`pays.${i}.coins`, s.coins, 'Coins')}
            ${t.pays.length > 1 ? `<button class="remove" data-act="remove-step" data-index="${i}">Remove</button>` : ''}
          </div>`,
        )
        .join('')}
      <div><button data-act="add-step">+ Add step</button> <span class="hint">At the end of the game, the highest step reached pays.</span></div>
      <p class="preview" data-preview>${esc(preview())}</p>
    </div>
    <p class="note">Enter each tile's counting and payouts as printed, but give it a name in your own words.</p>
    <div class="status"></div>`;
  renderStatus();
}

function renderStatus() {
  const el = root.querySelector<HTMLElement>('.status')!;
  const problems = tileProblems(state.tiles);
  const n = state.tiles.length;
  el.className = problems.length ? 'status bad' : 'status';
  el.textContent = problems.length
    ? `Problems: ${problems.slice(0, 4).join('; ')}${problems.length > 4 ? `; and ${problems.length - 4} more` : ''}.`
    : `✓ All ${n} tile${n === 1 ? '' : 's'} ready.`;
  const p = root.querySelector<HTMLElement>('[data-preview]');
  if (p) p.textContent = preview();
}

// ---- input -------------------------------------------------------------------

root.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const path = el.dataset.path;
  if (!path) return;
  const value = 'text' in el.dataset ? el.value : el.value === '' ? null : Number(el.value);
  update(setPath(tile(), path, value));
  renderStatus();
  // The picker's label follows the name as it's typed (without redrawing the page, which would lose your place).
  if (path === 'name' || path === 'id') {
    const option = root.querySelector<HTMLSelectElement>('[data-act="pick"]')?.options[state.selected];
    if (option) option.textContent = `${state.selected + 1}. ${tile().name || tile().id}`;
  }
});

root.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement;
  if (el instanceof HTMLSelectElement && el.dataset.act === 'pick') {
    state = { ...state, selected: Number(el.value) };
    save();
    render();
  } else if (el instanceof HTMLSelectElement && 'kind' in el.dataset) {
    update(setCountKind(tile(), el.value as StructureCount['kind']));
    render();
  } else if (el.dataset.terrain) {
    update(toggleTerrain(tile(), el.dataset.terrain as Terrain, el.checked));
    renderStatus();
  } else if ('tunnel' in el.dataset) {
    update(setPath(tile(), 'count.tunnel', el.checked));
    renderStatus();
  }
});

root.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  switch (btn?.dataset.act) {
    case 'new':
      state = { tiles: [...state.tiles, newTile(nextId(state.tiles))], selected: state.tiles.length };
      break;
    case 'duplicate': {
      const copy = { ...editable(tile()), id: nextId(state.tiles), name: `${tile().name} (copy)` };
      state = { tiles: [...state.tiles, copy], selected: state.tiles.length };
      break;
    }
    case 'delete':
      if (!(await ask(`Delete "${tile().name}"?`))) return;
      state.tiles.splice(state.selected, 1);
      if (state.tiles.length === 0) state.tiles.push(newTile('tile-1'));
      state = { tiles: state.tiles, selected: Math.min(state.selected, state.tiles.length - 1) };
      break;
    case 'add-step':
      update(addStep(tile()));
      break;
    case 'remove-step':
      update(removeStep(tile(), Number(btn.dataset.index)));
      break;
    case 'add':
    case 'file': {
      // All the tiles: new games draw one from them.
      const problems = tileProblems(state.tiles);
      if (problems.length) return tell(`Fix this first: ${problems.join('; ')}.`);
      const content = { ...EMPTY_LIBRARY, structureBonuses: state.tiles.map(cleanTile) };
      if (btn!.dataset.act === 'file') return exportContent(content);
      // The tiles as they are now replace any added before (tiles deleted here leave the game too).
      return addToGame(content, (added) => `Added ${added.length} structure bonus tile${added.length === 1 ? '' : 's'}. New games now draw from your tiles.`, 'structureBonuses');
    }
    case 'export':
      showExport('Export structure bonus tiles', `All ${state.tiles.length} tile(s). Copy this text and paste it into the chat with Claude.`, formatTiles(state.tiles));
      return;
    default:
      return;
  }
  save();
  render();
});

render();
