<script lang="ts">
  // The opening menu: continue the last game, start a new one, pick a saved
  // game, or open one of the editors.
  import { ENGINE_VERSION } from '@scythe/engine';

  let {
    canContinue,
    savedCount,
    onContinue,
    onNewGame,
    onSaves,
  }: { canContinue: boolean; savedCount: number; onContinue: () => void; onNewGame: () => void; onSaves: () => void } = $props();
  const base = import.meta.env.BASE_URL;
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
  </nav>
  <nav class="tools">
    <span>Workshop</span>
    <a href="{base}editor.html">Map editor</a>
    <a href="{base}mats.html">Mat editor</a>
    <a href="{base}factions.html">Faction editor</a>
    <a href="{base}encounters.html">Encounter card editor</a>
    <a href="{base}factory.html">Factory card editor</a>
    <a href="{base}objectives.html">Objective card editor</a>
    <a href="{base}structure-bonuses.html">Structure bonus tile editor</a>
    <a href="{base}bot-check.html">Bot speed check</a>
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
    background: #3a3129;
    color: var(--fg);
    cursor: pointer;
  }
  button.primary {
    background: var(--accent);
    color: #1e1a16;
    font-weight: 700;
  }
  .tools {
    display: flex;
    gap: 14px;
    align-items: baseline;
    font-size: 13px;
  }
  .tools span {
    opacity: 0.6;
  }
  .tools a {
    color: var(--accent);
    text-decoration: none;
  }
  .meta {
    margin: 0;
    opacity: 0.5;
    font-size: 11px;
  }
</style>
