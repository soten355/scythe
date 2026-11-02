// Objective card editor: enter the objective deck card by card (each card's
// conditions, all of which must hold), then add it to the game or save it to
// a file. Plain DOM, no framework; shares its look with the other card
// editors.
import { OBJECTIVE_PROGRESS, OBJECTIVE_STATS, OBJECTIVE_UNITS, RESOURCES, type ObjectiveCard, type ObjectiveCheck, type Resource } from '@scythe/engine';
import '../shared/forms.css';
import '../faction-editor/faction-editor.css';
import '../encounter-editor/encounter-editor.css';
import './objective-editor.css';
import { EMPTY_LIBRARY } from '../content/library';
import { addToGame, ask, esc, setPath, showExport, tell } from '../shared/editor-utils';
import { exportContent } from '../saves/files';
import { objectiveText } from '../play/objective-text';
import { addCheck, cleanCard, deckProblems, editable, formatCards, newCard, nextId, removeCheck, setKind, toggleResource, type CheckKind } from './model';

const STORAGE_KEY = 'scythe-objective-editor';

const KINDS: [CheckKind, string][] = [
  ['stat', 'Power, popularity, coins or combat cards'],
  ['resources', 'Resources you control (in all)'],
  ['eachResource', 'Each of some kinds of resource'],
  ['units', 'Units (on a terrain)'],
  ['territories', 'Territories you control'],
  ['progress', 'Upgrades, mechs, structures, recruits or workers'],
];
const STAT_NAMES: Record<string, string> = { power: 'Power', popularity: 'Popularity', coins: 'Coins', combatCards: 'Combat cards' };
const UNIT_NAMES: Record<string, string> = { character: 'Character', mech: 'Mechs', worker: 'Workers', any: 'Any units' };
const PROGRESS_NAMES: Record<string, string> = { upgrades: 'Upgrades made', mechs: 'Mechs deployed', structures: 'Structures built', recruits: 'Recruits enlisted', workers: 'Workers' };
const TERRAINS = ['farm', 'forest', 'mountain', 'tundra', 'village', 'lake', 'factory'];

interface EditorState {
  cards: ObjectiveCard[];
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
  return { cards: [newCard('objective-1')], selected: 0 };
}

let state = load();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const card = () => state.cards[state.selected]!;
const update = (next: ObjectiveCard) => {
  state = { ...state, cards: state.cards.map((c, i) => (i === state.selected ? next : c)) };
  save();
};

// ---- rendering ---------------------------------------------------------------

const root = document.querySelector<HTMLDivElement>('#objective-editor')!;

const title = (s: string) => s[0]!.toUpperCase() + s.slice(1);
/** A number box; blank means none. */
const num = (path: string, value: number | null | undefined, label: string) =>
  `<label class="amount">${label}<input type="number" inputmode="numeric" min="0" step="1" data-path="${path}" value="${typeof value === 'number' && Number.isFinite(value) ? value : ''}"></label>`;
const text = (path: string, value: string) => `<input type="text" data-path="${path}" data-text value="${esc(value)}">`;
/** A drop-down; `blank` adds a first choice meaning none. */
const select = (path: string, value: string | undefined, choices: [string, string][], label: string, blank?: string) =>
  `<label>${label}<select data-path="${path}" data-text>${blank !== undefined ? `<option value="">${blank}</option>` : ''}${choices
    .map(([v, name]) => `<option value="${v}" ${v === (value ?? '') ? 'selected' : ''}>${name}</option>`)
    .join('')}</select></label>`;
const named = (values: string[], names: Record<string, string>): [string, string][] => values.map((v) => [v, names[v] ?? title(v)]);

