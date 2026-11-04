<script lang="ts">
  // The opening menu: continue the last game, start a new one, pick a saved
  // game, or open the workshop (the editors and tools).
  import { ENGINE_VERSION } from '@scythe/engine';

  let {
    canContinue,
    savedCount,
    onContinue,
    onNewGame,
    onSaves,
    onWorkshop,
  }: { canContinue: boolean; savedCount: number; onContinue: () => void; onNewGame: () => void; onSaves: () => void; onWorkshop: () => void } = $props();
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
    <button onclick={onWorkshop}>🛠️ Workshop</button>
  </nav>
  <p class="meta">engine v{ENGINE_VERSION}</p>
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
  .meta {
    margin: 0;
    opacity: 0.5;
    font-size: 11px;
  }
</style>
