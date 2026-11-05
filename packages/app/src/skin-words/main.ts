// Skin words: the names and wording of the skin in use. For each faction, a
// new name and colour, and new names and wording for its faction ability and
// four mech abilities; a new name for each mat and map. Beside each, what it
// does in the game (the rules never change, only the words). A blank keeps
// the original. Every change is kept on this device at once. Plain DOM, no
// framework; shares its look with the other editors.
import type { Faction } from '@scythe/engine';
import '../shared/forms.css';
import './skin-words.css';
import { esc } from '../shared/editor-utils';
import { SaveStore } from '../saves/store';
import { BUILT_IN } from '../content/catalog';
import { catalogWith } from '../content/library';
import type { Catalog } from '../menu/setup';
import { newSkin, ORIGINAL, type Skin, type SkinWords } from '../skins/skin';
import { setAbilityWord, setFactionWord, setNameWord } from '../skins/words';
import { factionSlot } from '../theme/theme';

const store = new SaveStore();
const root = document.querySelector<HTMLDivElement>('#skin-words')!;
const base = import.meta.env.BASE_URL;
let skin: Skin = ORIGINAL;
/** The originals: built-in, and the player's own factions, mats and maps. */
let catalog: Catalog = BUILT_IN;
let selected = 0;
let status = '';

function show(message: string, bad = false) {
  status = message;
  const el = root.querySelector<HTMLElement>('.status');
  if (el) {
    el.textContent = message;
    el.className = bad ? 'status bad' : 'status';
  }
}

/** Keeps new words in the skin in use (read again first, so its pictures, changed elsewhere, aren't lost). */
async function keep(change: (w: SkinWords) => SkinWords) {
  try {
    const fresh = await store.activeSkin();
    if (fresh.id !== skin.id) {
      show('Another skin was put in use meanwhile. Reload this page to edit it.', true);
      return;
    }
    skin = { ...fresh, words: change(fresh.words) };
    await store.putSkin(skin);
    show(`Kept in "${skin.name}" on this device. New games and the codex use it.`);
  } catch {
    show("This couldn't be kept on the device.", true);
  }
}

const field = (attrs: string, value: string | undefined, placeholder: string, area = false) =>
  area
    ? `<textarea ${attrs} rows="3" placeholder="${esc(placeholder)}">${esc(value ?? '')}</textarea>`
    : `<input type="text" ${attrs} value="${esc(value ?? '')}" placeholder="${esc(placeholder)}">`;

function abilityCard(f: Faction, which: 'ability' | number) {
  const original = which === 'ability' ? f.ability : f.mechAbilities[which]!;
  const words = which === 'ability' ? skin.words.factions[f.id]?.ability : skin.words.factions[f.id]?.mechAbilities?.[which];
  const title = which === 'ability' ? 'Faction ability' : `Mech ability ${which + 1}`;
  return `
    <div class="card${which === 'ability' ? ' wide' : ''}">
      <h3>${title}</h3>
      ${field(`data-ability="${which}" data-key="name"`, words?.name, original.name)}
      ${field(`data-ability="${which}" data-key="description"`, words?.description, original.description, true)}
      <p class="does"><b>In the game:</b> ${esc(original.name)}: ${esc(original.description)}</p>
    </div>`;
}

