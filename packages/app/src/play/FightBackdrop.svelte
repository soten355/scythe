<script lang="ts">
  // The fight screen's background, matched to the hex being fought over:
  // a misty pine forest, a snowy tundra under an aurora, mountain peaks at
  // alpenglow, golden farmland with a windmill, the smoky Factory, or a
  // misty lake (for Seaworthy and Submerge fights on the water). The
  // fighters stand on the ground line (70% down); the scenery above it is
  // anchored to that line and the ground below it to its top, so the two
  // always meet whatever the screen shape. Original placeholder art, used
  // unless the theme has a picture for this terrain (set in the theme editor).
  import { backdropNow } from '../theme/current.svelte';
  import { backdropFor, rand, ridge, treeline } from './scenery';

  /** `picture`: one to show in place of the terrain's (the Codex's faction pages). */
  let { terrain, picture: chosen }: { terrain: string; picture?: string } = $props();
  const kind = $derived(backdropFor(terrain));
  const picture = $derived(chosen ?? backdropNow(terrain));

  // Scenery that never changes, worked out once.
  const forest = {
    far: treeline({ base: 400, count: 30, min: 120, max: 190, seed: 1 }),
    mid: treeline({ base: 405, count: 18, min: 190, max: 270, seed: 2 }),
    near: treeline({ base: 410, count: 7, min: 300, max: 390, seed: 3 }),
  };
  const tundra = {
    peaks: ridge({ base: 400, height: 210, points: 9, seed: 11 }),
    hills: ridge({ base: 400, height: 70, points: 6, seed: 12, sharp: false }),
    pines: treeline({ base: 402, count: 9, min: 40, max: 80, seed: 13 }),
  };
  const mountain = {
    far: ridge({ base: 400, height: 300, points: 7, seed: 21 }),
    mid: ridge({ base: 400, height: 220, points: 11, seed: 22 }),
    near: ridge({ base: 400, height: 110, points: 14, seed: 23 }),
  };
  const lake = {
    far: ridge({ base: 400, height: 110, points: 6, seed: 91, sharp: false }),
    shore: ridge({ base: 400, height: 34, points: 9, seed: 92, sharp: false }),
  };
  /** Reeds in clumps at the left and right edges: [x, height]. */
  const reeds = Array.from({ length: 24 }, (_, i) => [i < 12 ? i * 9 : 1000 - (i - 12) * 9 - 6, 60 + rand(94 + i) * 70] as const);
  const farm = {
    far: ridge({ base: 400, height: 90, points: 5, seed: 31, sharp: false }),
    near: ridge({ base: 400, height: 50, points: 4, seed: 32, sharp: false }),
  };
  /** Tufts, stalks or rocks scattered on the ground: [x, y, size]. */
  const scatter = (n: number, seed: number) => Array.from({ length: n }, (_, i) => [rand(seed + i) * 1000, 10 + rand(seed + i * 5) * 180, 0.6 + rand(seed + i * 9) * 0.8] as const);
  const tufts = scatter(40, 41);
  const rocks = scatter(14, 51);
  const ripples = scatter(18, 93);
  // Falling snow / rising embers / fireflies: [left %, delay s, duration s, size px].
  const motes = (n: number, seed: number) => Array.from({ length: n }, (_, i) => [rand(seed + i) * 100, rand(seed + i * 3) * 8, 5 + rand(seed + i * 7) * 6, 2 + rand(seed + i * 11) * 4] as const);
  const snow = motes(60, 61);
  const embers = motes(24, 71);
  const flies = motes(14, 81);
  /** Factory windows: [x, y]. */
  const WINDOWS: [number, number][] = [[30, 320], [100, 320], [170, 320], [420, 310], [480, 310], [540, 310], [600, 310], [660, 320], [740, 320], [820, 320], [900, 320]];
  /** Factory chimneys: [x, height]. */
  const CHIMNEYS: [number, number][] = [[140, 120], [300, 170], [690, 150], [860, 110]];
</script>

