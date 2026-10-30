<script lang="ts">
  // A board symbol (see icons.ts) shown inline in text, outside the board.
  import type { Icon } from './icons';

  let { icon }: { icon: Icon } = $props();
</script>

{#if 'image' in icon}
  <img src={import.meta.env.BASE_URL + icon.image} alt="" />
{:else}
  <span>{icon.text}</span>
{/if}

<style>
  img {
    width: 1.2em;
    height: 1.2em;
    vertical-align: -0.25em;
  }
</style>