function render() {
  if (skin.id === ORIGINAL.id) {
    root.innerHTML = `
      <header><a class="back" href="${base}#skins">← Skins</a><h2>Names and wording</h2></header>
      <div class="empty">
        <p>The Original skin is in use, and it never changes. Start a skin of your own to give the factions, mats and maps your own names and wording.</p>
        <button class="primary" data-act="start">Start a new skin from Original</button>
      </div>`;
    return;
  }
  const f = catalog.factions[selected]!;
  const w = skin.words.factions[f.id] ?? {};
  const color = w.color ?? f.color;
  const crest = skin.theme.pictures[factionSlot(f.id, 'crest')];
  root.innerHTML = `
    <header>
      <a class="back" href="${base}#skins">← Skins</a>
      <h2>Names and wording · <span class="skin-name">${esc(skin.name)}</span></h2>
      <span class="spacer"></span>
      <span class="status">${esc(status)}</span>
    </header>
    <p class="intro">Your own names and words for this skin. The rules never change: every number and effect stays as it is. Leave a box empty to keep the original (shown faintly in it).</p>
    <nav class="factions">
      ${catalog.factions
        .map((x, i) => {
          const xw = skin.words.factions[x.id];
          return `<button data-pick="${i}" class="${i === selected ? 'on' : ''}" style="--c:${esc(xw?.color ?? x.color)}">${esc(xw?.name || x.name)}</button>`;
        })
        .join('')}
    </nav>
    <section class="faction" style="--c:${esc(color)}">
      <div class="named">
        ${crest ? `<img class="crest" src="${esc(crest)}" alt="">` : `<span class="crest dot"></span>`}
        <label>Name${field('data-faction="name"', w.name, f.name)}</label>
        <label>Colour<input type="color" data-faction="color" value="${esc(color)}"></label>
        <button data-act="usual-color" ${w.color ? '' : 'disabled'}>Usual colour</button>
        <span class="was">Originally ${esc(f.name)}</span>
      </div>
      <div class="abilities">
        ${abilityCard(f, 'ability')}
        ${[0, 1, 2, 3].map((i) => abilityCard(f, i)).join('')}
      </div>
    </section>
    <section class="names">
      <div class="card">
        <h3>Mats</h3>
        ${[...catalog.mats]
          .sort((a, b) => a.turnOrder - b.turnOrder)
          .map((m) => `<label>${esc(m.name)}${field(`data-name="mats" data-id="${esc(m.id)}"`, skin.words.mats[m.id]?.name, m.name)}</label>`)
          .join('')}
      </div>
      <div class="card">
        <h3>Maps</h3>
        ${catalog.maps.map((m) => `<label>${esc(m.name)}${field(`data-name="maps" data-id="${esc(m.id)}"`, skin.words.maps[m.id]?.name, m.name)}</label>`).join('')}
      </div>
    </section>`;
}

root.addEventListener('click', async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-pick],[data-act]');
  if (!el) return;
  if (el.dataset.pick) {
    selected = Number(el.dataset.pick);
    render();
  } else if (el.dataset.act === 'usual-color') {
    const id = catalog.factions[selected]!.id;
    await keep((w) => setFactionWord(w, id, 'color', ''));
    render();
  } else if (el.dataset.act === 'start') {
    skin = newSkin('My skin', ORIGINAL, crypto.randomUUID());
    await store.putSkin(skin, { use: true });
    status = 'Started "My skin" and put it in use. Rename it on the Skins screen.';
    render();
  }
});

// Kept as each box is left (or a colour picked); the faction tabs follow names and colours.
root.addEventListener('change', async (e) => {
  const el = e.target as HTMLInputElement | HTMLTextAreaElement;
  const f = catalog.factions[selected]!;
  const v = el.value;
  if (el.dataset.faction) await keep((w) => setFactionWord(w, f.id, el.dataset.faction as 'name' | 'color', v));
  else if (el.dataset.ability) {
    const which = el.dataset.ability === 'ability' ? 'ability' : Number(el.dataset.ability);
    await keep((w) => setAbilityWord(w, f.id, which, el.dataset.key as 'name' | 'description', v));
  } else if (el.dataset.name) await keep((w) => setNameWord(w, el.dataset.name as 'mats' | 'maps', el.dataset.id!, v));
  else return;
  if (el.dataset.faction) render();
});

Promise.all([store.activeSkin(), store.library()]).then(
  ([s, library]) => {
    skin = s;
    catalog = catalogWith(BUILT_IN, library);
    render();
  },
  () => {
    root.innerHTML = `<p class="empty">The skins on this device can't be read.</p>`;
  },
);
