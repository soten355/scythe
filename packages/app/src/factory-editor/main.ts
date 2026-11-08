// Factory card editor: enter the Factory deck card by card (each card's top
// part, pay this to gain that, and its bottom part, a move), then add it to
// the game or save it to a file. Plain DOM, no framework; shares its look
// with the encounter card editor.
import '../shared/fill-screen';
import { RESOURCES, type BottomActionType, type FactoryCard } from '@scythe/engine';
import '../shared/forms.css';
import '../faction-editor/faction-editor.css';
import '../encounter-editor/encounter-editor.css';
import './factory-editor.css';
import { EMPTY_LIBRARY } from '../content/library';
import { addToGame, ask, esc, setPath, showExport, tell } from '../shared/editor-utils';
import { exportContent } from '../saves/files';
import { costText, gainText, moveText } from '../play/prompt';
import { cleanCard, deckProblems, editable, formatCards, newCard, nextId, toggleAction } from './model';

const STORAGE_KEY = 'scythe-factory-editor';
const ACTIONS: [BottomActionType, string][] = [
  ['upgrade', 'Upgrade'],
  ['deploy', 'Deploy'],
  ['build', 'Build'],
  ['enlist', 'Enlist'],
];

interface EditorState {
  cards: FactoryCard[];
  selected: number;
}

function load(): EditorState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state = JSON.parse(saved) as EditorState;
      if (state.cards.length) return { cards: state.cards.map(editable), selected: Math.min(state.selected, state.cards.length - 1) };
    }
  } catch {
    // Fall through to a fresh start if the saved copy is unreadable.
  }
  return { cards: [newCard('factory-1')], selected: 0 };
}

let state = load();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const card = () => state.cards[state.selected]!;
const update = (next: FactoryCard) => {
  state = { ...state, cards: state.cards.map((c, i) => (i === state.selected ? next : c)) };
  save();
};

// ---- rendering ---------------------------------------------------------------

const root = document.querySelector<HTMLDivElement>('#factory-editor')!;

/** A number box; blank means none. */
const num = (path: string, value: number | null | undefined, label: string, min = 0) =>
  `<label class="amount">${label}<input type="number" inputmode="numeric" min="${min}" step="1" data-path="${path}" value="${typeof value === 'number' && Number.isFinite(value) ? value : ''}"></label>`;
const text = (path: string, value: string) => `<input type="text" data-path="${path}" data-text value="${esc(value)}">`;
const title = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** How the game will show each part. */
function preview(part: 'top' | 'move'): string {
  const c = cleanCard(card());
  if (part === 'move') return Number.isInteger(c.move.units) && Number.isInteger(c.move.hexes) ? title(moveText(c)) : 'How many units, and how far?';
  return `${costText(c.cost)} → ${gainText(c.gain, '')}`;
}

function render() {
  const c = card();
  const res = c.cost.resources ?? {};
  root.innerHTML = `
    <header>
      <a class="back" href="${import.meta.env.BASE_URL}#workshop">← Workshop</a>
      <select data-act="pick">${state.cards.map((x, i) => `<option value="${i}" ${i === state.selected ? 'selected' : ''}>${i + 1}. ${esc(x.name || x.id)}</option>`).join('')}</select>
      <button data-act="new">New card</button>
      <button data-act="duplicate">Duplicate</button>
      <button data-act="delete">Delete</button>
      <span class="spacer"></span>
      <button data-act="add" title="New games use this deck in place of the sample one">Add deck to game</button>
      <button data-act="file">Save deck to a file</button>
      <button data-act="export" class="primary">Export…</button>
    </header>
    <div class="details">
      <label>Name${text('name', c.name)}</label>
      <label>ID${text('id', c.id)}</label>
    </div>
    <div class="factory-grid">
      <div class="card">
        <h3>Top: pay this…</h3>
        <div class="amounts">
          ${num('cost.coins', c.cost.coins, 'Coins')}
          ${num('cost.popularity', c.cost.popularity, 'Popularity')}
          ${num('cost.power', c.cost.power, 'Power')}
          ${num('cost.combatCards', c.cost.combatCards, 'Combat cards')}
        </div>
        <p class="part">Resources (from hexes you control)</p>
        <div class="amounts">${RESOURCES.map((r) => num(`cost.resources.${r}`, res[r], title(r))).join('')}</div>
        <p class="part">…to gain this</p>
        <div class="amounts">
          ${num('gain.coins', c.gain.coins, 'Coins')}
          ${num('gain.power', c.gain.power, 'Power')}
          ${num('gain.popularity', c.gain.popularity, 'Popularity')}
          ${num('gain.combatCards', c.gain.combatCards, 'Combat cards')}
          ${num('gain.produce', c.gain.produce, 'Produce on hexes (with your workers)')}
          ${num('gain.anyResources', c.gain.anyResources, 'Resources of your choice (on one hex)')}
        </div>
        <p class="part">Free actions</p>
        <div class="actions">
          ${ACTIONS.map(([a, name]) => `<label class="check"><input type="checkbox" data-action="${a}" ${c.gain.actions?.includes(a) ? 'checked' : ''}> ${name}</label>`).join('')}
        </div>
        <label class="check"><input type="checkbox" data-flag="oneOf" ${c.gain.oneOf ? 'checked' : ''}> Gain only one of these (the player chooses)</label>
        <p class="preview" data-preview="top">${esc(preview('top'))}</p>
      </div>
      <div class="card">
        <h3>Bottom: move</h3>
        <div class="amounts">
          ${num('move.units', c.move.units, 'Units', 1)}
          ${num('move.hexes', c.move.hexes, 'Hexes each', 1)}
        </div>
        <p class="preview" data-preview="move">${esc(preview('move'))}</p>
      </div>
    </div>
    <p class="note">Enter each card's effects as printed, but give it a name in your own words. Leave a box blank for none.</p>
    <div class="status"></div>`;
  renderStatus();
}

