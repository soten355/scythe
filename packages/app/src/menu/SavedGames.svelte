<script lang="ts">
  // Every game kept on this device, most recently played first: open one,
  // save it to a file, or delete it. Save files can be brought in here too.
  import type { SavedGame } from '../saves/save';

  let {
    saves,
    message,
    onOpen,
    onExport,
    onDelete,
    onImport,
    onBack,
  }: {
    saves: SavedGame[];
    /** Something to tell the player (an import that went wrong, say). */
    message: string;
    onOpen: (save: SavedGame) => void;
    onExport: (save: SavedGame) => void;
    onDelete: (save: SavedGame) => void;
    onImport: (file: File) => void;
    onBack: () => void;
  } = $props();

  /** The game asked about deleting. */
  let deleting: string | null = $state(null);
  let picker: HTMLInputElement | undefined = $state();

  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  function picked() {
    const file = picker?.files?.[0];
    if (file) onImport(file);
    if (picker) picker.value = '';
  }
</script>

<div class="screen">
  <header>
    <button class="quiet" onclick={onBack}>‹ Menu</button>
    <h2>Saved games</h2>
    <button onclick={() => picker?.click()}>Open a file…</button>
    <input type="file" accept=".json,application/json" bind:this={picker} onchange={picked} hidden />
  </header>
  {#if message}<p class="message">{message}</p>{/if}
  <ul>
    {#each saves as save (save.id)}
      <li>
        <span class="dots">
          {#each save.summary.factions as f (f.name)}<span class="dot" style:--c={f.color}></span>{/each}
        </span>
        <span class="what">
          <b>{save.summary.factions.map((f) => f.name).join(', ')}</b>
          <small>{save.finished ? 'Finished' : `Round ${save.summary.round}`} · {when(save.updated)}</small>
        </span>
        {#if deleting === save.id}
          <span class="sure">Delete this game?</span>
          <button onclick={() => ((deleting = null), onDelete(save))}>Delete</button>
          <button class="quiet" onclick={() => (deleting = null)}>Keep</button>
        {:else}
          <button class="quiet" onclick={() => (deleting = save.id)}>Delete</button>
          <button onclick={() => onExport(save)}>Save to a file</button>
          <button class="primary" onclick={() => onOpen(save)}>{save.finished ? 'View' : 'Play'}</button>
        {/if}
      </li>
    {:else}
      <li class="empty">No saved games yet. Games are saved here as you play.</li>
    {/each}
  </ul>
  <p class="hint">Saves stay on this device. Save important games to a file now and then to keep a copy.</p>
</div>

<style>
  .screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: calc(env(safe-area-inset-top) + 6px) calc(env(safe-area-inset-right) + 10px) calc(env(safe-area-inset-bottom) + 6px)
      calc(env(safe-area-inset-left) + 10px);
    gap: 8px;
    font-size: 13px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  h2 {
    flex: 1;
    margin: 0;
    text-align: center;
    color: var(--accent);
    font-size: 18px;
  }
  ul {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border-radius: 8px;
    background: #2a241e;
  }
  li.empty {
    justify-content: center;
    opacity: 0.6;
    background: none;
  }
  .dots {
    display: flex;
  }
  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--c);
    border: 2px solid #2a241e;
    margin-left: -5px;
  }
  .dot:first-child {
    margin-left: 0;
  }
  .what {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .what b {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .what small {
    opacity: 0.6;
  }
  .sure {
    color: var(--accent);
  }
  .message {
    margin: 0;
    padding: 6px 10px;
    border-radius: 7px;
    background: #4a2a22;
  }
  .hint {
    margin: 0;
    opacity: 0.5;
    font-size: 11px;
    text-align: center;
  }
  button {
    font: inherit;
    color: var(--fg);
    background: #3a3129;
    border: 1px solid var(--accent);
    border-radius: 7px;
    padding: 6px 10px;
    cursor: pointer;
  }
  button.primary {
    background: var(--accent);
    color: #1e1a16;
    font-weight: 700;
    padding: 6px 18px;
  }
  button.quiet {
    background: none;
    border-color: transparent;
    color: var(--accent);
  }
</style>
