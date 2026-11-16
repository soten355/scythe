<script lang="ts">
  // A hex's terrain, marked clearly at its top when it's drawn with art (the
  // art alone can be hard to read): a small dark disc ringed in the terrain's
  // colour, holding the skin's own symbol picture or else a simple drawn one.
  // The drawn ones are this app's own: wheat, a pine, peaks, a snowflake, a
  // meeple (the village's people), waves and a factory roof.
  import type { Terrain } from '@scythe/engine';

  let { terrain, mark, x, y, size, color }: { terrain: Terrain; mark: { image: string } | 'drawn'; x: number; y: number; size: number; color: string } = $props();
</script>

<!-- Drawn in a 20-wide box centred on 0, scaled to `size`. -->
<g class="mark" transform="translate({x} {y}) scale({size / 20})">
  <circle r="9.4" class="disc" style:stroke={color} />
  {#if mark !== 'drawn'}
    <image href={mark.image} x="-7" y="-7" width="14" height="14" />
  {:else if terrain === 'farm'}
    <!-- Wheat: a stalk with grains on both sides. -->
    <path d="M0 6.5V-6.5" />
    <path d="M0 -4.5c-2.4 0-3.2-1.6-3.2-2.4c1.6 0 3.2.8 3.2 2.4zM0 -4.5c2.4 0 3.2-1.6 3.2-2.4c-1.6 0-3.2.8-3.2 2.4zM0 -0.5c-2.4 0-3.2-1.6-3.2-2.4c1.6 0 3.2.8 3.2 2.4zM0 -0.5c2.4 0 3.2-1.6 3.2-2.4c-1.6 0-3.2.8-3.2 2.4zM0 3.5c-2.4 0-3.2-1.6-3.2-2.4c1.6 0 3.2.8 3.2 2.4zM0 3.5c2.4 0 3.2-1.6 3.2-2.4c-1.6 0-3.2.8-3.2 2.4z" class="solid" />
  {:else if terrain === 'forest'}
    <!-- A pine: three tiers and a trunk. -->
    <path d="M0 -7L-3.5 -2.5H-1.8L-5 1.5H-2.5L-6 5.5H6L2.5 1.5H5L1.8 -2.5H3.5Z" class="solid" />
    <path d="M0 5.5V7.5" />
  {:else if terrain === 'mountain'}
    <!-- Two peaks. -->
    <path d="M-7.5 5.5L-2 -5L1.2 1L3 -1.8L7.5 5.5Z" class="solid" />
  {:else if terrain === 'tundra'}
    <!-- A snowflake: three crossing strokes with small barbs. -->
    <path d="M0 -7V7M-6.1 -3.5L6.1 3.5M-6.1 3.5L6.1 -3.5" />
    <path d="M-1.6 -5.6L0 -4.2L1.6 -5.6M-1.6 5.6L0 4.2L1.6 5.6M-5.6 -1.4L-3.6 -2.1L-4 -4.2M5.6 1.4L3.6 2.1L4 4.2M-5.6 1.4L-3.6 2.1L-4 4.2M5.6 -1.4L3.6 -2.1L4 -4.2" />
  {:else if terrain === 'village'}
    <!-- A meeple: the village's people. -->
    <circle cx="0" cy="-4.6" r="2.4" class="solid-fill" />
    <path d="M-1.6 -1.9H1.6Q5.8 -1.6 6.6 0.4Q6.8 1.6 5.4 1.6L2.6 1.2L4.6 6.4Q4.8 7.4 3.8 7.4H1.4L0 4.2L-1.4 7.4H-3.8Q-4.8 7.4 -4.6 6.4L-2.6 1.2L-5.4 1.6Q-6.8 1.6 -6.6 0.4Q-5.8 -1.6 -1.6 -1.9Z" class="solid" />
  {:else if terrain === 'lake'}
    <!-- Waves. -->
    <path d="M-6.5 -2.2q1.6-1.8 3.2 0t3.3 0t3.3 0t3.2 0M-6.5 2.4q1.6-1.8 3.2 0t3.3 0t3.3 0t3.2 0" />
  {:else}
    <!-- The Factory: a sawtooth roof and a chimney. -->
    <path d="M-7 6V-1L-3.5 -3.5V-1L0 -3.5V-1L3 -3.5V-7H5.5V6Z" class="solid" />
  {/if}
</g>

<style>
  .mark {
    pointer-events: none;
  }
  .disc {
    fill: rgb(22 18 14 / 0.78);
    stroke-width: 1.6;
  }
  path {
    fill: none;
    stroke: #fff;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  path.solid {
    fill: #fff;
    stroke-width: 0.6;
  }
  .solid-fill {
    fill: #fff;
  }
</style>