function renderStatus() {
  const el = root.querySelector<HTMLElement>('.status')!;
  const problems = deckProblems(state.cards);
  const n = state.cards.length;
  el.className = problems.length ? 'status bad' : 'status';
  el.textContent = problems.length
    ? `Problems: ${problems.slice(0, 4).join('; ')}${problems.length > 4 ? `; and ${problems.length - 4} more` : ''}.`
    : `✓ All ${n} card${n === 1 ? '' : 's'} ready.`;
  for (const p of root.querySelectorAll<HTMLElement>('[data-preview]')) p.textContent = preview(p.dataset.preview as 'top' | 'move');
}

// ---- input -------------------------------------------------------------------

root.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const path = el.dataset.path;
  if (!path) return;
  const value = 'text' in el.dataset ? el.value : el.value === '' ? null : Number(el.value);
  update(setPath(card(), path, value));
  renderStatus();
  // The card picker's label follows the name as it's typed (without redrawing the page, which would lose your place).
  if (path === 'name' || path === 'id') {
    const option = root.querySelector<HTMLSelectElement>('[data-act="pick"]')?.options[state.selected];
    if (option) option.textContent = `${state.selected + 1}. ${card().name || card().id}`;
  }
});

root.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement;
  if (el instanceof HTMLSelectElement && el.dataset.act === 'pick') {
    state = { ...state, selected: Number(el.value) };
    save();
    render();
  } else if (el.dataset.action) {
    update(toggleAction(card(), el.dataset.action as BottomActionType, el.checked));
    renderStatus();
  } else if (el.dataset.flag === 'oneOf') {
    update(setPath(card(), 'gain.oneOf', el.checked));
    renderStatus();
  }
});

root.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  switch (btn?.dataset.act) {
    case 'new':
      state = { cards: [...state.cards, newCard(nextId(state.cards))], selected: state.cards.length };
      break;
    case 'duplicate': {
      const copy = { ...editable(card()), id: nextId(state.cards), name: `${card().name} (copy)` };
      state = { cards: [...state.cards, copy], selected: state.cards.length };
      break;
    }
    case 'delete':
      if (!(await ask(`Delete "${card().name}"?`))) return;
      state.cards.splice(state.selected, 1);
      if (state.cards.length === 0) state.cards.push(newCard('factory-1'));
      state = { cards: state.cards, selected: Math.min(state.selected, state.cards.length - 1) };
      break;
    case 'add':
    case 'file': {
      // The whole deck: new games draw from it.
      const problems = deckProblems(state.cards);
      if (problems.length) return tell(`Fix this first: ${problems.join('; ')}.`);
      const content = { ...EMPTY_LIBRARY, factory: state.cards.map(cleanCard) };
      if (btn!.dataset.act === 'file') return exportContent(content);
      // The deck as it is now replaces any added before (cards deleted here leave the game too).
      return addToGame(content, (added) => `Added ${added.length} Factory card${added.length === 1 ? '' : 's'}. New games now use your Factory deck.`, 'factory');
    }
    case 'export':
      showExport('Export Factory cards', `All ${state.cards.length} card(s). Copy this text and paste it into the chat with Claude.`, formatCards(state.cards));
      return;
    default:
      return;
  }
  save();
  render();
});

render();
