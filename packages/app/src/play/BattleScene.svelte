<script lang="ts">
  // A fight plays out once both sides have locked in. What each side played
  // is revealed, the two lead fighters charge and collide, a dust cloud
  // swallows them, and when it clears the winner is standing and the loser
  // lies wrecked on the ground. Then a big banner names the winner. Tap to
  // skip ahead; tap again (or Continue) to go back to the map.
  import { onMount } from 'svelte';
  import { lineup, type Battle } from './fight';
  import FighterArt from './FighterArt.svelte';

  let { battle, onDone }: { battle: Battle; onDone: () => void } = $props();

  /** The scene's beats, in order, and when each starts (ms). */
  const BEATS = ['reveal', 'charge', 'impact', 'aftermath', 'clearing', 'verdict'] as const;
  const AT = [0, 1500, 1950, 2500, 3100, 3900];
  let beat = $state(0);
  const from = (name: (typeof BEATS)[number]) => beat >= BEATS.indexOf(name);

  let timers: ReturnType<typeof setTimeout>[] = [];
  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) beat = BEATS.length - 1;
    else timers = AT.slice(1).map((ms, i) => setTimeout(() => (beat = Math.max(beat, i + 1)), ms));
    return () => timers.forEach(clearTimeout);
  });

  /** Tap: skip to the verdict, or once it's up, go back to the map. */
  function tap() {
    if (beat < BEATS.length - 1) {
      timers.forEach(clearTimeout);
      beat = BEATS.length - 1;
    } else onDone();
  }

  const winner = $derived(battle[battle.winner]);
  const sides = $derived([
    { s: battle.attacker, side: 'left' as const, won: battle.winner === 'attacker' },
    { s: battle.defender, side: 'right' as const, won: battle.winner === 'defender' },
  ]);

  // Dust puffs around the point of impact: [x, y] offsets in % of the cloud, size, delay (ms).
  const PUFFS: [number, number, number, number][] = [
    [0, 0, 1.2, 0], [-30, 10, 1, 40], [30, 8, 1, 60], [-18, -22, 0.9, 90], [20, -24, 0.95, 70],
    [-44, 24, 0.8, 120], [46, 22, 0.85, 110], [0, 30, 1, 30], [-8, -40, 0.75, 150], [12, 38, 0.7, 160],
    [-58, 4, 0.65, 180], [60, -2, 0.7, 170], [36, -40, 0.6, 200], [-36, -38, 0.6, 210],
  ];
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="scene" class:shake={from('impact') && !from('aftermath')} role="button" tabindex="0" aria-label="Skip" onclick={tap}>
  {#each sides as { s, side, won } (side)}
    {@const fallen = !won && from('aftermath')}
    {@const group = lineup(s)}
    <!-- The whole side charges together: the lead in front, the rest close behind it. -->
    <div class="slot {side}" class:charging={from('charge') && !from('aftermath')} class:standing={won && from('aftermath')} class:fallen style:--c={s.color} style:--n={group.length - 1}>
      {#each group as kind, i (i)}
        <div class="member" class:back={i > 0} style:--i={i} style:z-index={-i}>
          <div class="figure" class:down={fallen}>
            <FighterArt {kind} color={s.color} factionId={s.factionId} facing={side === 'left' ? 'right' : 'left'} broken={fallen} />
          </div>
          {#if fallen}
            <div class="wreck-smoke" aria-hidden="true"><i></i><i></i><i></i></div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- What they played: power and each card flip in, then the total. -->
    <div class="tally {side}" class:won={from('verdict') && won} class:lost={from('verdict') && !won} style:--c={s.color}>
      <h2>{s.name}</h2>
      <div class="sum">
        <span class="chip power" style:--d="0ms">⚡ {s.power}</span>
        {#each s.cards as card, i (i)}
          <span class="plus">+</span>
          <span class="chip card" style:--d="{250 + i * 200}ms">{card}</span>
        {/each}
        <span class="plus">=</span>
        <span class="total" style:--d="{450 + s.cards.length * 200}ms">{s.total}</span>
      </div>
    </div>
  {/each}

  {#if from('impact') && !from('verdict')}
    <div class="flash" aria-hidden="true"></div>
    <div class="dust" aria-hidden="true">
      {#each PUFFS as [x, y, size, delay], i (i)}
        <i style:--x="{x}%" style:--y="{y}%" style:--s={size} style:--d="{delay}ms"></i>
      {/each}
    </div>
  {/if}

  {#if from('verdict')}
    <div class="verdict" style:--c={winner.color}>
      <p class="label">Victory</p>
      <p class="who">{winner.name} wins!</p>
      <p class="how">
        {battle.attacker.total} to {battle.defender.total}{battle.winner === 'attacker' && battle.attacker.total === battle.defender.total ? ' (ties go to the attacker)' : ''}
        <button class="go" onclick={(e) => (e.stopPropagation(), onDone())}>Continue</button>
      </p>
    </div>
  {:else}
    <p class="skip">Tap to skip</p>
  {/if}
</div>

<style>
  .scene {
    position: absolute;
    inset: 0;
    z-index: 2;
    cursor: pointer;
    outline: none;
  }
  .shake {
    animation: shake 0.45s linear;
  }
  @keyframes shake {
    20% { transform: translate(-6px, 3px); }
    40% { transform: translate(5px, -4px); }
    60% { transform: translate(-4px, -2px); }
    80% { transform: translate(3px, 2px); }
  }

  /* Fighters stand where the fight screen had them, then rush the middle. */
  .slot {
    position: absolute;
    top: 8%;
    bottom: 30%;
    aspect-ratio: 200 / 260;
    transition:
      left 0.45s cubic-bezier(0.55, 0, 1, 0.6),
      right 0.45s cubic-bezier(0.55, 0, 1, 0.6),
      transform 0.45s cubic-bezier(0.55, 0, 1, 0.6);
  }
  /* Room at the edge for those standing behind the lead. */
  .slot.left {
    left: env(safe-area-inset-left);
    transform: translateX(calc(var(--n) * 24%));
  }
  .slot.right {
    right: env(safe-area-inset-right);
    transform: translateX(calc(var(--n) * -24%));
  }
  .member {
    position: absolute;
    inset: 0;
  }
  /* Each one further back: further from the middle, a little higher and smaller. */
  .left .member.back {
    transform: translate(calc(var(--i) * -30%), calc(var(--i) * -5%)) scale(calc(1 - var(--i) * 0.1));
    transform-origin: bottom center;
    filter: brightness(0.85);
  }
  .right .member.back {
    transform: translate(calc(var(--i) * 30%), calc(var(--i) * -5%)) scale(calc(1 - var(--i) * 0.1));
    transform-origin: bottom center;
    filter: brightness(0.85);
  }
  .slot.left.charging {
    left: 50%;
    transform: translateX(-82%);
  }
  .slot.right.charging {
    right: 50%;
    transform: translateX(82%);
  }
  /* After the dust: the winner holds the middle, the loser lies beside it. */
  .slot.standing,
  .slot.fallen {
    transition: none;
  }
  .slot.left.standing {
    left: 50%;
    transform: translateX(-108%);
  }
  .slot.right.standing {
    right: 50%;
    transform: translateX(108%);
  }
  .slot.left.fallen {
    left: 50%;
    transform: translateX(-40%);
  }
  .slot.right.fallen {
    right: 50%;
    transform: translateX(40%);
  }
  .figure {
    width: 100%;
    height: 100%;
  }
  /* Knocked over backwards, onto the ground. */
  .figure.down {
    translate: 0 30%;
  }
  .left .figure.down {
    transform-origin: left bottom;
    transform: rotate(-80deg);
  }
  .right .figure.down {
    transform-origin: right bottom;
    transform: rotate(80deg);
  }
  .wreck-smoke {
    position: absolute;
    bottom: 8%;
    width: 50%;
    height: 50%;
  }
  .left .wreck-smoke {
    left: -60%;
  }
  .right .wreck-smoke {
    right: -60%;
  }
  .wreck-smoke i {
    position: absolute;
    left: 30%;
    bottom: 0;
    width: 40%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(#5a544c, rgb(60 55 50 / 0));
    opacity: 0;
    animation: rise 2.8s ease-out infinite;
  }
  .wreck-smoke i:nth-child(2) {
    animation-delay: 0.9s;
  }
  .wreck-smoke i:nth-child(3) {
    animation-delay: 1.8s;
  }
  @keyframes rise {
    0% { opacity: 0.8; transform: translateY(0) scale(0.6); }
    100% { opacity: 0; transform: translate(10%, -160%) scale(1.8); }
  }

  /* The tallies, on the ground below each side. */
  .tally {
    position: absolute;
    bottom: calc(env(safe-area-inset-bottom) + 22px);
    padding: 6px 12px;
    border-radius: 8px;
    background: rgb(20 14 10 / 0.65);
    backdrop-filter: blur(3px);
    transition: opacity 0.4s, transform 0.4s;
    z-index: 6;
  }
  .tally.left {
    left: calc(env(safe-area-inset-left) + 12px);
    border-left: 3px solid var(--c);
  }
  .tally.right {
    right: calc(env(safe-area-inset-right) + 12px);
    border-right: 3px solid var(--c);
    text-align: right;
  }
  .tally.won {
    transform: scale(1.06);
    box-shadow: 0 0 0 1px var(--c), 0 0 22px color-mix(in srgb, var(--c) 60%, transparent);
  }
  .tally.lost {
    opacity: 0.55;
  }
  .tally h2 {
    margin: 0 0 4px;
    font-size: 16px;
    color: color-mix(in srgb, var(--c) 55%, white);
  }
  .sum {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .right .sum {
    justify-content: flex-end;
  }
  .chip,
  .total {
    opacity: 0;
    animation: flip 0.4s ease-out var(--d) forwards;
  }
  .chip {
    display: inline-grid;
    place-items: center;
    min-width: 26px;
    height: 34px;
    padding: 0 6px;
    border-radius: 5px;
    font-weight: 700;
  }
  .power {
    background: var(--raised);
    border: 1px solid var(--accent);
  }
  .card {
    background: linear-gradient(#f2e6c9, #cdb98c);
    color: #2a1e18;
    border: 1px solid #6a5a3a;
    font-size: 16px;
  }
  .plus {
    opacity: 0.6;
  }
  .total {
    font-size: 26px;
    font-weight: 800;
    color: var(--accent);
  }
  @keyframes flip {
    from { opacity: 0; transform: rotateY(90deg) scale(0.8); }
    to { opacity: 1; transform: none; }
  }

  /* The clash: a flash, then a billowing cloud of dust that slowly clears. */
  .flash {
    position: absolute;
    left: 50%;
    top: 42%;
    width: 60vh;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: radial-gradient(#fff8e0, rgb(255 200 120 / 0.5) 35%, transparent 65%);
    animation: flash 0.5s ease-out forwards;
    z-index: 4;
    pointer-events: none;
  }
  @keyframes flash {
    from { opacity: 1; transform: translate(-50%, -50%) scale(0.3); }
    to { opacity: 0; transform: translate(-50%, -50%) scale(1.4); }
  }
  .dust {
    position: absolute;
    left: 50%;
    top: 46%;
    width: 80vh;
    height: 60vh;
    transform: translate(-50%, -50%);
    z-index: 4;
    pointer-events: none;
  }
  .dust i {
    position: absolute;
    left: calc(50% + var(--x));
    top: calc(50% + var(--y));
    width: calc(var(--s) * 34vh);
    aspect-ratio: 1;
    translate: -50% -50%;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, #c9ab83, #8f7558 45%, rgb(110 88 64 / 0.85) 60%, transparent 70%);
    opacity: 0;
    animation: billow 1.95s ease-out var(--d) forwards;
  }
  @keyframes billow {
    0% { opacity: 0; transform: scale(0.2); }
    18% { opacity: 1; transform: scale(1); }
    55% { opacity: 1; transform: scale(1.15); }
    100% { opacity: 0; transform: scale(1.5) translateY(-8%); }
  }

  /* The verdict: a broad band across the middle in the winner's colour. */
  .verdict {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(env(safe-area-inset-bottom) + 10px);
    z-index: 5;
    padding: 6px 0 8px;
    text-align: center;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--c) 70%, #120d0a) 20%, color-mix(in srgb, var(--c) 70%, #120d0a) 80%, transparent);
    border-block: 2px solid color-mix(in srgb, var(--c) 50%, var(--glow));
    animation: band 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }
  @keyframes band {
    from { opacity: 0; transform: scaleY(0.1); }
  }
  .verdict p {
    margin: 0;
  }
  .label {
    letter-spacing: 0.4em;
    text-transform: uppercase;
    font-size: 12px;
    color: var(--glow);
  }
  .who {
    font-size: clamp(28px, 8vh, 60px);
    font-weight: 900;
    line-height: 1.05;
    color: #fff;
    text-shadow: 0 3px 0 rgb(0 0 0 / 0.5), 0 0 24px color-mix(in srgb, var(--c) 80%, white);
    animation: slam 0.55s cubic-bezier(0.2, 1.6, 0.4, 1) 0.1s both;
  }
  @keyframes slam {
    from { opacity: 0; transform: scale(2.4); }
  }
  .how {
    font-size: 13px;
    opacity: 0.85;
  }
  .go {
    margin-left: 10px;
    font: inherit;
    font-weight: 700;
    padding: 3px 16px;
    border-radius: 7px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    cursor: pointer;
  }
  .skip {
    position: absolute;
    bottom: calc(env(safe-area-inset-bottom) + 8px);
    left: 0;
    right: 0;
    margin: 0;
    text-align: center;
    font-size: 11px;
    opacity: 0.5;
  }
</style>
