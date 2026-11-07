<script lang="ts">
  // The skins on this device: Original (the built-in look) and any of one's
  // own. Each shows its factions' crests and names as the skin tells them.
  // Use one (menus, the codex and new games follow it), start a new one from
  // it, rename it, save it to a file, delete it, or open a skin file. The
  // editors change the skin in use: its look (theme editor), its factions'
  // pictures (faction editor) and its names and wording (skin words). Saving
  // to a file asks whether to put the player's own card decks in too.
  import type { Faction } from '@scythe/engine';
  import { inkOn } from '../play/ink';
  import { ORIGINAL, type Skin } from '../skins/skin';
  import { factionSlot } from '../theme/theme';
  import type { SkinIndex } from '../saves/store';

  let {
    index,
    factions,
    cards,
    message,
    loadSkin,
    onUse,
    onNew,
    onRename,
    onDelete,
    onExport,
    onImport,
    onBack,
  }: {
    index: SkinIndex;
    /** The built-in factions, to show each skin's crests and names. */
    factions: Faction[];
    /** How many of their own cards the player has in each deck (none: still the made-up samples). */
    cards: { encounters: number; factory: number; objectives: number };
    message: string;
    loadSkin: (id: string) => Promise<Skin>;
    onUse: (id: string) => void;
    onNew: (name: string, from: string) => void;
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
    onExport: (id: string, withCards: boolean) => void;
    onImport: (file: File) => void;
    onBack: () => void;
  } = $props();

  const base = import.meta.env.BASE_URL;
  const all = $derived([{ id: ORIGINAL.id, name: ORIGINAL.name }, ...index.skins]);
  /** Each skin, read in full for its crests (they come in as they're read). */
  let full = $state.raw<Record<string, Skin>>({});
  // Read again whenever the list changes (a new, renamed, opened or deleted skin).
  $effect(() => {
    const ids = all.map((s) => s.id);
    Promise.all(ids.map((id) => loadSkin(id))).then((skins) => (full = Object.fromEntries(skins.map((skin, i) => [ids[i]!, skin]))), () => {});
  });

  function crests(skin: Skin | undefined) {
    return factions.map((f) => {
      const w = skin?.words.factions[f.id];
      const color = w?.color ?? f.color;
      return { id: f.id, name: w?.name?.trim() || f.name, color, crest: skin?.theme.pictures[factionSlot(f.id, 'crest')] };
    });
  }

  function startNew(from: string) {
    const name = prompt('Name for the new skin:', 'My skin')?.trim();
    if (name) onNew(name, from);
  }
  function rename(id: string, was: string) {
    const name = prompt('New name for this skin:', was)?.trim();
    if (name && name !== was) onRename(id, name);
  }
  function remove(id: string, name: string) {
    if (confirm(`Delete the skin "${name}" from this device? Its pictures and words go with it (save it to a file first to keep a copy). Games played in it show in the skin in use.`)) onDelete(id);
  }

  let fileInput: HTMLInputElement;

  /** The skin being saved to a file (the choice of cards is asked first). */
  let saving = $state<{ id: string; name: string } | null>(null);
  let withCards = $state(true);
  const hasCards = $derived(cards.encounters + cards.factory + cards.objectives > 0);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const cardList = $derived(
    [
      { n: cards.encounters, what: 'encounter card' },
      { n: cards.factory, what: 'Factory card' },
      { n: cards.objectives, what: 'objective card' },
    ].map(({ n, what }) => (n ? plural(n, what) : `no ${what}s of your own (the made-up samples stay out)`)),
  );
  function save() {
    if (!saving) return;
    onExport(saving.id, hasCards && withCards);
    saving = null;
  }
</script>

