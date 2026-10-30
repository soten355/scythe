// Faction editor: enter or design factions (the faction mat), then export
// them as data for packages/content. Plain DOM, no framework.
import { baseBoard, baseFactions } from '@scythe/content';
import { MAX_POWER, RECRUIT_BONUSES, validateFaction, type Faction, type RecruitBonus } from '@scythe/engine';
import '../shared/forms.css';
import './faction-editor.css';
import { ask, esc, setPath, showExport } from '../shared/editor-utils';
import { formatFactions, homeBaseClashes, newFaction } from './model';

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

function load(): EditorState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as EditorState;
  } catch {
    // Fall through to a fresh start if the saved copy is unreadable.
  }
  const factions = baseFactions.length ? JSON.parse(JSON.stringify(baseFactions)) : [newFaction('faction-1', 'nw')];
  return { factions, selected: 0 };
}

let state = load();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const faction = () => state.factions[state.selected]!;
const update = (next: Faction) => {
  state = { ...state, factions: state.factions.map((f, i) => (i === state.selected ? next : f)) };
  save();
};

// ---- rendering ---------------------------------------------------------------

const root = document.querySelector<HTMLDivElement>('#faction-editor')!;

const num = (path: string, value: number, max?: number) =>
  `<input type="number" inputmode="numeric" min="0" ${max ? `max="${max}"` : ''} step="1" data-path="${path}" value="${Number.isFinite(value) ? value : ''}">`;
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

function render() {
  const f = faction();
  const mechs = f.mechAbilities
    .map(
      (m, i) => `
      <div class="card">
        <h3>Mech ability ${i + 1}</h3>
        ${text(`mechAbilities.${i}.name`, m.name, 'Name')}
        ${area(`mechAbilities.${i}.description`, m.description)}
      </div>`,
    )
    .join('');
  const recruits = f.recruitBonuses
    .map(
      (r, i) => `
      <label>Space ${i + 1}
        <span class="pair">
          <select data-path="recruitBonuses.${i}.bonus" data-text>
            ${RECRUIT_BONUSES.map((b) => `<option value="${b}" ${b === r.bonus ? 'selected' : ''}>${BONUS_LABEL[b]}</option>`).join('')}
          </select>
          ${num(`recruitBonuses.${i}.amount`, r.amount)}
        </span>
      </label>`,
    )
    .join('');

  root.innerHTML = `
    <header>
      <a class="back" href="${import.meta.env.BASE_URL}">← Back to app</a>
      <select data-act="pick">${state.factions.map((x, i) => `<option value="${i}" ${i === state.selected ? 'selected' : ''}>${esc(x.name || x.id)}</option>`).join('')}</select>
      <button data-act="new">New faction</button>
      <button data-act="duplicate">Duplicate</button>
      <button data-act="delete">Delete</button>
      <span class="spacer"></span>
      <button data-act="export" class="primary">Export…</button>
    </header>
    <div class="details">
      <label>Name${text('name', f.name)}</label>
      <label>ID${text('id', f.id)}</label>
      <label>Color<input type="color" data-path="color" data-text value="${esc(f.color)}"></label>
      <label>Home base<select data-path="homeBase" data-text>${homeOptions(f.homeBase)}</select></label>
      <label>Starting power${num('power', f.power, MAX_POWER)}</label>
      <label>Starting combat cards${num('combatCards', f.combatCards)}</label>
      <label>Stars${num('stars', f.stars)}</label>
    </div>
    <div class="faction-grid">
      <div class="card ability">
        <h3>Faction ability</h3>
        ${text('ability.name', f.ability.name, 'Name')}
        ${area('ability.description', f.ability.description)}
      </div>
      <div class="card">
        <h3>Recruit one-time bonuses</h3>
        <div class="recruits">${recruits}</div>
      </div>
    </div>
    <div class="faction-grid">${mechs}</div>
    <p class="note">Write ability descriptions in your own words rather than copying the printed text.</p>
    <div class="status"></div>`;
  renderStatus();
}

function renderStatus() {
  const el = root.querySelector<HTMLElement>('.status')!;
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

root.addEventListener('change', (e) => {
  const el = e.target as HTMLElement;
  if (el instanceof HTMLSelectElement && el.dataset.act === 'pick') {
    state = { ...state, selected: Number(el.value) };
    save();
    render();
  } else if (el.dataset.path === 'name') {
    render(); // refresh the faction picker's label
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
    case 'duplicate': {
      const copy = { ...JSON.parse(JSON.stringify(faction())), id: `${faction().id}-copy`, name: `${faction().name} (copy)` };
      state = { factions: [...state.factions, copy], selected: state.factions.length };
      break;
    }
    case 'delete':
      if (!(await ask(`Delete "${faction().name}"?`))) return;
      state.factions.splice(state.selected, 1);
      if (state.factions.length === 0) state.factions.push(newFaction('faction-1', 'nw'));
      state = { factions: state.factions, selected: Math.min(state.selected, state.factions.length - 1) };
      break;
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