function checkFields(c: ObjectiveCheck, i: number): string {
  const p = `checks.${i}`;
  const resources = (kinds: Resource[] = []) =>
    `<div class="actions">${RESOURCES.map((r) => `<label class="check"><input type="checkbox" data-check="${i}" data-resource="${r}" ${kinds.includes(r) ? 'checked' : ''}> ${title(r)}</label>`).join('')}</div>`;
  const terrain = (value?: string) => select(`${p}.terrain`, value, named(TERRAINS, {}), 'On', 'Any terrain');
  const bounds = (b: { atLeast?: number; atMost?: number }) => `${num(`${p}.atLeast`, b.atLeast, 'At least')}${num(`${p}.atMost`, b.atMost, 'At most')}`;
  switch (c.kind) {
    case 'stat':
      return select(`${p}.stat`, c.stat, named(OBJECTIVE_STATS, STAT_NAMES), 'What') + bounds(c);
    case 'resources':
      return `${resources(c.resources)}<span class="hint">(none ticked: any kind)</span>${bounds(c)}`;
    case 'eachResource':
      return resources(c.resources) + num(`${p}.atLeast`, c.atLeast, 'At least, of each');
    case 'units':
      return select(`${p}.unit`, c.unit, named(OBJECTIVE_UNITS, UNIT_NAMES), 'Which') + terrain(c.terrain) + bounds(c);
    case 'territories':
      return select(`${p}.terrain`, c.terrain, named(TERRAINS, {}), 'Of terrain', 'Any (the Factory counts 3)') + bounds(c);
    case 'progress':
      return select(`${p}.what`, c.what, named(OBJECTIVE_PROGRESS, PROGRESS_NAMES), 'What') + bounds(c);
  }
}

function checkRow(c: ObjectiveCheck, i: number): string {
  return `
    <div class="card check-row">
      ${select(`kind-${i}`, c.kind, KINDS, `Condition ${i + 1}`).replace('data-path', 'data-kind').replace(' data-text', '')}
      ${checkFields(c, i)}
      ${card().checks.length > 1 ? `<button class="remove" data-act="remove" data-index="${i}">Remove</button>` : ''}
    </div>`;
}

/** How the game will word the card. */
function preview(): string {
  const c = cleanCard(card());
  try {
    return objectiveText(c);
  } catch {
    return '…';
  }
}

function render() {
  const c = card();
  root.innerHTML = `
    <header>
      <a class="back" href="${import.meta.env.BASE_URL}">← Back to app</a>
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
    <div class="story">
      <label>Story<textarea data-path="story" data-text rows="2" placeholder="What the card asks for, in your own words">${esc(c.story ?? '')}</textarea></label>
    </div>
    <div class="flags">
      <label class="check"><input type="checkbox" data-flag="endOfTurn" ${c.endOfTurn ? 'checked' : ''}> Only at the end of your turn</label>
    </div>
    <div class="checks">
      ${c.checks.map(checkRow).join('')}
      <div><button data-act="add-check">+ Add condition</button> <span class="hint">All conditions must hold at once.</span></div>
      <p class="preview" data-preview>${esc(preview())}</p>
    </div>
    <p class="note">Enter each card's conditions as printed, but write its name and story in your own words. Leave a box blank for none; "at most 0" means none at all.</p>
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
  const p = root.querySelector<HTMLElement>('[data-preview]');
  if (p) p.textContent = preview();
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
  } else if (el instanceof HTMLSelectElement && el.dataset.kind) {
    // A different kind of condition: its own boxes.
    update(setKind(card(), Number(el.dataset.kind.replace('kind-', '')), el.value as CheckKind));
    render();
  } else if (el.dataset.resource) {
    update(toggleResource(card(), Number(el.dataset.check), el.dataset.resource as Resource, el.checked));
    renderStatus();
  } else if (el.dataset.flag === 'endOfTurn') {
    update({ ...card(), endOfTurn: el.checked });
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
      if (state.cards.length === 0) state.cards.push(newCard('objective-1'));
      state = { cards: state.cards, selected: Math.min(state.selected, state.cards.length - 1) };
      break;
    case 'add-check':
      update(addCheck(card()));
      break;
    case 'remove':
      update(removeCheck(card(), Number(btn.dataset.index)));
      break;
    case 'add':
    case 'file': {
      // The whole deck: new games deal from it.
      const problems = deckProblems(state.cards);
      if (problems.length) return tell(`Fix this first: ${problems.join('; ')}.`);
      const content = { ...EMPTY_LIBRARY, objectives: state.cards.map(cleanCard) };
      if (btn!.dataset.act === 'file') return exportContent(content);
      // The deck as it is now replaces any added before (cards deleted here leave the game too).
      return addToGame(content, (added) => `Added ${added.length} objective card${added.length === 1 ? '' : 's'}. New games now deal objectives from your deck.`, 'objectives');
    }
    case 'export':
      showExport('Export objective cards', `All ${state.cards.length} card(s). Copy this text and paste it into the chat with Claude.`, formatCards(state.cards));
      return;
    default:
      return;
  }
  save();
  render();
});

render();
