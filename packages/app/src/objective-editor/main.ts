// Objective card editor: enter the objective deck card by card (each card's
// conditions, all of which must hold), then add it to the game or save it to
// a file. Plain DOM, no framework; shares its look with the other card
// editors.
import '../shared/fill-screen';
import { OBJECTIVE_EVENTS, OBJECTIVE_PROGRESS, OBJECTIVE_STATS, OBJECTIVE_TERRAINS, OBJECTIVE_UNITS, RESOURCES, type ObjectiveCard, type ObjectiveCheck, type Resource, type TerritoryCheck } from '@scythe/engine';
import '../shared/forms.css';
import '../faction-editor/faction-editor.css';
import '../encounter-editor/encounter-editor.css';
import './objective-editor.css';
import { EMPTY_LIBRARY } from '../content/library';
import { addToGame, ask, esc, setPath, showExport, tell } from '../shared/editor-utils';
import { exportContent } from '../saves/files';
import { objectiveText } from '../play/objective-text';
import { addCheck, addPart, cleanCard, deckProblems, editable, formatCards, newCard, nextId, removeCheck, removePart, setKind, setPartKind, toggleResource, type CheckKind, type PartKind } from './model';

const STORAGE_KEY = 'scythe-objective-editor';

const KINDS: [CheckKind, string][] = [
  ['stat', 'Power, popularity, coins or combat cards'],
  ['resources', 'Resources you control (in all)'],
  ['eachResource', 'Each of some kinds of resource'],
  ['units', 'Units (on a terrain)'],
  ['territories', 'Territories you control'],
  ['progress', 'Upgrades, mechs, structures, recruits, workers, Factory card or fights won'],
  ['around', 'Territories around one lake (or next to the Factory)'],
  ['oneTerritory', 'All on one territory you control'],
  ['same', 'Two counts the same (workers and recruits)'],
  ['highest', 'The most of something among all players'],
  ['thisTurn', 'Done this turn (enemy workers sent home)'],
];
const PART_KINDS: [PartKind, string][] = [
  ['units', 'Your units'],
  ['structures', 'Your structures'],
  ['tokens', 'Your tokens (units and structures)'],
  ['resources', 'Resources (in all)'],
  ['eachResource', 'Each of some kinds of resource'],
];
const EVENT_NAMES: Record<string, string> = { workersSentHome: 'Enemy workers sent home' };
const STAT_NAMES: Record<string, string> = { power: 'Power', popularity: 'Popularity', coins: 'Coins', combatCards: 'Combat cards' };
const UNIT_NAMES: Record<string, string> = { character: 'Character', mech: 'Mechs', worker: 'Workers', any: 'Any units' };
const PROGRESS_NAMES: Record<string, string> = {
  upgrades: 'Upgrades made',
  mechs: 'Mechs deployed',
  structures: 'Structures built',
  recruits: 'Recruits enlisted',
  workers: 'Workers',
  factoryCards: 'Factory cards (0 or 1)',
  fightsWon: 'Fights won',
};
const TERRAINS = OBJECTIVE_TERRAINS;

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

/** Resource tick boxes for condition `i` (or its part `part`). */
const resourceBoxes = (i: number, kinds: Resource[] = [], part?: number) =>
  `<div class="actions">${RESOURCES.map(
    (r) => `<label class="check"><input type="checkbox" data-check="${i}" ${part !== undefined ? `data-part="${part}"` : ''} data-resource="${r}" ${kinds.includes(r) ? 'checked' : ''}> ${title(r)}</label>`,
  ).join('')}</div>`;
/** A tick box for a yes-or-no setting of a condition. */
const tick = (path: string, on: boolean | undefined, label: string) => `<label class="check"><input type="checkbox" data-tick="${path}" ${on ? 'checked' : ''}> ${label}</label>`;

/** The boxes for one part of a one-territory condition. */
function partFields(c: TerritoryCheck, i: number, k: number, count: number): string {
  const p = `checks.${i}.checks.${k}`;
  const bounds = (b: { atLeast?: number; atMost?: number }) => `${num(`${p}.atLeast`, b.atLeast, 'At least')}${num(`${p}.atMost`, b.atMost, 'At most')}`;
  const kind = `<label>Part ${k + 1}<select data-part-kind="${i}.${k}">${PART_KINDS.map(([v, name]) => `<option value="${v}" ${v === c.kind ? 'selected' : ''}>${name}</option>`).join('')}</select></label>`;
  let fields = '';
  switch (c.kind) {
    case 'units':
      fields = select(`${p}.unit`, c.unit, named(OBJECTIVE_UNITS, UNIT_NAMES), 'Which') + bounds(c);
      break;
    case 'structures':
    case 'tokens':
      fields = bounds(c);
      break;
    case 'resources':
      fields = `${resourceBoxes(i, c.resources, k)}<span class="hint">(none ticked: any kind)</span>${bounds(c)}`;
      break;
    case 'eachResource':
      fields = resourceBoxes(i, c.resources, k) + num(`${p}.atLeast`, c.atLeast, 'At least, of each');
      break;
  }
  const remove = count > 1 ? `<button class="remove" data-act="remove-part" data-index="${i}" data-part="${k}">Remove part</button>` : '';
  return `<div class="part">${kind}${fields}${remove}</div>`;
}

