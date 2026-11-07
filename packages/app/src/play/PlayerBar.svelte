<script lang="ts">
  // Top bar: the current player's coins, power, popularity, combat cards,
  // mechs, workers, territories controlled (the Factory counts three) and the
  // resources on hexes they control. Everyone else shrinks to
  // their name (just its first letter with four or more players, so all fit on
  // a phone); everyone's stars always show. They're listed in turn order,
  // whoever went first leading. Tapping a player opens their dossier
  // (FactionDossier); each is at least 44 points wide and 34 tall, to be easy
  // to tap on the iPhone, and on a phone the resource line is left out so all
  // fit without scrolling.
  import { controlledHexes, RESOURCES, territories, type GameState } from '@scythe/engine';
  import { cubicInOut } from 'svelte/easing';
  import { slide } from 'svelte/transition';
  import { inTurnOrder } from './seats';

  let { game, onOpen }: { game: GameState; onOpen?: (seat: number) => void } = $props();

  const STAR_NAMES: Record<string, string> = {
    upgrades: 'all upgrades', mechs: 'all mechs', structures: 'all structures', recruits: 'all recruits',
    workers: 'all workers', popularity: 'top popularity', power: 'top power', combat: 'a fight won',
  };

  const compact = $derived(game.players.length > 3);
  const rows = $derived(
    inTurnOrder(game).map((seat) => {
      const p = game.players[seat]!;
      const totals = Object.fromEntries(RESOURCES.map((r) => [r, 0])) as Record<string, number>;
      for (const hex of controlledHexes(game, seat)) {
        for (const [r, n] of Object.entries(game.resources[hex] ?? {})) totals[r]! += n;
      }
      return { p, seat, faction: game.setup.players[seat]!.faction, totals };
    }),
  );
</script>

<div class="bar">
  {#each rows as { p, seat, faction, totals } (seat)}
    {@const current = seat === game.currentPlayer}
    <button class="player" class:current style:--c={faction.color} data-player={seat} onclick={() => onOpen?.(seat)} aria-label="{faction.name}: see how they're doing">
      <span class="name" title={faction.name}>{compact && !current ? faction.name[0] : faction.name}</span>
      <span class="stars" data-stars={seat} title={p.stars.length ? `Stars: ${p.stars.map((k) => STAR_NAMES[k]).join(', ')}` : 'No stars yet'}>⭐ {p.stars.length}</span>
      {#if current}
        <span class="details" transition:slide={{ axis: 'x', duration: 450, easing: cubicInOut }}>
          <span title="coins" data-stat="{seat}|coins">◉ {p.coins}</span>
          <span title="power" data-stat="{seat}|power">⚡ {p.power}</span>
          <span title="popularity" data-stat="{seat}|popularity">♥ {p.popularity}</span>
          <span title="combat cards" data-stat="{seat}|combatCard">▭ {p.combatCards.length}</span>
          <span title="mechs deployed (of 4)">🤖 {p.mechs.length}</span>
          <span title="workers" data-stat="{seat}|workers">👷 {p.workers.length}</span>
          <span title="territories you control (the Factory counts as 3)">⬢ {territories(game, seat)}</span>
          <span class="res" title="oil, metal, wood, food on hexes you control" data-stat="{seat}|resources">
            oil {totals.oil} · metal {totals.metal} · wood {totals.wood} · food {totals.food}
          </span>
        </span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .bar {
    display: flex;
    gap: 6px;
    padding: 3px 6px;
    font-size: 13px;
    overflow-x: auto;
  }
  .player {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    flex: none;
    min-width: 44px;
    min-height: 34px;
    padding: 4px 10px;
    touch-action: manipulation;
    border-radius: 6px;
    border: 2px solid transparent;
    background: var(--panel);
    white-space: nowrap;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .player:active {
    filter: brightness(1.25);
  }
  .player.current {
    border-color: var(--c);
  }
  .name {
    font-weight: 700;
    /* Lightened, so even a black faction (Saxony) reads on the dark bar. */
    color: color-mix(in srgb, var(--c) 55%, white);
  }
  .details {
    display: flex;
    gap: 8px;
    align-items: center;
    white-space: nowrap;
    overflow: hidden;
  }
  .stars {
    font-weight: 700;
  }
  .res {
    opacity: 0.75;
  }
  /* A phone held sideways: as tall as the other top-bar buttons. */
  @media (pointer: coarse) {
    @container screen (max-height: 500px) {
      .player {
        min-height: 38px;
      }
    }
  }
  /* A phone: drop the resource line, so every player fits without scrolling (their screen shows it). */
  @container screen (max-width: 760px) {
    .details,
    .player {
      gap: 6px;
    }
    .res {
      display: none;
    }
  }
</style>
