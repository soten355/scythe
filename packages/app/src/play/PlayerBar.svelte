<script lang="ts">
  // Top bar: the current player's coins, power, popularity, combat cards,
  // mechs, workers and the resources on hexes they control. Everyone else shrinks to
  // their name; everyone's stars always show.
  import { controlledHexes, RESOURCES, type GameState } from '@scythe/engine';
  import { cubicInOut } from 'svelte/easing';
  import { slide } from 'svelte/transition';

  let { game }: { game: GameState } = $props();

  const STAR_NAMES: Record<string, string> = {
    upgrades: 'all upgrades', mechs: 'all mechs', structures: 'all structures', recruits: 'all recruits',
    workers: 'all workers', popularity: 'top popularity', power: 'top power',
  };

  const rows = $derived(
    game.players.map((p, seat) => {
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
    <div class="player" class:current style:--c={faction.color}>
      <span class="name">{faction.name}</span>
      <span class="stars" title={p.stars.length ? `Stars: ${p.stars.map((k) => STAR_NAMES[k]).join(', ')}` : 'No stars yet'}>⭐ {p.stars.length}</span>
      {#if current}
        <span class="details" transition:slide={{ axis: 'x', duration: 450, easing: cubicInOut }}>
          <span title="coins">◉ {p.coins}</span>
          <span title="power">⚡ {p.power}</span>
          <span title="popularity">♥ {p.popularity}</span>
          <span title="combat cards">▭ {p.combatCards.length}</span>
          <span title="mechs deployed (of 4)">🤖 {p.mechs.length}</span>
          <span title="workers">👷 {p.workers.length}</span>
          <span class="res" title="oil, metal, wood, food on hexes you control">
            oil {totals.oil} · metal {totals.metal} · wood {totals.wood} · food {totals.food}
          </span>
        </span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .bar {
    display: flex;
    gap: 6px;
    padding: 4px 6px;
    font-size: 12px;
    overflow-x: auto;
  }
  .player {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 3px 8px;
    border-radius: 6px;
    border: 2px solid transparent;
    background: #2a241e;
    white-space: nowrap;
  }
  .player.current {
    border-color: var(--c);
  }
  .name {
    font-weight: 700;
    color: var(--c);
    filter: brightness(1.4);
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
</style>