function checkFields(c: ObjectiveCheck, i: number): string {
  const p = `checks.${i}`;
  const resources = (kinds: Resource[] = []) => resourceBoxes(i, kinds);
  const terrain = (value?: string) => select(`${p}.terrain`, value, named(TERRAINS, {}), 'On', 'Any terrain');
  const bounds = (b: { atLeast?: number; atMost?: number }) => `${num(`${p}.atLeast`, b.atLeast, 'At least')}${num(`${p}.atMost`, b.atMost, 'At most')}`;
  switch (c.kind) {
    case 'stat':
      return select(`${p}.stat`, c.stat, named(OBJECTIVE_STATS, STAT_NAMES), 'What') + bounds(c);
    case 'resources':
      return `${resources(c.resources)}<span class="hint">(none ticked: any kind)</span>${tick(`${p}.oneKind`, c.oneKind, 'The most of any one kind')}${bounds(c)}`;
    case 'eachResource':
      return resources(c.resources) + num(`${p}.atLeast`, c.atLeast, 'At least, of each');
    case 'units':
      return select(`${p}.unit`, c.unit, named(OBJECTIVE_UNITS, UNIT_NAMES), 'Which') + terrain(c.terrain) + bounds(c);
    case 'territories':
      return select(`${p}.terrain`, c.terrain, named(TERRAINS, {}), 'Of terrain', 'Any (the Factory counts 3)') + tick(`${p}.tunnel`, c.tunnel, 'Tunnels only') + bounds(c);
    case 'progress':
      return select(`${p}.what`, c.what, named(OBJECTIVE_PROGRESS, PROGRESS_NAMES), 'What') + bounds(c);
    case 'around':
      return select(`${p}.terrain`, c.terrain, named(TERRAINS, {}), 'Around one') + bounds(c);
    case 'oneTerritory':
      return `<div class="parts">${c.checks.map((part, k) => partFields(part, i, k, c.checks.length)).join('')}<div><button data-act="add-part" data-index="${i}">+ Add part</button> <span class="hint">All of these on the same territory.</span></div></div>`;
    case 'same':
      return select(`${p}.what.0`, c.what[0], named(OBJECTIVE_PROGRESS, PROGRESS_NAMES), 'As many') + select(`${p}.what.1`, c.what[1], named(OBJECTIVE_PROGRESS, PROGRESS_NAMES), 'As');
    case 'highest':
      return `${select(`${p}.stat`, c.stat, named(OBJECTIVE_STATS, STAT_NAMES), 'What')}<span class="hint">Ties count.</span>`;
    case 'thisTurn':
      return select(`${p}.what`, c.what, named(OBJECTIVE_EVENTS, EVENT_NAMES), 'What') + bounds(c);
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
      <a class="back" href="${import.meta.env.BASE_URL}#workshop">← Workshop</a>
      <select data-act="pick">${state.cards.map((x, i) => `<option value="${i}" ${i === state.selected ? 'selected' : ''}>${i + 1}. ${esc(x.name || x.id)}</option>`).join('')}</select>
      <button data-act="new">New card</button>
      <button data-act="duplicate">Duplicate</button>
      <button data-act="delete">Delete</button>
      <button data-act="clear" title="Start a new deck from one blank card">Clear all</button>
      <span class="spacer"></span>
      <button data-act="add" title="Lets new games use this deck: pick Yours or Both on the new game screen">Add deck to game</button>
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
  } else if (el instanceof HTMLSelectElement && el.dataset.partKind) {
    const [i, k] = el.dataset.partKind.split('.').map(Number);
    update(setPartKind(card(), i!, k!, el.value as PartKind));
    render();
  } else if (el.dataset.resource) {
    const part = el.dataset.part === undefined ? undefined : Number(el.dataset.part);
    update(toggleResource(card(), Number(el.dataset.check), el.dataset.resource as Resource, el.checked, part));
    renderStatus();
  } else if (el.dataset.tick) {
    update(setPath(card(), el.dataset.tick, el.checked));
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
    case 'clear':
      // A fresh start for a new deck. The deck already added to the game stays until this one is added in its place.
      if (!(await ask(`Clear all ${state.cards.length} card${state.cards.length === 1 ? '' : 's'} and start a new deck? Save the deck to a file first if you want to keep it. The deck you added to the game stays until you add another.`))) return;
      state = { cards: [newCard('objective-1')], selected: 0 };
      break;
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
    case 'add-part':
      update(addPart(card(), Number(btn.dataset.index)));
      break;
    case 'remove-part':
      update(removePart(card(), Number(btn.dataset.index), Number(btn.dataset.part)));
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