<div class="screen">
  <header>
    <button class="quiet" onclick={onBack}>‹ Menu</button>
    <h2>Skins</h2>
    <span class="spacer"></span>
    <button onclick={() => fileInput.click()}>Open a skin file…</button>
    <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={(e) => { const f = e.currentTarget.files?.[0]; if (f) onImport(f); e.currentTarget.value = ''; }} />
  </header>

  {#if message}<p class="message">{message}</p>{/if}

  <div class="list">
    {#each all as s (s.id)}
      {@const active = s.id === index.active}
      {@const original = s.id === ORIGINAL.id}
      <section class="skin" class:active>
        <div class="top">
          <h3>{s.name}</h3>
          {#if active}<span class="badge">In use</span>{:else}<button class="primary" onclick={() => onUse(s.id)}>Use</button>{/if}
        </div>
        <div class="crests">
          {#each crests(original ? ORIGINAL : full[s.id]) as c (c.id)}
            <span class="crest" title={c.name}>
              {#if c.crest}<img src={c.crest} alt="" />{:else}<i style:background={c.color} style:color={inkOn(c.color)}>{c.name[0]}</i>{/if}
              <small>{c.name}</small>
            </span>
          {/each}
        </div>
        <p class="note">{original ? 'The built-in look: drawn pieces and emoji, and the usual names. It never changes.' : active ? 'The editors in the Workshop change this skin.' : ''}</p>
        <div class="actions">
          <button onclick={() => startNew(s.id)}>New skin from this</button>
          {#if !original}
            <button onclick={() => rename(s.id, s.name)}>Rename</button>
            <button onclick={() => ((saving = { id: s.id, name: s.name }), (withCards = true))}>Save to a file</button>
            <button class="danger" onclick={() => remove(s.id, s.name)}>Delete</button>
          {/if}
        </div>
        {#if active && !original}
          <div class="edit">
            <span>Edit:</span>
            <a href="{base}themes.html">Look and pictures</a>
            <a href="{base}factions.html">Faction pictures</a>
            <a href="{base}skin-words.html">Names and wording</a>
          </div>
        {/if}
      </section>
    {/each}
  </div>
</div>

{#if saving}
  <!-- Saving a skin to a file: put the player's own cards in too, or not. -->
  <div class="backdrop" role="presentation" onclick={() => (saving = null)}></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Save the skin to a file">
    <h3>Save "{saving.name}" to a file</h3>
    <p>The file holds the whole skin: its pictures, colours, fonts, names and wording.</p>
    {#if hasCards}
      <label class="check">
        <input type="checkbox" bind:checked={withCards} />
        <span>
          <b>Include your cards</b>
          <small>{cardList.join(' · ')}</small>
          <small>Whoever opens the file is asked whether to use them for new games.</small>
        </span>
      </label>
    {:else}
      <p class="dim">Your encounter, Factory and objective decks are still the made-up samples, so there are no cards of your own to include. Add your decks from their editors in the Workshop first.</p>
    {/if}
    <div class="buttons">
      <button onclick={() => (saving = null)}>Cancel</button>
      <button class="primary" onclick={save}>Save to a file</button>
    </div>
  </div>
{/if}

<style>
  .screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: var(--safe-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
  }
  h2 {
    margin: 0;
    font-size: 20px;
  }
  .spacer {
    flex: 1;
  }
  button {
    font: inherit;
    font-size: 13px;
    color: var(--fg);
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 7px;
    padding: 6px 10px;
    cursor: pointer;
  }
  button.quiet {
    background: none;
    border-color: transparent;
    color: var(--accent);
    white-space: nowrap;
  }
  button.primary {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
    font-weight: 700;
  }
  button.danger {
    border-color: #a04040;
  }
  .message {
    margin: 0 12px 6px;
    font-size: 13px;
    color: var(--accent);
  }
  .list {
    flex: 1;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 10px;
    padding: 0 12px 12px;
    align-content: start;
  }
  .skin {
    min-width: 0;
    background: var(--panel);
    border: 2px solid transparent;
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .skin.active {
    border-color: var(--accent);
  }
  .top {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h3 {
    margin: 0;
    font-size: 17px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge {
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
  }
  .crests {
    display: flex;
    gap: 6px;
  }
  .crest {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .crest img,
  .crest i {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: contain;
  }
  .crest i {
    display: grid;
    place-items: center;
    font-style: normal;
    font-weight: 700;
    font-size: 18px;
  }
  .crest small {
    font-size: 11px;
    opacity: 0.8;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .note {
    margin: 0;
    font-size: 12px;
    opacity: 0.65;
    min-height: 1em;
  }
  .actions,
  .edit {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .edit {
    font-size: 13px;
  }
  .edit span {
    opacity: 0.65;
  }
  .edit a {
    color: var(--accent);
  }
  @media (max-height: 500px) {
    header {
      padding: 4px 8px;
    }
    .list {
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    }
  }
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.55);
    z-index: 10;
  }
  .dialog {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(460px, 92vw);
    max-height: 90vh;
    overflow-y: auto;
    z-index: 11;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 14px;
  }
  .dialog h3 {
    white-space: normal;
    flex: none;
  }
  .dialog p {
    margin: 0;
  }
  .dim {
    opacity: 0.7;
    font-size: 13px;
  }
  .check {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 8px 10px;
    background: var(--raised);
    border-radius: 8px;
    cursor: pointer;
  }
  .check input {
    width: 20px;
    height: 20px;
    margin-top: 1px;
    accent-color: var(--accent);
  }
  .check span {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .check small {
    opacity: 0.75;
    font-size: 12px;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  /* A phone held upright: one skin to a row, as wide as the screen, with faction names on two lines if need be. */
  @media (max-width: 600px) {
    .list {
      grid-template-columns: minmax(0, 1fr);
    }
    .crests {
      gap: 2px;
    }
    .crest small {
      font-size: 10px;
      white-space: normal;
      text-align: center;
      overflow-wrap: anywhere;
    }
  }
</style>
