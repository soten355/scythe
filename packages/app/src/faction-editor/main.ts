// Faction editor: enter or design factions (the faction mat), then export
// them as data for packages/content; and give each faction its own pictures
// (crest, character, mech, worker, structures), kept in the skin in use on
// this device under the faction's ID. The five built-in factions can't change
// their rules here: their name, colour and wording go straight into the skin
// in use (so the codex, new games and menus show them), and the rest is shown
// as it is. Plain DOM, no framework.
import '../shared/fill-screen';
import { baseBoard, baseFactions } from '@scythe/content';
import { MAX_POWER, RECRUIT_BONUSES, validateFaction, type Faction, type RecruitBonus } from '@scythe/engine';
import '../shared/forms.css';
import './faction-editor.css';
import { addToGame, ask, esc, setPath, showExport, tell } from '../shared/editor-utils';
import { exportContent } from '../saves/files';
import { SaveStore } from '../saves/store';
import { clearPicture, copyFactionPictures, FACTION_PARTS, factionSlot, setPicture, type SlotId, type Theme } from '../theme/theme';
import { pictureFor, sizeKb } from '../theme/pictures';
import { formatFactions, homeBaseClashes, newFaction, withBuiltIns, wordsFromCopy } from './model';
import { applyWords, LORE_CARDS, LORE_MAX, NAME_MAX, type FactionLore, type Skin, type SkinWords } from '../skins/skin';
import { copyLore, setAbilityWord, setFactionWord, setLoreWord } from '../skins/words';

const STORAGE_KEY = 'scythe-faction-editor';
const HOME_BASES = Object.keys(baseBoard.homeBasePositions);
const BONUS_LABEL: Record<RecruitBonus, string> = {
  power: 'Power',
  coins: 'Coins',
  popularity: 'Popularity',
  combatCard: 'Combat cards',
};

interface EditorState {
  factions: Faction[];
  selected: number;
}

/** Old copies of built-in factions found under other IDs: their pictures move over once the skin is read. */
let strays: { from: string; to: string }[] = [];

function load(): EditorState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as EditorState;
      const fixed = withBuiltIns(parsed.factions, baseFactions);
      strays = fixed.strays;
      // The same faction stays open, wherever the list now has it.
      const open = parsed.factions[parsed.selected]?.id;
      const id = strays.find((s) => s.from === open)?.to ?? open;
      return { factions: fixed.factions, selected: Math.max(0, fixed.factions.findIndex((f) => f.id === id)) };
    }
  } catch {
    // Fall through to a fresh start if the saved copy is unreadable.
  }
  const factions = baseFactions.length ? JSON.parse(JSON.stringify(baseFactions)) : [newFaction('faction-1', 'nw')];
  return { factions, selected: 0 };
}

let state = load();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const faction = () => state.factions[state.selected]!;
// ---- pictures (kept in the theme, on this device) ------------------------------

const store = new SaveStore();
/** The skin in use and its theme; null until read (or if they can't be). */
let skin: Skin | null = null;
let theme: Theme | null = null;
let pictureNote = '';
/** What happened to the last change of a built-in faction's words. */
let wordNote = '';
/** What happened to the last change of a faction's story. */
let loreNote = '';

/** Changes the theme as it is on the device now (the theme editor may have changed it since this page opened). */
async function changeTheme(change: (t: Theme) => Theme, note: string) {
  try {
    skin = await store.changeSkin((s) => ({ ...s, theme: change(s.theme) }));
    theme = skin.theme;
    pictureNote = note;
  } catch {
    pictureNote = "That couldn't be kept on this device (it may be out of room).";
  }
  render();
}

/** Changes the words of the skin in use (a built-in faction's name, colour or wording). */
async function changeWords(change: (w: SkinWords) => SkinWords) {
  try {
    skin = await store.changeSkin((s) => ({ ...s, words: change(s.words) }));
    theme = skin.theme;
    wordNote = `Kept in the skin "${skin.name}": the Codex, new games and the menus show it.`;
  } catch {
    wordNote = "That couldn't be kept on this device.";
  }
  render();
}

/**
 * Keeps a part of a faction's story in the skin in use. The page is drawn again
 * only if that started a new skin, so going from box to box keeps your place.
 */
