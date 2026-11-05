<script lang="ts">
  // The skins on this device: Original (the built-in look) and any of one's
  // own. Each shows its factions' crests and names as the skin tells them.
  // Use one (menus, the codex and new games follow it), start a new one from
  // it, rename it, save it to a file, delete it, or open a skin file. The
  // editors change the skin in use: its look (theme editor), its factions'
  // pictures (faction editor) and its names and wording (skin words).
  import type { Faction } from '@scythe/engine';
  import { inkOn } from '../play/ink';
  import { ORIGINAL, type Skin } from '../skins/skin';
  import { factionSlot } from '../theme/theme';
  import type { SkinIndex } from '../saves/store';

  let {
    index,
    factions,
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
    message: string;
    loadSkin: (id: string) => Promise<Skin>;
    onUse: (id: string) => void;
    onNew: (name: string, from: string) => void;
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
    onExport: (id: string) => void;
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
            <button onclick={() => onExport(s.id)}>Save to a file</button>
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

<style>
  .screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
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
</style>
