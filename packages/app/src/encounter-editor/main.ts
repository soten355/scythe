// Encounter card editor: enter the encounter deck card by card (each card's
// three options, their costs and rewards, and its picture and story), then
// add it to the game or save it to a file. Pictures are kept on the device
// (the cards hold a short reference) and go in the deck's file. Plain DOM, no
// framework.
import { RESOURCES, type BottomActionType, type EncounterCard, type EncounterShow } from '@scythe/engine';
import '../shared/forms.css';
import '../faction-editor/faction-editor.css';
import './encounter-editor.css';
import { EMPTY_LIBRARY } from '../content/library';
import { addToGame, ask, esc, setPath, showExport, tell } from '../shared/editor-utils';
import { exportContent } from '../saves/files';
import { SaveStore } from '../saves/store';
import { CARD_PICTURE, pictureRef, picturesFor } from '../content/card-pictures';
import { shrinkPicture, sizeKb } from '../theme/pictures';
import { costText, gainText } from '../play/prompt';
import { cleanCard, deckProblems, editable, formatCards, newCard, nextId, toggleAction } from './model';

const STORAGE_KEY = 'scythe-encounter-editor';
const ACTIONS: [BottomActionType, string][] = [
  ['upgrade', 'Upgrade'],
  ['deploy', 'Deploy'],
  ['build', 'Build'],
  ['enlist', 'Enlist'],
];

interface EditorState {
  cards: EncounterCard[];
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
  return { cards: [newCard('card-1')], selected: 0 };
}

let state = load();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const card = () => state.cards[state.selected]!;
const update = (next: EncounterCard) => {
  state = { ...state, cards: state.cards.map((c, i) => (i === state.selected ? next : c)) };
  save();
};

// ---- pictures (kept on the device, by reference) ------------------------------

const store = new SaveStore();
let pictures: Record<string, string> = {};
let pictureNote = '';
const SHOWS: [EncounterShow, string][] = [
  ['story', 'The story'],
  ['picture', 'The picture'],
  ['both', 'Both'],
  ['none', 'Neither'],
];

// ---- rendering ---------------------------------------------------------------

const root = document.querySelector<HTMLDivElement>('#encounter-editor')!;

/** A number box; blank means none. */
const num = (path: string, value: number | null | undefined, label: string) =>
  `<label class="amount">${label}<input type="number" inputmode="numeric" min="0" step="1" data-path="${path}" value="${typeof value === 'number' && Number.isFinite(value) ? value : ''}"></label>`;
const text = (path: string, value: string, placeholder = '') =>
  `<input type="text" data-path="${path}" data-text value="${esc(value)}" placeholder="${placeholder}">`;
const area = (path: string, value: string, placeholder: string, rows = 2) =>
  `<textarea data-path="${path}" data-text rows="${rows}" placeholder="${placeholder}">${esc(value)}</textarea>`;

/** How the game will show an option: its cost, then what it gives. */
function preview(i: number): string {
  const o = cleanCard(card()).options[i]!;
  return `${costText(o.cost)} → ${gainText(o.gain, 'the hex')}`;
}

function optionCard(i: number): string {
  const o = card().options[i]!;
  const p = `options.${i}`;
  const res = o.gain.resources ?? {};
  return `
    <div class="card option">
      <h3>Option ${i + 1}</h3>
      ${area(`${p}.text`, o.text, 'What the player does, in your own words')}
      <p class="part">Cost</p>
      <div class="amounts">
        ${num(`${p}.cost.coins`, o.cost.coins, 'Coins')}
        ${num(`${p}.cost.popularity`, o.cost.popularity, 'Popularity')}
        ${num(`${p}.cost.power`, o.cost.power, 'Power')}
      </div>
      <p class="part">Gives</p>
      <div class="amounts">
        ${num(`${p}.gain.coins`, o.gain.coins, 'Coins')}
        ${num(`${p}.gain.power`, o.gain.power, 'Power')}
        ${num(`${p}.gain.popularity`, o.gain.popularity, 'Popularity')}
        ${num(`${p}.gain.combatCards`, o.gain.combatCards, 'Combat cards')}
        ${num(`${p}.gain.workers`, o.gain.workers, 'Workers')}
      </div>
      <p class="part">Resources (on the encounter's hex)</p>
      <div class="amounts">
        ${RESOURCES.map((r) => num(`${p}.gain.resources.${r}`, res[r], r[0]!.toUpperCase() + r.slice(1))).join('')}
        ${num(`${p}.gain.anyResources`, o.gain.anyResources, 'Any kind')}
      </div>
      <p class="part">Free actions</p>
      <div class="actions">
        ${ACTIONS.map(([a, name]) => `<label class="check"><input type="checkbox" data-option="${i}" data-action="${a}" ${o.gain.actions?.includes(a) ? 'checked' : ''}> ${name}</label>`).join('')}
      </div>
      <p class="preview" data-preview="${i}">${esc(preview(i))}</p>
    </div>`;
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
      <label>Story${area('story', c.story, 'A line or two that sets the scene, in your own words', 2)}</label>
    </div>
    ${pictureRow(c)}
    <div class="options-grid">${[0, 1, 2].map(optionCard).join('')}</div>
    <p class="note">Enter each option's effects as printed on the card, but write the name, story and option text in your own words. Leave a box blank for none.</p>
    <div class="status"></div>`;
  renderStatus();
}

/** The card's picture, and what the card shows above its options. */
function pictureRow(c: EncounterCard): string {
  const url = c.picture ? pictures[c.picture] : undefined;
  const show = c.show ?? (c.picture ? 'both' : 'story');
  const missing = c.picture && !url ? ' (not on this device: open the deck file here to bring it)' : '';
  return `<div class="picture-row">
      <div class="card-thumb">${url ? `<img src="${esc(url)}" alt="">` : '<span>No picture</span>'}</div>
      <div class="picture-controls">
        <label class="show">Shows<select data-show>${SHOWS.map(([v, l]) => `<option value="${v}" ${v === show ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="buttons">
          <button data-act="pic-choose">${c.picture ? 'Change picture…' : 'Choose picture…'}</button>
          ${c.picture ? '<button data-act="pic-clear">Clear picture</button>' : ''}
        </div>
        <small>Above the card's options in the game; with both, the story sits over the bottom of the picture. Best at ${CARD_PICTURE.best.width} × ${CARD_PICTURE.best.height} pixels; bigger pictures are shrunk${url ? ` · ${sizeKb(url)} KB` : ''}${missing}. Use your own pictures, not scans of the printed cards.</small>
        ${pictureNote ? `<small class="picture-note">${esc(pictureNote)}</small>` : ''}
      </div>
      <input type="file" accept="image/*" data-picture hidden>
    </div>`;
}

function renderStatus() {
  const el = root.querySelector<HTMLElement>('.status')!;
  const problems = deckProblems(state.cards);
  const n = state.cards.length;
  el.className = problems.length ? 'status bad' : 'status';
  el.textContent = problems.length
    ? `Problems: ${problems.slice(0, 4).join('; ')}${problems.length > 4 ? `; and ${problems.length - 4} more` : ''}.`
    : `✓ All ${n} card${n === 1 ? '' : 's'} ready.`;
  for (const p of root.querySelectorAll<HTMLElement>('[data-preview]')) p.textContent = preview(Number(p.dataset.preview));
}

// ---- input -------------------------------------------------------------------

root.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const path = el.dataset.path;
  if (!path) return;
  const value = 'text' in el.dataset ? el.value : el.value === '' ? null : Number(el.value);
  update(setPath(card(), path, value));
  renderStatus();
});