async function changeLore(id: string, key: keyof FactionLore, value: string) {
  const before = skin?.id;
  try {
    skin = await store.changeSkin((s) => ({ ...s, words: setLoreWord(s.words, id, key, value) }));
    theme = skin.theme;
    loreNote = `Kept in the skin "${skin.name}": the Codex shows it.`;
  } catch {
    loreNote = "That couldn't be kept on this device.";
  }
  if (skin?.id !== before) render();
  else root.querySelector('.story-note')!.textContent = loreNote;
}

/** The built-in faction with this one's ID, if it is one. */
const builtInOf = (f: Faction) => baseFactions.find((b) => b.id === f.id);
/** A built-in faction as the skin in use tells it. */
const skinned = (b: Faction) => (skin ? applyWords({ maps: [], factions: [b], mats: [] }, skin.words).factions[0]! : b);

const update = (next: Faction) => {
  state = { ...state, factions: state.factions.map((f, i) => (i === state.selected ? next : f)) };
  save();
};

// ---- rendering ---------------------------------------------------------------

const root = document.querySelector<HTMLDivElement>('#faction-editor')!;

/** Whether the faction open is built in (its rules can't change here). */
let locked = false;
const lock = () => (locked ? 'disabled' : '');
const num = (path: string, value: number, max?: number) =>
  `<input type="number" inputmode="numeric" min="0" ${max ? `max="${max}"` : ''} step="1" data-path="${path}" value="${Number.isFinite(value) ? value : ''}" ${lock()}>`;
