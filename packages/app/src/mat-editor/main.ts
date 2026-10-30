// Player mat editor: enter or design player mats, then export them as data
// for packages/content. Plain DOM, no framework.
import { baseMats } from '@scythe/content';
import {
  BOTTOM_ACTIONS,
  BOTTOM_COST_RESOURCE,
  matUpgradeCubes,
  RECRUIT_BONUSES,
  STRUCTURES,
  TOP_ACTIONS,
  validateMat,
  type PlayerMat,
  type TopActionType,
  type BottomActionType,
} from '@scythe/engine';
import '../shared/forms.css';
import { ask, esc, showExport } from '../shared/editor-utils';
import { defaultTop, formatMats, newMat, setBottomAction, setField, setTopAction } from './model';

const STORAGE_KEY = 'scythe-mat-editor';

interface EditorState {
  mats: PlayerMat[];
  selected: number;
}

const TOP_LABEL: Record<TopActionType, string> = { move: 'Move', trade: 'Trade', produce: 'Produce', bolster: 'Bolster' };
const BOTTOM_LABEL: Record<BottomActionType, string> = { upgrade: 'Upgrade', deploy: 'Deploy', build: 'Build', enlist: 'Enlist' };
const BONUS_LABEL = { power: 'Power', coins: 'Coins', popularity: 'Popularity', combatCard: 'Combat card' };
const STRUCTURE_LABEL = {
  mine: 'Mine (private tunnel)',
  mill: 'Mill (extra hex to produce on)',
  armory: 'Armory (+1 power)',
  monument: 'Monument (+1 popularity)',
};

// Fields shown for each top-row action. Upgradeable ones get a start and an
// upgraded value; an upgrade cube sits on them if the two differ.
const TOP_FIELDS: Record<TopActionType, { key: string; label: string; upgradeable?: true }[]> = {
  move: [
    { key: 'units', label: 'Units moved', upgradeable: true },
    { key: 'coins', label: 'Or: coins gained', upgradeable: true },
  ],
  trade: [
    { key: 'cost', label: 'Cost (coins)' },
    { key: 'resources', label: 'Resources gained' },
    { key: 'popularity', label: 'Or: popularity gained', upgradeable: true },
  ],
  produce: [{ key: 'hexes', label: 'Hexes produced on', upgradeable: true }],
  bolster: [
    { key: 'cost', label: 'Cost (coins)' },
    { key: 'power', label: 'Power gained', upgradeable: true },
    { key: 'combatCards', label: 'Or: combat cards gained', upgradeable: true },
  ],
};

function load(): EditorState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const loaded = JSON.parse(saved) as EditorState;
      // Fill in fields added after a mat was saved: objective cards (usually 2)
      // and building bonuses (the standard one for each top-row action).
      const upgrade = (m: PlayerMat): PlayerMat => ({
        ...m,
        objectiveCards: m.objectiveCards ?? 2,
        sections: m.sections.map((s) => ({
          ...s,
          top: { ...s.top, structure: s.top.structure ?? defaultTop(s.top.action).structure },
        })) as PlayerMat['sections'],
      });
      return { ...loaded, mats: loaded.mats.map(upgrade) };
    }
  } catch {
    // Fall through to a fresh start if the saved copy is unreadable.
  }
  return { mats: baseMats.length ? [...baseMats] : [newMat('mat-1')], selected: 0 };
}

let state = load();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const mat = () => state.mats[state.selected]!;
const updateMat = (next: PlayerMat) => {
  state = { ...state, mats: state.mats.map((m, i) => (i === state.selected ? next : m)) };
  save();
};

// ---- rendering ---------------------------------------------------------------

const root = document.querySelector<HTMLDivElement>('#mat-editor')!;

const num = (path: string, value: number) =>
  `<input type="number" inputmode="numeric" min="0" step="1" data-path="${path}" value="${Number.isFinite(value) ? value : ''}">`;

const options = <T extends string>(all: T[], current: T, label: Record<T, string>) =>
  all.map((v) => `<option value="${v}" ${v === current ? 'selected' : ''}>${label[v]}</option>`).join('');

