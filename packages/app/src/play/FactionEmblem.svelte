<script lang="ts">
  // A faction's crest: its own picture (set in the faction editor), or else the
  // drawn one in its colour.
  import type { Faction } from '@scythe/engine';
  import { factionPicture } from '../theme/current.svelte';
  import CrestDrawn from './CrestDrawn.svelte';

  let { faction }: { faction: Faction } = $props();
  const picture = $derived(factionPicture(faction.id, 'crest'));
</script>

{#if picture}
  <img src={picture} alt="" aria-hidden="true" />
{:else}
  <CrestDrawn {faction} />
{/if}

<style>
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
