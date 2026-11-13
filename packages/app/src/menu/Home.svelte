<script lang="ts">
  // The opening menu: continue the last game, start a new one, pick a saved
  // game, browse the codex (factions, mats, cards), pick a skin (the game's
  // whole look and names), or open the workshop (the editors and tools).
  import { ENGINE_VERSION } from '@scythe/engine';

  let {
    canContinue,
    savedCount,
    onContinue,
    onNewGame,
    onSaves,
    onCodex,
    onSkins,
    onWorkshop,
    skinName = 'Original',
    unsavedSkins = 0,
  }: { canContinue: boolean; savedCount: number; onContinue: () => void; onNewGame: () => void; onSaves: () => void; onCodex: () => void; onSkins: () => void; onWorkshop: () => void; skinName?: string; /** Skins made here or changed since their file, not saved to a file. */ unsavedSkins?: number } = $props();
</script>

<div class="home">
  <h1>Scythe</h1>
  <nav class="main">
    {#if canContinue}
      <button class="primary" onclick={onContinue}>Continue</button>
      <button onclick={onNewGame}>New game</button>
    {:else}
      <button class="primary" onclick={onNewGame}>New game</button>
    {/if}
    <button onclick={onSaves}>Saved games{savedCount ? ` (${savedCount})` : ''}</button>
    <div class="pair">
      <button onclick={onCodex}>📖 Codex</button>
      <button onclick={onSkins} title={unsavedSkins ? 'A skin is not saved to a file' : undefined}>🎨 Skins{#if unsavedSkins}<span class="warn" aria-label="not saved to a file"> ⚠️</span>{/if}</button>
    </div>
    <button onclick={onWorkshop}>🛠️ Workshop</button>
  </nav>
  {#if unsavedSkins}<p class="unsaved">⚠️ {unsavedSkins === 1 ? 'A skin is' : `${unsavedSkins} skins are`} not saved to a file. Save from 🎨 Skins to keep a copy.</p>{/if}
  <p class="meta">Skin: {skinName} · engine v{ENGINE_VERSION}</p>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }
  h1 {
    font-size: 40px;
    letter-spacing: 0.08em;
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 220px;
  }
  button {
    font: inherit;
    font-size: 16px;
    padding: 11px;
    border-radius: 8px;
    border: 1px solid var(--accent);
    background: var(--raised);
    color: var(--fg);
    cursor: pointer;
  }
  button.primary {
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
  }
  .unsaved {
    margin: 0;
    max-width: 260px;
    text-align: center;
    font-size: 12px;
    color: #e0a040;
  }
  .meta {
    margin: 0;
    opacity: 0.5;
    font-size: 11px;
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
</style>