function sectionHtml(i: number) {
  const { top, bottom } = mat().sections[i]!;
  const values = top as unknown as Record<string, number | { base: number; upgraded: number }>;
  const topFields = TOP_FIELDS[top.action]
    .map((f) => {
      const p = `sections.${i}.top.${f.key}`;
      const v = values[f.key];
      if (f.upgradeable && typeof v === 'object') {
        return `<label>${f.label}<span class="pair">${num(`${p}.base`, v.base)}<span>→ upgraded</span>${num(`${p}.upgraded`, v.upgraded)}</span></label>`;
      }
      return `<label>${f.label}${num(p, v as number)}</label>`;
    })
    .join('');
  const resource = BOTTOM_COST_RESOURCE[bottom.action];
  return `
    <div class="section">
      <h3>Section ${i + 1}</h3>
      <div class="top">
        <select data-top="${i}">${options(TOP_ACTIONS, top.action, TOP_LABEL)}</select>
        ${topFields}
        <label>Building bonus
          <select data-path="sections.${i}.top.structure" data-text>${options(STRUCTURES, top.structure, STRUCTURE_LABEL)}</select>
        </label>
      </div>
      <div class="bottom">
        <select data-bottom="${i}">${options(BOTTOM_ACTIONS, bottom.action, BOTTOM_LABEL)}</select>
        <label>Cost (${resource}), no upgrades${num(`sections.${i}.bottom.cost`, bottom.cost)}</label>
        <label>Upgrade spaces${num(`sections.${i}.bottom.upgradeSpaces`, bottom.upgradeSpaces)}</label>
        <label>Coins gained${num(`sections.${i}.bottom.coins`, bottom.coins)}</label>
        <label>Recruit bonus
          <select data-path="sections.${i}.bottom.recruitBonus" data-text>${options(RECRUIT_BONUSES, bottom.recruitBonus, BONUS_LABEL)}</select>
        </label>
      </div>
    </div>`;
}

function render() {
  const m = mat();
  root.innerHTML = `
    <header>
      <a class="back" href="${import.meta.env.BASE_URL}">← Back to app</a>
      <select data-act="pick">${state.mats.map((x, i) => `<option value="${i}" ${i === state.selected ? 'selected' : ''}>${esc(x.name || x.id)}</option>`).join('')}</select>
      <button data-act="new">New mat</button>
      <button data-act="duplicate">Duplicate</button>
      <button data-act="delete">Delete</button>
      <span class="spacer"></span>
      <button data-act="export" class="primary">Export…</button>
    </header>
    <div class="details">
      <label>Name<input type="text" data-path="name" data-text value="${esc(m.name)}"></label>
      <label>ID<input type="text" data-path="id" data-text value="${esc(m.id)}"></label>
      <label>Turn order (lower goes first)${num('turnOrder', m.turnOrder)}</label>
      <label>Starting popularity${num('popularity', m.popularity)}</label>
      <label>Starting coins${num('coins', m.coins)}</label>
      <label>Objective cards${num('objectiveCards', m.objectiveCards)}</label>
    </div>
    <div class="sections">${[0, 1, 2, 3].map(sectionHtml).join('')}</div>
    <div class="status"></div>`;
  renderStatus();
}

function renderStatus() {
  const el = root.querySelector<HTMLElement>('.status')!;
  const problems = validateMat(mat());
  const cubes = matUpgradeCubes(mat());
  const cubeText = `Upgrade cubes: ${cubes.top} on top, ${cubes.bottom} spaces on the bottom.`;
  el.className = problems.length ? 'status bad' : 'status';
  el.textContent = problems.length ? `${cubeText} Problems: ${problems.join('; ')}.` : `✓ ${cubeText} This mat is ready.`;
}

// ---- input -------------------------------------------------------------------

root.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  const path = el.dataset.path;
  if (!path) return;
  const value = 'text' in el.dataset ? el.value : el.value === '' ? NaN : Number(el.value);
  updateMat(setField(mat(), path, value));
  renderStatus();
});

root.addEventListener('change', (e) => {
  const el = e.target as HTMLElement;
  if (el instanceof HTMLSelectElement && el.dataset.top) {
    updateMat(setTopAction(mat(), Number(el.dataset.top), el.value as TopActionType));
    render();
  } else if (el instanceof HTMLSelectElement && el.dataset.bottom) {
    updateMat(setBottomAction(mat(), Number(el.dataset.bottom), el.value as BottomActionType));
    render();
  } else if (el instanceof HTMLSelectElement && el.dataset.act === 'pick') {
    state = { ...state, selected: Number(el.value) };
    save();
    render();
  } else if (el.dataset.path === 'name') {
    render(); // refresh the mat picker's label
  }
});

root.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  switch (btn?.dataset.act) {
    case 'new':
      state = { mats: [...state.mats, newMat(`mat-${state.mats.length + 1}`)], selected: state.mats.length };
      break;
    case 'duplicate': {
      const copy = { ...JSON.parse(JSON.stringify(mat())), id: `${mat().id}-copy`, name: `${mat().name} (copy)` };
      state = { mats: [...state.mats, copy], selected: state.mats.length };
      break;
    }
    case 'delete':
      if (!(await ask(`Delete "${mat().name}"?`))) return;
      state.mats.splice(state.selected, 1);
      if (state.mats.length === 0) state.mats.push(newMat('mat-1'));
      state = { mats: state.mats, selected: Math.min(state.selected, state.mats.length - 1) };
      break;
    case 'export':
      showExport(
        'Export mats',
        `All ${state.mats.length} mat(s). Copy this text and paste it into the chat with Claude.`,
        formatMats(state.mats),
      );
      return;
    default:
      return;
  }
  save();
  render();
});

render();