root.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement;
  if (el instanceof HTMLSelectElement && el.dataset.act === 'pick') {
    state = { ...state, selected: Number(el.value) };
    save();
    render();
  } else if (el.dataset.show !== undefined) {
    update({ ...card(), show: (el as unknown as HTMLSelectElement).value as EncounterShow });
  } else if (el.dataset.picture !== undefined) {
    void choosePicture(el);
  } else if (el.dataset.action) {
    update(toggleAction(card(), Number(el.dataset.option), el.dataset.action as BottomActionType, el.checked));
    renderStatus();
  }
});

// The card picker's label follows the name as it's typed (without redrawing the page, which would lose your place).
root.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.path !== 'name' && el.dataset.path !== 'id') return;
  const option = root.querySelector<HTMLSelectElement>('[data-act="pick"]')?.options[state.selected];
  if (option) option.textContent = `${state.selected + 1}. ${card().name || card().id}`;
});

async function choosePicture(input: HTMLInputElement) {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const at = state.selected;
  pictureNote = 'Shrinking the picture…';
  render();
  try {
    const url = await shrinkPicture(file, CARD_PICTURE);
    const ref = pictureRef(url);
    await store.putCardPictures({ [ref]: url });
    pictures = { ...pictures, [ref]: url };
    if (state.selected === at) update({ ...card(), picture: ref });
    pictureNote = 'Kept on this device. Add the deck to the game, or save it to a file, to use it.';
  } catch (err) {
    pictureNote = err instanceof Error ? err.message : "The picture couldn't be kept on this device (it may be out of room).";
  }
  render();
}

root.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  if (btn?.dataset.act !== 'pic-choose') pictureNote = '';
  switch (btn?.dataset.act) {
    case 'pic-choose':
      root.querySelector<HTMLInputElement>('[data-picture]')!.click();
      return;
    case 'pic-clear': {
      // The picture stays kept (another card may use it); this card just stops showing it.
      const { picture: _, ...rest } = card();
      update(rest as EncounterCard);
      break;
    }
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
      if (state.cards.length === 0) state.cards.push(newCard('card-1'));
      state = { cards: state.cards, selected: Math.min(state.selected, state.cards.length - 1) };
      break;
    case 'add':
    case 'file': {
      // The whole deck: new games draw from it.
      const problems = deckProblems(state.cards);
      if (problems.length) return tell(`Fix this first: ${problems.join('; ')}.`);
      const content = { ...EMPTY_LIBRARY, encounters: state.cards.map(cleanCard) };
      if (btn!.dataset.act === 'file') return exportContent(content, picturesFor(content.encounters, pictures));
      // The deck as it is now replaces any added before (cards deleted here leave the game too).
      return addToGame(content, (added) => `Added ${added.length} encounter card${added.length === 1 ? '' : 's'}. New games now draw encounters from your deck.`, 'encounters');
    }
    case 'export':
      showExport(
        'Export encounter cards',
        `All ${state.cards.length} card(s). Copy this text and paste it into the chat with Claude. Pictures aren't in this text: "Save deck to a file" keeps them.`,
        formatCards(state.cards),
      );
      return;
    default:
      return;
  }
  save();
  render();
});

render();
store.cardPictures().then(
  (kept) => {
    pictures = kept;
    render();
  },
  () => {},
);
