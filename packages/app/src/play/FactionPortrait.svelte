<script lang="ts">
  // A faction's portrait of its character (set in the faction editor): round,
  // in a ring of the faction's colour. Nothing at all when it has none, so
  // places that show one look as they did before.
  import { factionPicture } from '../theme/current.svelte';

  let { factionId, color, size = 36 }: { factionId: string; color: string; size?: number } = $props();
  const picture = $derived(factionPicture(factionId, 'portrait'));
</script>

{#if picture}
  <img class="portrait" src={picture} alt="" aria-hidden="true" style:--c={color} style:--s="{size}px" />
{/if}

<style>
  .portrait {
    width: var(--s);
    height: var(--s);
    flex: none;
    border-radius: 50%;
    object-fit: cover;
    background: color-mix(in srgb, var(--c) 35%, #1e1a16);
    border: max(2px, calc(var(--s) / 18)) solid var(--c);
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.45);
    box-sizing: border-box;
  }
</style>
