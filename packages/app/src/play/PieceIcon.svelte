<script lang="ts">
  // One of a faction's pieces as the board draws it, on its own: the faction's
  // picture standing on a base in its colour, or else the drawn shape (a circle
  // for the character, the mech and worker outlines, a square for a structure).
  // Keep in step with the piece snippet in Board.svelte.
  import type { Structure } from '@scythe/engine';
  import { isLight } from './ink';
  import { LABEL_Y, MECH, MEEPLE, STRUCTURE_LETTER } from './shapes';

  let { kind, color, initial, url }: { kind: 'character' | 'mech' | 'worker' | Structure; color: string; initial: string; url?: string } = $props();

  const figure = $derived(kind === 'character' || kind === 'mech');
  const dark = $derived(isLight(color));
  const w = $derived(figure ? 13 : 12);
  const h = $derived(figure ? 17 : 12);
</script>

<svg viewBox="-10 -11 20 20" aria-hidden="true">
  {#if url}
    <ellipse cx="0" cy={figure ? 7 : 5.5} rx="6" ry="2.2" fill={color} class="base" />
    <image href={url} x={-w / 2} y={(figure ? 7.5 : 6) - h} width={w} height={h} preserveAspectRatio="xMidYMax meet" class="art" />
  {:else if kind === 'character'}
    <circle r="6.5" fill={color} class="shape" />
    <text y={LABEL_Y.character} class:dark>{initial}</text>
  {:else if kind === 'mech'}
    <path d={MECH} fill={color} class="shape" />
    <text y={LABEL_Y.mech} class="small" class:dark>{initial}</text>
  {:else if kind === 'worker'}
    <path d={MEEPLE} fill={color} class="shape" />
  {:else}
    <rect x="-6" y="-6" width="12" height="12" fill={color} class="shape structure" class:light={dark} />
    <text y="2" class="small" class:dark>{STRUCTURE_LETTER[kind]}</text>
  {/if}
</svg>

<style>
  svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .shape {
    stroke: #1e1a16;
    stroke-width: 1;
    stroke-linejoin: round;
  }
  .structure {
    stroke: #fff;
  }
  .structure.light {
    stroke: #1e1a16;
  }
  .base {
    stroke: #1e1a16;
    stroke-width: 0.6;
  }
  .art {
    filter: drop-shadow(0 0.6px 0.8px rgb(0 0 0 / 0.6));
  }
  text {
    font-size: 8px;
    font-weight: 700;
    text-anchor: middle;
    fill: #fff;
  }
  text.small {
    font-size: 6px;
  }
  text.dark {
    fill: #1e1a16;
  }
</style>
