<script lang="ts">
  // The settings screen, a pop-up from the main menu or the game's ☰ menu:
  // how long bots' moves stay on screen and how fast units move. Changes
  // take effect at once and are kept on this device.
  import { BOT_SPEEDS, MOVE_SPEEDS } from './settings';
  import { changeSettings, settings } from './settings-store.svelte';

  let { onClose }: { onClose: () => void } = $props();
  const botHint = $derived(BOT_SPEEDS.find((s) => s.id === settings.botSpeed)?.hint ?? '');
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onClose}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="popup" role="dialog" aria-label="Settings" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <div class="head">
      <h2>⚙️ Settings</h2>
      <button class="close" aria-label="Close" onclick={onClose}>✕</button>
    </div>

    <section>
      <h3>Bot speed</h3>
      <div class="choices" role="radiogroup" aria-label="Bot speed">
        {#each BOT_SPEEDS as s (s.id)}
          <button role="radio" aria-checked={settings.botSpeed === s.id} class:chosen={settings.botSpeed === s.id} onclick={() => changeSettings({ botSpeed: s.id })}>{s.label}</button>
        {/each}
      </div>
      <p class="hint">{botHint} Only for show: bots never play worse for it, and ⏭ Skip still hurries them on.</p>
    </section>

    <section>
      <h3>Units moving on the map</h3>
      <div class="choices" role="radiogroup" aria-label="Unit move speed">
        {#each MOVE_SPEEDS as s (s.ms)}
          <button role="radio" aria-checked={settings.moveMs === s.ms} class:chosen={settings.moveMs === s.ms} onclick={() => changeSettings({ moveMs: s.ms })}>{s.label}</button>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.55);
  }
  .popup {
    width: min(420px, calc(100% - 40px));
    max-height: calc(100% - 40px);
    overflow-y: auto;
    padding: 12px 16px 16px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--fg);
    font-size: 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    text-align: left;
  }
  .head {
    display: flex;
    align-items: center;
  }
  h2 {
    margin: 0;
    font-size: 17px;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--accent);
  }
  /* A finger-sized target (44px), pulled into the corner. */
  .close {
    margin: -10px -12px -10px auto;
    min-width: 44px;
    min-height: 44px;
    background: none;
    border: none;
    color: inherit;
    font-size: 20px;
    cursor: pointer;
    touch-action: manipulation;
  }
  .choices {
    display: flex;
    gap: 6px;
  }
  .choices button {
    flex: 1;
    min-height: 40px;
    font: inherit;
    border-radius: 7px;
    border: 1px solid var(--line);
    background: var(--raised);
    color: var(--fg);
    cursor: pointer;
    touch-action: manipulation;
  }
  .choices button.chosen {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
  }
  .hint {
    margin: 6px 0 0;
    font-size: 12px;
    opacity: 0.75;
  }
</style>
