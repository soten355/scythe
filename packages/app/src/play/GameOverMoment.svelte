<script lang="ts">
  // The moment the game ends, before the final scores: the finishing star
  // drops in and lands with a shockwave, the player's row of stars lights up
  // one by one, and GAME OVER stamps in under it. Tap to go straight to the
  // scores. Only transforms and opacity animate (no blurs), so it stays
  // smooth on the phone.
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { inkOn } from './ink';

  let {
    name,
    color,
    stars,
    onDone,
  }: {
    /** Who placed the last star. */
    name: string;
    color: string;
    /** How many stars end the game (six). */
    stars: number;
    onDone: () => void;
  } = $props();

  const LENGTH = 4200;
  onMount(() => {
    const timer = setTimeout(onDone, LENGTH);
    return () => clearTimeout(timer);
  });

  // A five-pointed star, centred on 0,0.
  const STAR = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 0.42 : 1;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)}`;
  }).join(' ');
  const letters = 'GAME OVER'.split('');
</script>

<button class="moment" style:--c={color} style:--ink={inkOn(color)} onclick={onDone} aria-label="Game over: see the final scores" transition:fade={{ duration: 400 }}>
  <span class="rays" aria-hidden="true"></span>
  <span class="wave" aria-hidden="true"></span>
  <span class="wave late" aria-hidden="true"></span>
  <svg class="big-star" viewBox="-1.1 -1.1 2.2 2.2" aria-hidden="true">
    <polygon points={STAR} fill="var(--c)" stroke="#ffe9a8" stroke-width="0.06" stroke-linejoin="round" />
    <polygon points={STAR} fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="0.02" transform="scale(0.78)" />
  </svg>
  <span class="row" aria-hidden="true">
    {#each Array.from({ length: stars }) as _, i (i)}
      <svg class="small-star" viewBox="-1.1 -1.1 2.2 2.2" style:--i={i}><polygon points={STAR} /></svg>
    {/each}
  </span>
  <span class="title" aria-hidden="true">
    {#each letters as letter, i (i)}<span class="letter" style:--i={i}>{letter === ' ' ? ' ' : letter}</span>{/each}
  </span>
  <span class="who">{name} places the final star</span>
  <small class="tap">Tap for the final scores</small>
</button>

<style>
  .moment {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    overflow: hidden;
    border: none;
    padding: 0;
    font: inherit;
    color: var(--fg);
    background: radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--c) 35%, #1e1a16) 0%, #120f0c 70%);
    cursor: pointer;
  }
  /* Slowly turning light behind the star. */
  .rays {
    position: absolute;
    top: 42%;
    left: 50%;
    width: 160vmax;
    height: 160vmax;
    margin: -80vmax 0 0 -80vmax;
    background: repeating-conic-gradient(from 0deg, rgb(255 233 168 / 0.09) 0deg 8deg, transparent 8deg 20deg);
    opacity: 0;
    animation:
      appear 0.8s ease-out 0.5s forwards,
      turn 30s linear infinite;
  }
  .big-star {
    width: min(30vh, 30vw);
    height: min(30vh, 30vw);
    z-index: 1;
    opacity: 0;
    animation: drop 0.75s cubic-bezier(0.3, 1.5, 0.5, 1) 0.15s forwards;
  }
  /* The shockwave when it lands. */
  .wave {
    position: absolute;
    top: 42%;
    left: 50%;
    width: 40vmin;
    height: 40vmin;
    margin: -20vmin 0 0 -20vmin;
    border-radius: 50%;
    border: 3px solid #ffe9a8;
    opacity: 0;
    animation: wave 1.1s ease-out 0.75s forwards;
  }
  .wave.late {
    border-color: var(--c);
    animation-delay: 0.95s;
  }
  .row {
    display: flex;
    gap: 6px;
    z-index: 1;
  }
  .small-star {
    width: 22px;
    height: 22px;
    fill: var(--c);
    stroke: #ffe9a8;
    stroke-width: 0.08;
    opacity: 0.15;
    transform: scale(0.7);
    animation: light 0.35s ease-out calc(1.1s + var(--i) * 0.12s) forwards;
  }
  .title {
    z-index: 1;
    display: flex;
    font-size: clamp(34px, 9vh, 72px);
    font-weight: 900;
    letter-spacing: 0.08em;
    color: #ffe9a8;
    text-shadow:
      0 3px 0 #6b4a12,
      0 6px 18px rgb(0 0 0 / 0.6);
  }
  .letter {
    display: inline-block;
    white-space: pre;
    opacity: 0;
    transform: scale(2.4);
    animation: stamp 0.32s cubic-bezier(0.2, 1.6, 0.4, 1) calc(1.9s + var(--i) * 0.06s) forwards;
  }
  .who {
    z-index: 1;
    font-size: 16px;
    padding: 4px 14px;
    border-radius: 99px;
    background: var(--c);
    color: var(--ink);
    font-weight: 700;
    opacity: 0;
    animation: appear 0.5s ease-out 2.7s forwards;
  }
  .tap {
    position: absolute;
    bottom: calc(env(safe-area-inset-bottom) + 12px);
    opacity: 0;
    animation: appear 0.5s ease-out 3.2s forwards;
  }
  @keyframes appear {
    to {
      opacity: 1;
    }
  }
  @keyframes turn {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes drop {
    0% {
      opacity: 0;
      transform: translateY(-60vh) scale(2.2) rotate(-40deg);
    }
    60% {
      opacity: 1;
    }
    100% {
      opacity: 1;
      transform: none;
    }
  }
  @keyframes wave {
    0% {
      opacity: 0.9;
      transform: scale(0.4);
    }
    100% {
      opacity: 0;
      transform: scale(3.2);
    }
  }
  @keyframes light {
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @keyframes stamp {
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .rays,
    .big-star,
    .wave,
    .small-star,
    .letter,
    .who,
    .tap {
      animation-duration: 0.01s;
      animation-delay: 0s;
    }
  }
</style>
