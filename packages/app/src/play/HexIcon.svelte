<script lang="ts">
  // One board symbol, centred on (x, y): text/emoji, an image file, or a picture from the theme (a data URL).
  import type { Icon } from './icons';

  let { icon, x, y, size, faded = false }: { icon: Icon; x: number; y: number; size: number; faded?: boolean } = $props();
</script>

{#if 'image' in icon}
  <image
    href={icon.image.startsWith('data:') ? icon.image : import.meta.env.BASE_URL + icon.image}
    x={x - size / 2}
    y={y - size / 2}
    width={size}
    height={size}
    class:faded
  />
{:else}
  <text {x} {y} font-size={size} class:faded>{icon.text}</text>
{/if}

<style>
  image,
  text {
    pointer-events: none;
  }
  text {
    text-anchor: middle;
    dominant-baseline: central;
  }
  .faded {
    opacity: 0.45;
  }
</style>
