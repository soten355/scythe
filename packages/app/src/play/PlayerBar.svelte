<script lang="ts">
  // Top bar: each player's coins, power, popularity, combat cards, workers and
  // the resources on hexes they control. The current player is outlined.
  import { controlledHexes, RESOURCES, type GameState } from '@scythe/engine';

  let { game }: { game: GameState } = $props();

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
    <div class="player" class:current={seat === game.currentPlayer} style:--c={faction.color}>
      <span class="name">{faction.name}</span>
      <span title="coins">◉ {p.coins}</span>
      <span title="power">⚡ {p.power}</span>
      <span title="popularity">♥ {p.popularity}</span>
      <span title="combat cards">▭ {p.combatCards}</span>
      <span title="workers">👷 {p.workers.length}</span>
      <span class="res" title="oil, metal, wood, food on hexes you control">
        oil {totals.oil} · metal {totals.metal} · wood {totals.wood} · food {totals.food}
      </span>
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
  .res {
    opacity: 0.75;
  }
</style>