{#if picture}
  <!-- The theme's picture: its ground line (70% down) stays where the fighters stand, whatever the screen shape. -->
  <div class="backdrop picture" aria-hidden="true"><img src={picture} alt="" /></div>
{:else}
<div class="backdrop {kind}" aria-hidden="true">
  <div class="sky"></div>

  {#if kind === 'forest'}
    <div class="sun"></div>
    <div class="rays"><i></i><i></i><i></i></div>
    <svg class="horizon" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMax slice">
      <path d={forest.far} fill="#3d5a48" opacity="0.8" />
      <rect y="300" width="1000" height="100" fill="url(#fog)" />
      <path d={forest.mid} fill="#22382c" />
      <path d={forest.near} fill="#13221a" />
      <defs>
        <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c8d8b8" stop-opacity="0" />
          <stop offset="1" stop-color="#c8d8b8" stop-opacity="0.35" />
        </linearGradient>
      </defs>
    </svg>
    <div class="fog"></div>
    <svg class="ground" viewBox="0 0 1000 200" preserveAspectRatio="xMidYMin slice">
      <rect width="1000" height="200" fill="url(#moss)" />
      {#each tufts as [x, y, s], i (i)}
        <path d="M{x} {y} q{-6 * s} {-14 * s} {-12 * s} {-16 * s} M{x} {y} q{1 * s} {-16 * s} {2 * s} {-20 * s} M{x} {y} q{6 * s} {-12 * s} {12 * s} {-15 * s}" stroke="#2f4a2a" stroke-width="2" fill="none" />
      {/each}
      <defs>
        <linearGradient id="moss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#26381f" />
          <stop offset="1" stop-color="#0b120a" />
        </linearGradient>
      </defs>
    </svg>
    {#each flies as [left, delay, dur], i (i)}
      <i class="firefly" style:left="{left}%" style:top="{40 + (i % 5) * 9}%" style:animation-delay="{-delay}s" style:animation-duration="{dur}s"></i>
    {/each}
  {:else if kind === 'tundra'}
    <svg class="aurora" viewBox="0 0 1000 300" preserveAspectRatio="none">
      <defs>
        <linearGradient id="aur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7affc8" stop-opacity="0" />
          <stop offset="0.6" stop-color="#5affb0" stop-opacity="0.55" />
          <stop offset="1" stop-color="#4ad0ff" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path class="band a" d="M-50 120 C150 40 300 200 500 110 S850 60 1050 140 L1050 230 C850 160 700 260 500 200 S150 140 -50 220 Z" fill="url(#aur)" />
      <path class="band b" d="M-50 60 C200 140 350 20 550 80 S900 160 1050 70 L1050 130 C880 200 700 90 550 140 S200 190 -50 120 Z" fill="url(#aur)" opacity="0.6" />
    </svg>
    <svg class="horizon" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMax slice">
      <path d={tundra.peaks} fill="#6d86a3" />
      <path d={tundra.peaks} fill="url(#caps)" />
      <path d={tundra.hills} fill="#c8d6e2" />
      <path d={tundra.pines} fill="#2a3a48" />
      <defs>
        <linearGradient id="caps" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.25" stop-color="#f4f8fc" />
          <stop offset="0.5" stop-color="#f4f8fc" stop-opacity="0" />
        </linearGradient>
      </defs>
    </svg>
    <svg class="ground" viewBox="0 0 1000 200" preserveAspectRatio="xMidYMin slice">
      <rect width="1000" height="200" fill="url(#snowfield)" />
      {#each rocks as [x, y, s], i (i)}
        <ellipse cx={x} cy={y} rx={14 * s} ry={4 * s} fill="#9db0c2" opacity="0.6" />
      {/each}
      <defs>
        <linearGradient id="snowfield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d7e3ec" />
          <stop offset="0.5" stop-color="#93a8bb" />
          <stop offset="1" stop-color="#3a4a5a" />
        </linearGradient>
      </defs>
    </svg>
    {#each snow as [left, delay, dur, size], i (i)}
      <i class="flake" style:left="{left}%" style:width="{size}px" style:animation-delay="{-delay}s" style:animation-duration="{dur + 3}s"></i>
    {/each}
  {:else if kind === 'mountain'}
    <div class="sun"></div>
    <div class="clouds"><i></i><i></i><i></i></div>
    <svg class="horizon" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMax slice">
      <path d={mountain.far} fill="#7a5a78" opacity="0.75" />
      <path d={mountain.mid} fill="#4a3a48" />
      <path d={mountain.mid} fill="url(#glow)" />
      <path d={mountain.near} fill="#2a2228" />
      <defs>
        <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.1" stop-color="#ffb08a" stop-opacity="0.55" />
          <stop offset="0.4" stop-color="#ffb08a" stop-opacity="0" />
        </linearGradient>
      </defs>
    </svg>
    <svg class="bird" viewBox="0 0 40 14"><path d="M0 8 Q10 0 20 8 Q30 0 40 8 Q30 4 20 12 Q10 4 0 8 Z" fill="#1a1418" /></svg>
    <svg class="ground" viewBox="0 0 1000 200" preserveAspectRatio="xMidYMin slice">
      <rect width="1000" height="200" fill="url(#scree)" />
      {#each rocks as [x, y, s], i (i)}
        <path d="M{x - 20 * s} {y} L{x - 8 * s} {y - 14 * s} L{x + 10 * s} {y - 10 * s} L{x + 22 * s} {y} Z" fill="#4a403c" stroke="#1a1614" stroke-width="1.5" />
      {/each}
      <defs>
        <linearGradient id="scree" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3e3432" />
          <stop offset="1" stop-color="#141010" />
        </linearGradient>
      </defs>
    </svg>
  {:else if kind === 'farm'}
    <div class="sun"></div>
    <svg class="horizon" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMax slice">
      <path d={farm.far} fill="#8a7a3a" />
      <path d={farm.far} fill="url(#rows)" opacity="0.35" />
      <!-- A windmill on the far hill -->
      <g transform="translate(760 300)">
        <path d="M-16 40 L-10 -40 L10 -40 L16 40 Z" fill="#4a3424" />
        <path d="M-12 -40 L0 -54 L12 -40 Z" fill="#3a2418" />
        <g class="blades">
          {#each [0, 90, 180, 270] as a (a)}
            <path transform="rotate({a})" d="M0 0 L4 -2 L6 -60 L-4 -60 L-2 -4 Z" fill="#5a4030" stroke="#2a1a10" stroke-width="1.5" />
          {/each}
          <circle r="4" fill="#2a1a10" />
        </g>
      </g>
      <path d={farm.near} fill="#a8862e" />
      <!-- Haystacks and a fence -->
      {#each [180, 250, 610] as x, i (x)}
        <path d="M{x - 26 + i * 4} 392 Q{x} {340 + i * 6} {x + 26 - i * 4} 392 Z" fill="#c9a040" stroke="#6a4a18" stroke-width="2" />
      {/each}
      <path d="M0 384 H1000 M0 372 H1000" stroke="#4a3420" stroke-width="3" />
      {#each Array.from({ length: 21 }, (_, i) => i * 50) as x (x)}
        <rect x={x} y="364" width="5" height="34" fill="#4a3420" />
      {/each}
      <defs>
        <pattern id="rows" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
          <rect width="12" height="24" fill="#3a5a1a" />
        </pattern>
      </defs>
    </svg>
    <svg class="ground" viewBox="0 0 1000 200" preserveAspectRatio="xMidYMin slice">
      <rect width="1000" height="200" fill="url(#wheat)" />
      {#each tufts as [x, y, s], i (i)}
        <g class="stalk" style:animation-delay="{-(i % 7) * 0.4}s" style:transform-origin="{x}px {y}px">
          <path d="M{x} {y} L{x + 3 * s} {y - 26 * s}" stroke="#8a6a24" stroke-width="2" />
          <ellipse cx={x + 3.5 * s} cy={y - 30 * s} rx={2.5 * s} ry={6 * s} fill="#d8b050" />
        </g>
      {/each}
      <defs>
        <linearGradient id="wheat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#6e5420" />
          <stop offset="1" stop-color="#22190a" />
        </linearGradient>
      </defs>
    </svg>
  {:else if kind === 'lake'}
    <div class="sun"></div>
    <svg class="horizon" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMax slice">
      <path d={lake.far} fill="#5a6e7e" opacity="0.7" />
      <path d={lake.shore} fill="#2e3e3a" />
      <!-- A little jetty on the far shore -->
      <path d="M690 392 H790 V386 H690 Z" fill="#3a2a1e" />
      {#each [700, 730, 760, 785] as x (x)}<rect x={x} y="386" width="4" height="14" fill="#2a1e14" />{/each}
      <rect y="380" width="1000" height="20" fill="url(#mist)" />
      <defs>
        <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d8e4ea" stop-opacity="0" />
          <stop offset="1" stop-color="#d8e4ea" stop-opacity="0.5" />
        </linearGradient>
      </defs>
    </svg>
    <div class="fog"></div>
    <svg class="ground" viewBox="0 0 1000 200" preserveAspectRatio="xMidYMin slice">
      <rect width="1000" height="200" fill="url(#water)" />
      <!-- The sun's reflection, broken up by the ripples -->
      {#each [0, 1, 2, 3, 4, 5, 6, 7] as i (i)}
        <rect class="glint" x={500 - (40 - i * 3)} y={6 + i * 14} width={80 - i * 6} height="3" rx="1.5" fill="#ffe2b0" style:animation-delay="{-i * 0.3}s" />
      {/each}
      {#each ripples as [x, y, s], i (i)}
        <ellipse class="ripple" cx={x} cy={y} rx={30 * s} ry={3 * s} style:animation-delay="{-(i % 6) * 0.7}s" />
      {/each}
      <!-- Reeds at the water's edge, both sides -->
      {#each reeds as [x, h], i (i)}
        <g class="reed" style:transform-origin="{x}px 200px" style:animation-delay="{-(i % 5) * 0.5}s">
          <path d="M{x} 200 Q{x + 3} {200 - h / 2} {x + 6} {200 - h}" stroke="#2a3a26" stroke-width="3" fill="none" />
          {#if i % 3 === 0}<ellipse cx={x + 6} cy={200 - h + 8} rx="3" ry="9" fill="#5a3a22" />{/if}
        </g>
      {/each}
      <defs>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7a98a8" />
          <stop offset="0.4" stop-color="#3e5a6c" />
          <stop offset="1" stop-color="#14222c" />
        </linearGradient>
      </defs>
    </svg>
  {:else}
    <svg class="horizon" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMax slice">
      <!-- Chimneys with smoke, sawtooth sheds, a great gear, glowing windows -->
      {#each CHIMNEYS as [x, h], i (x)}
        <g class="plume" style:animation-delay="{-i * 1.1}s">
          {#each [0, 1, 2] as k (k)}<circle cx={x + 12 + k * 14} cy={400 - h - 60 - k * 30} r={18 + k * 8} fill="#3a2e2c" opacity="0.7" />{/each}
        </g>
        <rect x={x} y={400 - h - 40} width="24" height={h + 40} fill="#2a1e1c" />
        <rect x={x - 4} y={400 - h - 46} width="32" height="8" fill="#3a2a26" />
      {/each}
      <g class="gear" style:transform-origin="520px 250px">
        <circle cx="520" cy="250" r="78" fill="none" stroke="#2e2220" stroke-width="22" stroke-dasharray="20 14" />
        <circle cx="520" cy="250" r="58" fill="#2e2220" />
        <circle cx="520" cy="250" r="16" fill="#1a1210" />
      </g>
      <path d="M0 400 V300 L60 270 V300 L120 270 V300 L180 270 V300 L240 270 V300 L300 300 V400 Z" fill="#1e1614" />
      <path d="M620 400 V290 L690 260 V290 L760 260 V290 L830 260 V290 L900 260 V290 L1000 290 V400 Z" fill="#1e1614" />
      <rect x="380" y="290" width="270" height="110" fill="#241a18" />
      {#each WINDOWS as [x, y], i (i)}
        <rect class="window" x={x} y={y} width="28" height="18" fill="#ffb040" style:animation-delay="{-rand(90 + i) * 3}s" />
      {/each}
      <path d="M0 360 H1000" stroke="#3a2a26" stroke-width="8" />
      <path d="M0 360 H1000" stroke="#5a443c" stroke-width="2" />
    </svg>
    <svg class="ground" viewBox="0 0 1000 200" preserveAspectRatio="xMidYMin slice">
      <rect width="1000" height="200" fill="url(#iron)" />
      {#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as i (i)}
        <path d="M{i * 100} 0 L{i * 100 - 60 + i * 12} 200" stroke="#0e0b0a" stroke-width="2" opacity="0.7" />
      {/each}
      <path d="M0 50 H1000 M0 120 H1000" stroke="#0e0b0a" stroke-width="2" opacity="0.6" />
      <defs>
        <linearGradient id="iron" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3a302c" />
          <stop offset="1" stop-color="#100c0b" />
        </linearGradient>
      </defs>
    </svg>
    {#each embers as [left, delay, dur, size], i (i)}
      <i class="ember" style:left="{left}%" style:width="{size}px" style:animation-delay="{-delay}s" style:animation-duration="{dur}s"></i>
    {/each}
  {/if}
</div>
{/if}

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .backdrop > * {
    position: absolute;
  }
  .picture {
    background: #1e1a16;
  }
  .picture img {
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 70%;
  }
  .sky {
    inset: 0;
  }
  .horizon {
    left: 0;
    top: 0;
    width: 100%;
    height: 70%;
  }
  .ground {
    left: 0;
    bottom: 0;
    width: 100%;
    height: 30%;
  }
  .sun {
    left: 50%;
    top: 52%;
    width: 22cqh;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border-radius: 50%;
  }

  /* Forest: green-gold dusk, light shafts, fog, fireflies. */
  .forest .sky {
    background: linear-gradient(#0e1c1a 0%, #24402f 40%, #8ea05a 66%, #d8c878 70%);
  }
  .forest .sun {
    top: 60%;
    background: radial-gradient(#fff4c0, #e8d070 50%, transparent 70%);
    opacity: 0.7;
  }
  .rays {
    inset: 0;
  }
  .rays i {
    position: absolute;
    top: -10%;
    width: 9%;
    height: 90%;
    background: linear-gradient(rgb(255 250 200 / 0.18), transparent);
    transform: skewX(-18deg);
    animation: shimmer 6s ease-in-out infinite alternate;
  }
  .rays i:nth-child(1) { left: 22%; }
  .rays i:nth-child(2) { left: 48%; width: 6%; animation-delay: -2s; }
  .rays i:nth-child(3) { left: 70%; width: 11%; animation-delay: -4s; }
  @keyframes shimmer {
    from { opacity: 0.4; }
    to { opacity: 1; }
  }
  .fog {
    left: -20%;
    right: -20%;
    top: 52%;
    height: 22%;
    background: radial-gradient(ellipse at center, rgb(200 216 184 / 0.28), transparent 65%);
    animation: drift 16s ease-in-out infinite alternate;
  }
  .firefly {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #f6ff9a;
    box-shadow: 0 0 8px 3px rgb(230 255 120 / 0.6);
    animation: wander ease-in-out infinite alternate;
  }
  @keyframes wander {
    0% { opacity: 0; transform: translate(0, 0); }
    40% { opacity: 1; }
    100% { opacity: 0.2; transform: translate(30px, -24px); }
  }

  /* Tundra: cold blue sky, an aurora, falling snow. */
  .tundra .sky {
    background: linear-gradient(#0c1426 0%, #1f3456 40%, #6a8aae 62%, #c8d8e6 70%);
  }
  .aurora {
    left: 0;
    top: 0;
    width: 100%;
    height: 55%;
    filter: blur(6px);
  }
  .band {
    animation: sway 9s ease-in-out infinite alternate;
  }
  .band.b {
    animation-duration: 13s;
    animation-direction: alternate-reverse;
  }
  @keyframes sway {
    to { transform: translateX(-40px) scaleY(1.15); }
  }
  .flake {
    top: -3%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: #fff;
    opacity: 0.85;
    animation: fall linear infinite;
  }
  @keyframes fall {
    to { transform: translate(-40px, 105cqh); }
  }

  /* Mountain: alpenglow, drifting clouds, a circling bird. */
  .mountain .sky {
    background: linear-gradient(#1e1428 0%, #5a3048 38%, #d07a5a 60%, #f6c08a 70%);
  }
  .mountain .sun {
    top: 50%;
    background: radial-gradient(#ffe8c0, #f8a060 55%, transparent 70%);
  }
  .clouds {
    inset: 0;
  }
  .clouds i {
    position: absolute;
    height: 5cqh;
    border-radius: 50%;
    background: rgb(255 200 180 / 0.35);
    filter: blur(4px);
    animation: drift linear infinite alternate;
  }
  .clouds i:nth-child(1) { left: 8%; top: 14%; width: 30%; animation-duration: 30s; }
  .clouds i:nth-child(2) { left: 55%; top: 24%; width: 24%; animation-duration: 24s; animation-delay: -8s; }
  .clouds i:nth-child(3) { left: 30%; top: 34%; width: 18%; animation-duration: 20s; animation-delay: -4s; }
  .bird {
    width: 26px;
    left: 30%;
    top: 22%;
    animation: soar 18s ease-in-out infinite;
  }
  @keyframes soar {
    25% { transform: translate(18cqw, -4cqh) scale(0.8); }
    50% { transform: translate(34cqw, 2cqh) scale(0.6); }
    75% { transform: translate(14cqw, 6cqh) scale(0.85); }
  }

  /* Farm: golden evening, a turning windmill, swaying wheat. */
  .farm .sky {
    background: linear-gradient(#2e2244 0%, #8a4e5a 36%, #e8925a 58%, #ffd890 70%);
  }
  .farm .sun {
    top: 56%;
    width: 30cqh;
    background: radial-gradient(#fff6d8, #ffc860 50%, transparent 70%);
  }
  .blades {
    animation: spin 9s linear infinite;
  }
  .stalk {
    animation: bend 3.4s ease-in-out infinite alternate;
  }
  @keyframes bend {
    to { transform: rotate(6deg); }
  }

  /* Lake: misty morning water, a shimmering reflection, ripples and reeds. */
  .lake .sky {
    background: linear-gradient(#24304a 0%, #6a7a96 40%, #e0b48a 62%, #f4dcb8 70%);
  }
  .lake .sun {
    top: 60%;
    background: radial-gradient(#fff4dc, #ffcc8a 50%, transparent 70%);
    opacity: 0.85;
  }
  .lake .fog {
    top: 60%;
    background: radial-gradient(ellipse at center, rgb(230 236 240 / 0.35), transparent 65%);
  }
  .glint {
    animation: shimmer 1.6s ease-in-out infinite alternate;
  }
  .ripple {
    fill: none;
    stroke: rgb(220 236 244 / 0.35);
    stroke-width: 1.5;
    transform-box: fill-box;
    transform-origin: center;
    animation: ripple 4.2s ease-out infinite;
  }
  @keyframes ripple {
    0% { transform: scale(0.4); opacity: 0; }
    30% { opacity: 1; }
    100% { transform: scale(1.4); opacity: 0; }
  }
  .reed {
    animation: bend 3s ease-in-out infinite alternate;
  }

  /* Factory: smog and furnace glow, smoke plumes, a turning gear, embers. */
  .factory .sky {
    background: linear-gradient(#120c0e 0%, #3a1e1a 40%, #8a3a1e 62%, #d0682a 70%);
  }
  .plume {
    animation: puff 4.4s ease-in-out infinite;
  }
  @keyframes puff {
    50% { transform: translate(-10px, -12px); opacity: 0.75; }
  }
  .gear {
    animation: spin 24s linear infinite;
  }
  .window {
    animation: flicker 3s steps(3) infinite;
  }
  @keyframes flicker {
    50% { opacity: 0.6; }
  }
  .ember {
    bottom: 0;
    aspect-ratio: 1;
    border-radius: 50%;
    background: #ffb040;
    box-shadow: 0 0 6px 2px rgb(255 140 40 / 0.7);
    animation: float ease-out infinite;
  }
  @keyframes float {
    0% { opacity: 0; transform: translate(0, 0); }
    15% { opacity: 1; }
    100% { opacity: 0; transform: translate(30px, -80cqh); }
  }

  @keyframes drift {
    to { transform: translateX(8%); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
