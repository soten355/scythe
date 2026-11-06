<script lang="ts">
  // A fighter for the fight screen: the faction's own picture of its
  // character or mech (set in the faction editor; drawn facing right), or
  // else a pilot in a long coat with a pennant, or a riveted walker mech with
  // a cannon arm and a smokestack: original placeholder art in the faction's
  // colour, gently animated.
  import { factionPicture } from '../theme/current.svelte';

  let {
    kind,
    color,
    factionId,
    facing = 'right',
    broken = false,
    shadow = 'glow',
  }: {
    kind: 'character' | 'mech';
    color: string;
    /** Whose fighter: their own picture is used if they have one. */
    factionId?: string;
    facing?: 'left' | 'right';
    /** Beaten in a fight: still, scorched, cracked, smouldering. */
    broken?: boolean;
    /** A glow in the faction's colour (fights), or a soft shadow (the Codex). */
    shadow?: 'glow' | 'soft';
  } = $props();
  const picture = $derived(factionId ? factionPicture(factionId, kind) : undefined);
  // Gradient ids must be unique on the page.
  const id = `f${Math.random().toString(36).slice(2, 8)}`;
</script>

{#if picture}
  <img src={picture} alt="" class="fighter picture {kind}" class:soft={shadow === 'soft'} class:flip={facing === 'left'} class:broken style:--c={color} aria-hidden="true" />
{:else}
<svg viewBox="0 0 200 260" class="fighter {kind}" class:soft={shadow === 'soft'} class:flip={facing === 'left'} class:broken style:--c={color} aria-hidden="true">
  <defs>
    <linearGradient id="{id}-paint" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="color-mix(in srgb, {color} 80%, white)" />
      <stop offset="0.55" stop-color={color} />
      <stop offset="1" stop-color="color-mix(in srgb, {color} 45%, black)" />
    </linearGradient>
    <linearGradient id="{id}-steel" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#3b3a38" />
      <stop offset="0.45" stop-color="#7d7a73" />
      <stop offset="1" stop-color="#2a2927" />
    </linearGradient>
    <radialGradient id="{id}-glow">
      <stop offset="0" stop-color="#fff3c4" />
      <stop offset="0.5" stop-color="#ffb43a" />
      <stop offset="1" stop-color="#ff7a1a" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Ground shadow -->
  <ellipse cx="100" cy="248" rx="70" ry="9" fill="#000" opacity="0.45" />

  {#if kind === 'mech'}
    <g class="smoke">
      <circle cx="132" cy="40" r="9" />
      <circle cx="138" cy="24" r="12" />
      <circle cx="130" cy="6" r="15" />
    </g>
    <g class="body">
      <!-- Legs: thigh, piston, shin and a wide foot each -->
      {#each [{ x: 70, d: -1 }, { x: 130, d: 1 }] as leg (leg.x)}
        <g>
          <path d="M{leg.x - 12} 150 L{leg.x + 12} 150 L{leg.x + 9 + leg.d * 4} 192 L{leg.x - 9 + leg.d * 4} 192 Z" fill="url(#{id}-steel)" stroke="#161513" stroke-width="2" />
          <rect x={leg.x - 4 + leg.d * 4} y="158" width="8" height="30" fill="#bdb6a6" stroke="#161513" stroke-width="1.5" />
          <circle cx={leg.x + leg.d * 4} cy="194" r="9" fill="#2a2927" stroke="#161513" stroke-width="2" />
          <path d="M{leg.x - 10 + leg.d * 4} 196 L{leg.x + 10 + leg.d * 4} 196 L{leg.x + 12 + leg.d * 2} 232 L{leg.x - 12 + leg.d * 2} 232 Z" fill="url(#{id}-paint)" stroke="#161513" stroke-width="2" />
          <path d="M{leg.x - 26 + leg.d * 2} 246 L{leg.x - 18 + leg.d * 2} 230 L{leg.x + 18 + leg.d * 2} 230 L{leg.x + 28 + leg.d * 2} 246 Z" fill="#2a2927" stroke="#161513" stroke-width="2" />
        </g>
      {/each}
      <!-- Hip joint -->
      <rect x="62" y="138" width="76" height="16" rx="5" fill="url(#{id}-steel)" stroke="#161513" stroke-width="2" />
      <!-- Smokestack -->
      <rect x="122" y="44" width="16" height="34" fill="#2a2927" stroke="#161513" stroke-width="2" />
      <rect x="119" y="40" width="22" height="7" fill="#4a4844" stroke="#161513" stroke-width="2" />
      <!-- Hull: angled armour with a lighter top plate -->
      <path d="M48 76 L152 76 L166 104 L160 140 L40 140 L34 104 Z" fill="url(#{id}-paint)" stroke="#161513" stroke-width="2.5" />
      <path d="M56 76 L144 76 L150 90 L50 90 Z" fill="#fff" opacity="0.15" />
      <path d="M40 124 L160 124" stroke="#161513" stroke-width="1.5" opacity="0.6" />
      {#each [46, 66, 134, 154] as x (x)}<circle cx={x} cy="132" r="2" fill="#161513" opacity="0.7" />{/each}
      {#each [58, 142] as x (x)}<circle cx={x} cy="84" r="2" fill="#161513" opacity="0.7" />{/each}
      <!-- Porthole cockpit -->
      <circle cx="100" cy="106" r="19" fill="#2a2927" stroke="#161513" stroke-width="2.5" />
      <circle cx="100" cy="106" r="13" fill="url(#{id}-glow)" class="cockpit" />
      <path d="M92 99 A11 11 0 0 1 106 96" stroke="#fff" stroke-width="2" fill="none" opacity="0.7" />
      {#if broken}
        <path d="M100 106 L92 96 M100 106 L111 101 M100 106 L103 119 M100 106 L88 112" stroke="#161513" stroke-width="2" fill="none" />
        <path d="M60 80 L72 98 L66 112 M140 126 L128 112" stroke="#161513" stroke-width="2.5" fill="none" />
        <path d="M120 128 l6 -10 l-2 8 l6 -2 z" fill="#ffb43a" class="spark" />
      {/if}
      <!-- Claw arm (back) -->
      <g class="arm-back">
        <rect x="16" y="96" width="22" height="16" rx="4" fill="url(#{id}-steel)" stroke="#161513" stroke-width="2" />
        <path d="M18 110 L8 132 L16 134 L24 116 M30 110 L30 134 L37 133 L36 112" fill="#4a4844" stroke="#161513" stroke-width="2" />
      </g>
      <!-- Cannon arm (front) -->
      <g class="arm-front">
        <rect x="160" y="94" width="18" height="22" rx="4" fill="url(#{id}-steel)" stroke="#161513" stroke-width="2" />
        <rect x="170" y="100" width="28" height="10" fill="#2a2927" stroke="#161513" stroke-width="2" />
        <rect x="194" y="98" width="5" height="14" fill="#4a4844" stroke="#161513" stroke-width="1.5" />
      </g>
    </g>
  {:else}
    <!-- Pennant on a pole, planted beside the pilot -->
    <line x1="150" y1="30" x2="150" y2="246" stroke="#3a2a1a" stroke-width="5" stroke-linecap="round" />
    <circle cx="150" cy="28" r="5" fill="#c9a227" />
    <path class="pennant" d="M153 36 L196 50 L153 66 Z" fill="url(#{id}-paint)" stroke="#161513" stroke-width="2" />
    <g class="body">
      <!-- Boots and legs -->
      <path d="M78 196 L74 236 L60 244 L88 244 L92 200 Z" fill="#2a2420" stroke="#161513" stroke-width="2" />
      <path d="M110 196 L114 236 L106 244 L134 244 L124 200 Z" fill="#2a2420" stroke="#161513" stroke-width="2" />
      <!-- Long coat, flared at the hem -->
      <path d="M72 92 L128 92 L136 150 L148 212 L100 204 L52 212 L64 150 Z" fill="url(#{id}-paint)" stroke="#161513" stroke-width="2.5" />
      <path d="M100 96 L100 204" stroke="#161513" stroke-width="1.5" opacity="0.6" />
      {#each [112, 130, 148] as y (y)}<circle cx="106" cy={y} r="2.4" fill="#c9a227" />{/each}
      <!-- Belt -->
      <rect x="66" y="150" width="70" height="9" fill="#3a2a1a" stroke="#161513" stroke-width="1.5" />
      <rect x="96" y="149" width="10" height="11" fill="#c9a227" stroke="#161513" stroke-width="1.5" />
      <!-- Arms: one on the hip, one gripping the pole -->
      <path d="M72 96 L56 140 L66 150 L80 112" fill="url(#{id}-paint)" stroke="#161513" stroke-width="2" />
      <path d="M126 96 L146 116 L148 128 L138 126 L124 112" fill="url(#{id}-paint)" stroke="#161513" stroke-width="2" />
      <circle cx="147" cy="124" r="6" fill="#d9b48f" stroke="#161513" stroke-width="1.5" />
      <!-- Scarf, trailing behind -->
      <path class="scarf" d="M80 92 Q66 98 42 92 Q30 90 22 100 Q40 102 54 104 Q70 106 84 100 Z" fill="#c9a227" stroke="#161513" stroke-width="1.5" />
      <path d="M80 86 L122 86 L124 98 L78 98 Z" fill="#c9a227" stroke="#161513" stroke-width="1.5" />
      <!-- Head: face, cap with goggles -->
      <ellipse cx="101" cy="66" rx="17" ry="20" fill="#d9b48f" stroke="#161513" stroke-width="2" />
      <path d="M82 60 Q84 40 101 38 Q120 40 121 60 Z" fill="#3a2a1a" stroke="#161513" stroke-width="2" />
      <path d="M80 60 L124 60 L128 64 L78 64 Z" fill="#2a2420" stroke="#161513" stroke-width="1.5" />
      <circle cx="93" cy="52" r="6" fill="#7fb3c9" stroke="#161513" stroke-width="2" />
      <circle cx="109" cy="52" r="6" fill="#7fb3c9" stroke="#161513" stroke-width="2" />
      <path d="M99 52 L103 52" stroke="#161513" stroke-width="2" />
      <path d="M94 72 Q101 76 108 72" stroke="#161513" stroke-width="1.5" fill="none" />
      {#if broken}
        <path d="M89 48 L97 56 M107 47 L111 57 M105 52 L113 50" stroke="#161513" stroke-width="1.5" />
        <path d="M70 120 L84 132 L76 146 M122 168 L132 180" stroke="#161513" stroke-width="2" fill="none" />
      {/if}
    </g>
  {/if}
</svg>
{/if}

<style>
  .fighter {
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: drop-shadow(0 0 18px color-mix(in srgb, var(--c) 45%, transparent));
  }
  /* A soft shadow cast down and away, as if lit from the upper left. */
  .fighter.soft {
    filter: drop-shadow(6px 10px 12px rgb(0 0 0 / 0.45));
  }
  .flip {
    transform: scaleX(-1);
  }
  /* The faction's own picture: kept whole, standing on the ground line, breathing gently. */
  .picture {
    display: block;
    object-fit: contain;
    object-position: bottom;
    transform-origin: bottom;
    animation: breathe 3.2s ease-in-out infinite;
  }
  .picture.flip {
    animation-name: breathe-flipped;
  }
  .picture.broken {
    animation: none;
  }
  @keyframes breathe {
    50% {
      transform: scaleY(1.015);
    }
  }
  @keyframes breathe-flipped {
    from,
    to {
      transform: scaleX(-1);
    }
    50% {
      transform: scaleX(-1) scaleY(1.015);
    }
  }
  /* A beaten fighter: no idle motion, scorched and dark. */
  .broken {
    filter: grayscale(0.6) brightness(0.55) drop-shadow(0 0 6px rgb(0 0 0 / 0.6));
  }
  .broken .body,
  .broken .cockpit,
  .broken .pennant,
  .broken .scarf {
    animation: none;
  }
  .broken .cockpit {
    opacity: 0.15;
  }
  .broken .smoke {
    display: none;
  }
  .spark {
    animation: spark 0.9s steps(2) infinite;
  }

  @keyframes spark {
    50% {
      opacity: 0;
    }
  }

  .body {
    animation: breathe 3.2s ease-in-out infinite;
    transform-origin: 100px 246px;
  }
  .mech .body {
    animation-name: idle;
  }
  @keyframes breathe {
    50% {
      transform: scaleY(1.012) translateY(-1px);
    }
  }
  @keyframes idle {
    50% {
      transform: translateY(-2.5px);
    }
  }
  .cockpit {
    animation: glow 2.4s ease-in-out infinite;
  }
  @keyframes glow {
    50% {
      opacity: 0.65;
    }
  }
  .smoke circle {
    fill: #9a948a;
    opacity: 0;
    animation: smoke 3s ease-out infinite;
  }
  .smoke circle:nth-child(2) {
    animation-delay: 1s;
  }
  .smoke circle:nth-child(3) {
    animation-delay: 2s;
  }
  @keyframes smoke {
    0% {
      opacity: 0.55;
      transform: translate(0, 20px) scale(0.5);
    }
    100% {
      opacity: 0;
      transform: translate(-10px, -20px) scale(1.2);
    }
  }
  .smoke circle,
  .pennant,
  .scarf {
    transform-box: fill-box;
  }
  .pennant {
    transform-origin: left center;
    animation: wave 1.8s ease-in-out infinite;
  }
  .scarf {
    transform-origin: right center;
    animation: wave 2.3s ease-in-out infinite;
  }
  @keyframes wave {
    50% {
      transform: skewY(-6deg) scaleX(0.94);
    }
  }
</style>
