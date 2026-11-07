<script lang="ts">
  // A fight gets its own screen: the attacker on the left and the defender on
  // the right, each shown by their character (or a mech), with the mechs and
  // workers they brought and what they have to fight with. Whoever is
  // choosing gets the power dial and their cards below; the other side only
  // shows whether it has locked in. Once both have, the battle plays out
  // (BattleScene) on the same backdrop. Placeholder art (FighterArt) for now.
  import { fade, fly } from 'svelte/transition';
  import BattleScene from './BattleScene.svelte';
  import FightBackdrop from './FightBackdrop.svelte';
  import { fightSides, lineup, type Battle, type FightSide } from './fight';
  import FighterArt from './FighterArt.svelte';
  import FactionPortrait from './FactionPortrait.svelte';
  import type { Button, Prompt, Selection } from './prompt';
  import type { GameState } from '@scythe/engine';

  let {
    game,
    prompt,
    seat,
    canUndo,
    onUndo,
    onSelect,
    onPress,
    battle,
    onBattleDone,
    waiting = null,
  }: {
    game: GameState;
    prompt: Prompt;
    /** Who is choosing now. */
    seat: number;
    canUndo: boolean;
    onUndo: () => void;
    onSelect: (selection: Selection) => void;
    onPress: (button: Button) => void;
    /** A fight that just ended, to play out before going back to the map. */
    battle: Battle | null;
    onBattleDone: () => void;
    /** A bot is choosing: what to say instead of showing its power and cards. */
    waiting?: string | null;
  } = $props();

  const view = $derived(fightSides(game));
  const TERRAIN: Record<string, string> = { farm: 'Farm', forest: 'Forest', mountain: 'Mountain', tundra: 'Tundra', village: 'Village', lake: 'Lake', factory: 'Factory' };
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  /** The lead figure (the character, or else a mech) and up to two more mechs behind it. */
  const figures = (s: FightSide) => lineup(s).slice(0, 3);
</script>