/** A built-in faction's word, kept in the skin: `which` is its name, its colour, or an ability's name or wording. */
const word = (which: string, value: string, placeholder: string, isArea = false) =>
  isArea
    ? `<textarea data-skin="${which}" rows="3" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
    : `<input type="text" data-skin="${which}" value="${esc(value)}" placeholder="${esc(placeholder)}">`;
const text = (path: string, value: string, placeholder = '') =>
  `<input type="text" data-path="${path}" data-text value="${esc(value)}" placeholder="${placeholder}">`;
const area = (path: string, value: string) =>
  `<textarea data-path="${path}" data-text rows="3" placeholder="What it does, in your own words">${esc(value)}</textarea>`;

function homeOptions(current: string) {
  return HOME_BASES.map((id) => {
    const takenBy = state.factions.find((f, i) => i !== state.selected && f.homeBase === id);
    const note = takenBy ? ` (also ${esc(takenBy.name)})` : '';
    return `<option value="${id}" ${id === current ? 'selected' : ''}>${id.toUpperCase()}${note}</option>`;
  }).join('');
}

/** An ability's name and wording: the editor's own, or (built in) the skin's. */
function abilityFields(which: 'ability' | number, a: Faction['ability'], original: Faction['ability'] | undefined, path: string) {
  if (!original) return `${text(`${path}.name`, a.name, 'Name')}${area(`${path}.description`, a.description)}`;
  return `${word(`${which}.name`, a.name, original.name)}${word(`${which}.description`, a.description, original.description, true)}`;
}

function render() {
  const base = builtInOf(faction());
  locked = !!base;
  // A built-in faction shows as the skin tells it, with its own rules.
  const f = base ? skinned(base) : faction();
  const mechs = f.mechAbilities
    .map(
      (m, i) => `
      <div class="card">
        <h3>Mech ability ${i + 1}</h3>
        ${abilityFields(i, m, base?.mechAbilities[i], `mechAbilities.${i}`)}
      </div>`,
    )
    .join('');
  const recruits = f.recruitBonuses
    .map(
      (r, i) => `
      <label>Space ${i + 1}
        <span class="pair">
          <select data-path="recruitBonuses.${i}.bonus" data-text ${lock()}>
            ${RECRUIT_BONUSES.map((b) => `<option value="${b}" ${b === r.bonus ? 'selected' : ''}>${BONUS_LABEL[b]}</option>`).join('')}
          </select>
          ${num(`recruitBonuses.${i}.amount`, r.amount)}
        </span>
      </label>`,
    )
    .join('');

  root.innerHTML = `
    <header>
      <a class="back" href="${import.meta.env.BASE_URL}#workshop">← Workshop</a>
      <select data-act="pick">${state.factions
        .map((x, i) => {
          const b = builtInOf(x);
          return `<option value="${i}" ${i === state.selected ? 'selected' : ''}>${esc((b ? skinned(b).name : x.name) || x.id)}${b ? ' (built in)' : ''}</option>`;
        })
        .join('')}</select>
      <button data-act="new">New faction</button>
      <button data-act="duplicate">Duplicate</button>
      <button data-act="delete" ${lock()}>Delete</button>
      <span class="spacer"></span>
      <button data-act="add" title="${locked ? 'Built in: already in the game' : 'Pick this faction on the new game screen'}" ${lock()}>Add to game</button>
      <button data-act="file" ${lock()}>Save to a file</button>
      <button data-act="export" class="primary">Export…</button>
    </header>
    ${
      base
        ? `<div class="built-in">
        <p><b>${esc(f.name)} is built in.</b> Its name, colour and ability names and wording go straight into the skin in use, <b>${esc(skin?.name ?? '…')}</b>, so the Codex, new games and the menus show them (leave a box empty for the original). Its rules can't change: to make a different faction from it, use Duplicate.</p>
        ${wordNote ? `<span class="word-note">${esc(wordNote)}</span>` : ''}
      </div>`
        : ''
    }
    <div class="details">
      <label>Name${base ? word('name', f.name, base.name) : text('name', f.name)}</label>
      <label>ID${base ? `<input type="text" value="${esc(f.id)}" disabled>` : text('id', f.id)}</label>
      <label>Color${base ? `<input type="color" data-skin="color" value="${esc(f.color)}">` : `<input type="color" data-path="color" data-text value="${esc(f.color)}">`}</label>
      ${base ? `<button data-act="usual-color" ${f.color === base.color ? 'disabled' : ''}>Usual colour</button>` : ''}
      <label>Home base<select data-path="homeBase" data-text ${lock()}>${homeOptions(f.homeBase)}</select></label>
      <label>Starting power${num('power', f.power, MAX_POWER)}</label>
      <label>Starting combat cards${num('combatCards', f.combatCards)}</label>
      <label>Stars${num('stars', f.stars)}</label>
    </div>
    <div class="faction-grid">
      <div class="card ability">
        <h3>Faction ability</h3>
        ${abilityFields('ability', f.ability, base?.ability, 'ability')}
      </div>
      <div class="card">
        <h3>Recruit one-time bonuses</h3>
        <div class="recruits">${recruits}</div>
      </div>
    </div>
    <div class="faction-grid">${mechs}</div>
    <p class="note">Write ability descriptions in your own words rather than copying the printed text.</p>
    ${story(f)}
    ${pictures(f)}
    <div class="status"></div>`;
  renderStatus();
}

/** The faction's story for the Codex: any faction's, kept in the skin in use under its ID. */
function story(f: Faction): string {
  const lore = skin?.words.factions[f.id]?.lore;
  const off = skin ? '' : 'disabled';
  const cards = LORE_CARDS.map(
    (card) => `
    <div class="card">
      <h3>${esc(card.title)}</h3>
      ${card.fields
        .map(({ key, label, long }) =>
          long
            ? `<label>${esc(label)}<textarea data-lore="${key}" rows="4" maxlength="${LORE_MAX}" ${off}>${esc(lore?.[key] ?? '')}</textarea></label>`
            : `<label>${esc(label)}<input type="text" data-lore="${key}" maxlength="${NAME_MAX}" value="${esc(lore?.[key] ?? '')}" ${off}></label>`,
        )
        .join('')}
    </div>`,
  ).join('');
  return `<section class="story">
      <h3>Story</h3>
      <p class="note">Shown on this faction's Codex page, only for reading: it changes nothing in the game. Kept in the skin in use, so each skin can tell its own. With the Original skin in use, the first thing you write starts a skin of your own.</p>
      <div class="story-cards">${cards}</div>
      <p class="note story-note">${esc(loreNote)}</p>
    </section>`;
}

function pictures(f: Faction): string {
  const rows = FACTION_PARTS.map(({ part, label, hint }) => {
    const slot = factionSlot(f.id, part);
    const url = theme?.pictures[slot];
    return `<div class="slot">
      <div class="thumb" style="--c:${esc(f.color)}">${url ? `<img src="${esc(url)}" alt="">` : '<span>—</span>'}</div>
      <div class="what"><b>${esc(label)}</b><small>${esc(hint)}${url ? ` · ${sizeKb(url)} KB` : ''}</small></div>
      <button data-act="choose" data-slot="${esc(slot)}" ${theme ? '' : 'disabled'}>${url ? 'Change…' : 'Choose…'}</button>
      ${url ? `<button data-act="clear" data-slot="${esc(slot)}">Clear</button>` : ''}
    </div>`;
  }).join('');
  return `<section class="pictures">
      <h3>Pictures</h3>
      <p class="note">This faction's own look in the game; anything left empty keeps the usual piece in its colour. Pictures are kept on this device in the skin in use, under the ID <b>${esc(f.id)}</b>, and go to other devices in its skin file (Main menu → Skins → Save to a file). With the Original skin in use, the first picture starts a skin of your own. Use your own pictures, not scans of the published game.</p>
      <div class="slots">${rows}</div>
      <p class="note picture-note">${esc(theme ? pictureNote : "The pictures on this device couldn't be read.")}</p>
      <input type="file" accept="image/*" data-picture hidden>
    </section>`;
}

function renderStatus() {
  const el = root.querySelector<HTMLElement>('.status')!;
  if (locked) {
    el.className = 'status';
    el.textContent = '✓ Built in: always in the game.';
    return;
  }
  const problems = validateFaction(faction());
  const clashes = homeBaseClashes(state.factions);
  const notes = clashes.length ? ` Note: ${clashes.join('; ')} (fine if they never play together).` : '';
  el.className = problems.length ? 'status bad' : 'status';
  el.textContent = problems.length ? `Problems: ${problems.join('; ')}.${notes}` : `✓ This faction is ready.${notes}`;
}

// ---- input -------------------------------------------------------------------

root.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const path = el.dataset.path;
  if (!path) return;
  const value = 'text' in el.dataset ? el.value : el.value === '' ? NaN : Number(el.value);
  update(setPath(faction(), path, value));
  renderStatus();
});

/** The faction's ID when its ID box was entered, so its pictures can follow a new ID. */
let idBefore: string | null = null;
root.addEventListener('focusin', (e) => {
  if ((e.target as HTMLElement).dataset.path === 'id') idBefore = faction().id;
});

let choosing: SlotId | null = null;

root.addEventListener('change', async (e) => {
  const el = e.target as HTMLElement;
  if (el instanceof HTMLInputElement && el.dataset.picture !== undefined) {
    const file = el.files?.[0];
    el.value = '';
    if (!file || !choosing) return;
    const slot = choosing;
    pictureNote = 'Shrinking the picture…';
    render();
    try {
      const url = await pictureFor(slot, file);
      await changeTheme((t) => setPicture(t, slot, url), 'Saved on this device: the game uses it the next time it opens.');
    } catch (err) {
      pictureNote = err instanceof Error ? err.message : String(err);
      render();
    }
  } else if (el.dataset.path === 'id') {
    const from = idBefore;
    idBefore = faction().id;
    const to = faction().id.trim();
    // Its story follows the new ID, as its pictures do.
    if (from && to && from !== to && skin?.words.factions[from]?.lore) await changeWords((w) => copyLore(w, from, to, { move: true }));
    if (from && to && from !== to && FACTION_PARTS.some((p) => theme?.pictures[factionSlot(from, p.part)])) {
      await changeTheme((t) => copyFactionPictures(t, from, to, { move: true }), `Its pictures moved to the new ID, ${to}.`);
    } else {
      render();
    }
  } else if (el instanceof HTMLSelectElement && el.dataset.act === 'pick') {
    state = { ...state, selected: Number(el.value) };
    save();
    render();
  } else if (el.dataset.path === 'name') {
    render(); // refresh the faction picker's label
  } else if (el.dataset.lore && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    await changeLore(faction().id, el.dataset.lore as keyof FactionLore, el.value);
  } else if (el.dataset.skin && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    // A built-in faction's word, into the skin in use.
    const id = faction().id;
    const v = el.value;
    const [which, key] = el.dataset.skin.split('.') as [string, 'name' | 'description' | undefined];
    if (!key) await changeWords((w) => setFactionWord(w, id, which as 'name' | 'color', v));
    else await changeWords((w) => setAbilityWord(w, id, which === 'ability' ? 'ability' : Number(which), key, v));
  }
});

root.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  switch (btn?.dataset.act) {
    case 'new': {
      const free = HOME_BASES.find((h) => !state.factions.some((f) => f.homeBase === h)) ?? HOME_BASES[0]!;
      state = { factions: [...state.factions, newFaction(`faction-${state.factions.length + 1}`, free)], selected: state.factions.length };
      break;
    }
    case 'usual-color': {
      const id = faction().id;
      await changeWords((w) => setFactionWord(w, id, 'color', ''));
      return;
    }
    case 'duplicate': {
      // A built-in faction is copied as the skin tells it: a new faction of one's own, free to change.
      const b = builtInOf(faction());
      const shown = b ? skinned(b) : faction();
      const copy = { ...JSON.parse(JSON.stringify(shown)), id: `${shown.id}-copy`, name: `${shown.name} (copy)` };
      const from = faction().id;
      state = { factions: [...state.factions, copy], selected: state.factions.length };
      save();
      if (skin?.words.factions[from]?.lore) await changeWords((w) => copyLore(w, from, copy.id));
      if (FACTION_PARTS.some((p) => theme?.pictures[factionSlot(from, p.part)])) {
        await changeTheme((t) => copyFactionPictures(t, from, copy.id), 'Its pictures were copied too.');
        return;
      }
      break;
    }
    case 'choose':
      choosing = btn!.dataset.slot as SlotId;
      root.querySelector<HTMLInputElement>('[data-picture]')!.click();
      return;
    case 'clear': {
      const slot = btn!.dataset.slot as SlotId;
      await changeTheme((t) => clearPicture(t, slot), 'Picture removed.');
      return;
    }
    case 'delete':
      if (!(await ask(`Delete "${faction().name}"?`))) return;
      state.factions.splice(state.selected, 1);
      if (state.factions.length === 0) state.factions.push(newFaction('faction-1', 'nw'));
      state = { factions: state.factions, selected: Math.min(state.selected, state.factions.length - 1) };
      break;
    case 'add':
    case 'file': {
      // This faction only: it can be played (or shared) as it is now.
      const problems = validateFaction(faction());
      if (problems.length) return tell(`Fix this first: ${problems.join('; ')}.`);
      const content = { maps: [], factions: [faction()], mats: [], encounters: [], factory: [], objectives: [], structureBonuses: [] };
      return btn!.dataset.act === 'add' ? addToGame(content) : exportContent(content);
    }
    case 'export':
      showExport(
        'Export factions',
        `All ${state.factions.length} faction(s). Copy this text and paste it into the chat with Claude.`,
        formatFactions(state.factions),
      );
      return;
    default:
      return;
  }
  save();
  render();
});

render();
store.activeSkin().then(
  async (s) => {
    skin = s;
    theme = s.theme;
    // Pictures saved under an old copy's ID move to the built-in faction (any it already has stay).
    const pictured = strays.filter(({ from }) => FACTION_PARTS.some((p) => s.theme.pictures[factionSlot(from, p.part)]));
    if (pictured.length) {
      try {
        s = await store.changeSkin((x) => ({ ...x, theme: pictured.reduce((t, { from, to }) => copyFactionPictures(t, from, to, { keep: true }), x.theme) }));
        skin = s;
        theme = s.theme;
        pictureNote = `Pictures saved under an old ID now belong to ${pictured.map(({ to }) => skinned(baseFactions.find((b) => b.id === to)!).name).join(', ')}.`;
      } catch {
        // The list isn't saved, so this is tried again next time.
        pictureNote = "Some pictures saved under an old ID couldn't be moved (the device may be out of room).";
        render();
        return;
      }
    }
    // Names and wording once changed in this editor's copies of built-in factions move into the skin.
    const moved = state.factions.filter((f) => {
      const b = builtInOf(f);
      return b && wordsFromCopy(b, f, s.words) !== s.words;
    });
    if (moved.length) {
      try {
        skin = await store.changeSkin((x) => ({ ...x, words: moved.reduce((w, f) => wordsFromCopy(builtInOf(f)!, f, w), x.words) }));
        theme = skin.theme;
        wordNote = `Your earlier changes to ${moved.map((f) => builtInOf(f)!.name).join(', ')} are now in the skin "${skin.name}", so the Codex and new games show them.`;
      } catch {
        wordNote = "Your earlier changes couldn't be moved into the skin.";
      }
    }
    // The editor's copies of built-in factions are the built-in ones now: their words live in the skin.
    if (!moved.length || skin !== s) {
      state = { ...state, factions: state.factions.map((f) => builtInOf(f) ?? f) };
      save();
    }
    render();
  },
  () => render(),
);