{#if battle || view}
  {@const hex = battle?.hex ?? view!.hex}
  {@const terrain = game.setup.board.hexes[hex]?.terrain ?? ''}
  <div class="fight" transition:fade={{ duration: 300 }}>
    <!-- Scenery to match the hex: forest, tundra, mountain, farm or the Factory. -->
    <FightBackdrop {terrain} />

    <header>
      {#if canUndo && !battle}<button class="undo" onclick={onUndo}>↶ Undo</button>{/if}
      <p class="where">{TERRAIN[terrain] ?? terrain} · {hex}</p>
    </header>

    {#if battle}
      {#key battle}<BattleScene {battle} onDone={onBattleDone} />{/key}
    {:else if view}
    {@const v = view}

    {#each [{ s: v.attacker, role: 'Attacking', side: 'left' }, { s: v.defender, role: 'Defending', side: 'right' }] as { s, role, side } (side)}
      {@const active = s.seat === seat}
      <section class="side {side}" class:active style:--c={s.color}>
        <div class="figures" in:fly={{ x: side === 'left' ? -220 : 220, duration: 700, delay: 150 }}>
          {#each figures(s) as kind, i (i)}
            <div class="figure" class:back={i > 0} style:--i={i}>
              <FighterArt {kind} color={s.color} factionId={s.factionId} facing={side === 'left' ? 'right' : 'left'} />
            </div>
          {/each}
        </div>
        <div class="card">
          <h2 class="named"><FactionPortrait factionId={s.factionId} color={s.color} size={40} />{s.name}</h2>
          <p class="role">{role}</p>
          <p class="stats">⚡ {s.power} power · 🃏 {plural(s.cards, 'card')}, plays up to {s.maxCards}</p>
          {#if s.mechs || s.workers}
            <p class="with">
              {[s.character && s.mechs ? `+ ${plural(s.mechs, 'mech')}` : '', s.workers ? `${plural(s.workers, 'worker')} along` : ''].filter(Boolean).join(' · ')}
            </p>
          {/if}
          <p class="status" class:locked={s.lockedIn}>{s.lockedIn ? 'Locked in ✓' : active ? 'Choosing now' : 'Choosing…'}</p>
        </div>
      </section>
    {/each}

    <div class="versus" aria-hidden="true">
      <span>⚔</span>
    </div>

    <!-- Whoever is choosing: power and cards, or a choice before the fight (Artillery). -->
    <div class="tray" style:--c={game.setup.players[seat]!.faction.color}>
      {#if waiting}
      <p class="title">{waiting}</p>
      {:else}
      <p class="title">{prompt.title}</p>
      {#if prompt.combat}
        {@const c = prompt.combat}
        <div class="row">
          <span class="label">Power</span>
          <div class="dial">
            {#each c.powers as p (p.power)}
              <button class:chosen={p.chosen} onclick={() => onSelect(p.select)}>{p.power}</button>
            {/each}
          </div>
        </div>
        <div class="row">
          <span class="label">Cards</span>
          <div class="hand">
            {#each c.hand as card, i (i)}
              <button class="cc" class:chosen={card.chosen} disabled={!card.select} onclick={() => card.select && onSelect(card.select)}>{card.value}</button>
            {:else}
              <span class="none">No cards</span>
            {/each}
          </div>
        </div>
      {/if}
      <div class="buttons">
        {#if prompt.combat}<span class="total">Total <b>{prompt.combat.total}</b></span>{/if}
        {#each prompt.buttons as b, i (i)}
          <button class:primary={b.primary} class:quiet={b.quiet} onclick={() => onPress(b)}>{b.label}</button>
        {/each}
      </div>
      {/if}
    </div>
    {/if}
  </div>
{/if}

<style>
  /* The faction's portrait (if it has one) beside its name. */
  h2.named {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .right h2.named {
    flex-direction: row-reverse;
  }
  .fight {
    position: fixed;
    inset: 0;
    z-index: 8;
    overflow: hidden;
    color: var(--fg);
    font-size: 13px;
  }
  header {
    position: absolute;
    top: calc(var(--safe-top) + 6px);
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    z-index: 3;
  }
  .where {
    margin: 0;
    padding: 3px 14px;
    border-radius: 20px;
    background: rgb(0 0 0 / 0.45);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 12px;
  }
  .undo {
    position: absolute;
    left: calc(env(safe-area-inset-left) + 8px);
  }
  .side {
    position: absolute;
    top: 8%;
    bottom: 30%;
    width: 42%;
    display: flex;
    align-items: flex-end;
    z-index: 1;
  }
  .side.left {
    left: env(safe-area-inset-left);
  }
  .side.right {
    right: env(safe-area-inset-right);
    flex-direction: row-reverse;
  }
  .figures {
    position: relative;
    height: 100%;
    aspect-ratio: 200 / 260;
    flex: none;
  }
  .figure {
    position: absolute;
    inset: 0;
  }
  /* Extra mechs stand behind the lead, toward the middle, smaller and in shadow. */
  .figure.back {
    z-index: -1;
    transform: translate(calc(var(--i) * 30%), calc(var(--i) * -6%)) scale(calc(1 - var(--i) * 0.2));
    transform-origin: bottom center;
    filter: brightness(0.6);
  }
  .right .figure.back {
    transform: translate(calc(var(--i) * -30%), calc(var(--i) * -6%)) scale(calc(1 - var(--i) * 0.2));
  }
  .side:not(.active) .figures {
    filter: saturate(0.75) brightness(0.85);
  }
  .card {
    align-self: flex-start;
    margin-top: 6%;
    padding: 6px 10px;
    border-left: 3px solid var(--c);
    border-radius: 6px;
    background: rgb(20 14 10 / 0.6);
    backdrop-filter: blur(3px);
    max-width: 48%;
  }
  .right .card {
    border-left: none;
    border-right: 3px solid var(--c);
    text-align: right;
  }
  .active .card {
    box-shadow: 0 0 0 1px var(--c), 0 0 18px color-mix(in srgb, var(--c) 60%, transparent);
  }
  h2 {
    margin: 0;
    font-size: 18px;
    color: color-mix(in srgb, var(--c) 55%, white);
  }
  .card p {
    margin: 2px 0 0;
  }
  .role {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 10px;
    opacity: 0.7;
  }
  .stats,
  .with {
    font-size: 12px;
  }
  .status {
    font-weight: 700;
    opacity: 0.8;
  }
  .status.locked {
    color: #8fd88f;
    opacity: 1;
  }
  .versus {
    position: absolute;
    left: 50%;
    top: 36%;
    transform: translate(-50%, -50%);
    z-index: 2;
    width: 54px;
    height: 54px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: radial-gradient(#3a2a1a, #120d0a);
    border: 2px solid var(--accent);
    font-size: 28px;
    color: var(--accent);
    box-shadow: 0 0 22px rgb(255 160 60 / 0.6);
    animation: pulse 2.4s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      box-shadow: 0 0 34px rgb(255 160 60 / 0.9);
    }
  }
  .tray {
    position: absolute;
    left: 50%;
    bottom: calc(env(safe-area-inset-bottom) + 6px);
    transform: translateX(-50%);
    z-index: 3;
    width: min(460px, 60%);
    padding: 6px 10px 8px;
    border-radius: 10px;
    border-top: 3px solid var(--c);
    background: rgb(20 14 10 / 0.82);
    backdrop-filter: blur(4px);
  }
  .title {
    margin: 0 0 4px;
    text-align: center;
    font-size: 12px;
    opacity: 0.85;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .label {
    width: 42px;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.08em;
    opacity: 0.65;
  }
  .dial,
  .hand {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  button {
    font: inherit;
    color: var(--fg);
    background: var(--raised);
    border: 1px solid var(--accent);
    border-radius: 7px;
    padding: 4px 10px;
    cursor: pointer;
  }
  .dial button {
    width: 30px;
    padding: 4px 0;
  }
  .cc {
    width: 30px;
    height: 40px;
    padding: 0;
    font-weight: 700;
    font-size: 15px;
    background: linear-gradient(#f2e6c9, #cdb98c);
    color: #2a1e18;
    border-color: #6a5a3a;
  }
  button.chosen {
    border-color: var(--glow);
    background: color-mix(in srgb, var(--glow) 22%, var(--panel));
    box-shadow: 0 0 8px rgb(255 210 63 / 0.6);
  }
  .cc.chosen {
    background: linear-gradient(#fff6c8, var(--glow));
    transform: translateY(-4px);
  }
  button:disabled {
    opacity: 0.35;
  }
  button.primary {
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
  }
  button.quiet {
    background: none;
    border-color: transparent;
    color: var(--accent);
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }
  .total {
    margin-right: auto;
  }
  .total b {
    font-size: 18px;
    color: var(--accent);
  }
  .none {
    opacity: 0.6;
  }
</style>
