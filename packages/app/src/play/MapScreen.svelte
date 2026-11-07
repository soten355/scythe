<script lang="ts">
  // The map screen (phone): the whole screen just for the map, to look around
  // at what everyone is doing. Down the side, each faction with what it has
  // out; tap one to fly to its pieces. Tap any hex to see what's on it. The
  // game carries on underneath (a bot can still play, and the map follows),
  // and anything that needs you (a fight, a pass screen) comes up over it.
  import { buildPrompt } from './prompt';
  import Board from './Board.svelte';
  import { factionsOnMap, hexReport } from './explore';
  import { inkOn } from './ink';
  import type { GameState, HexId, Location } from '@scythe/engine';
  import type { BoardLook } from '../theme/theme';
  import { fade } from 'svelte/transition';

  let { game, round, look, onClose }: { game: GameState; round: number; look?: BoardLook; onClose: () => void } = $props();

  const factions = $derived(factionsOnMap(game));
  /** The faction the camera last flew to, and a count so tapping it again flies there again. */
  let following: { seat: number; n: number } | null = $state(null);
  const guideTo = $derived.by(() => {
    if (!following) return null;
    const f = factions[following.seat]!;
    return { key: `${following.seat}:${following.n}`, spots: f.spots as Location[] };
  });
  let picked: HexId | null = $state(null);
  const report = $derived(picked ? hexReport(game, picked) : null);
  /** Nothing to do on this map, just the picked hex outlined. */
  const prompt = $derived({ ...buildPrompt(game, [], {}), selected: picked ?? undefined });

  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const STRUCTURE_NAMES = { mine: 'Mine', mill: 'Mill', armory: 'Armory', monument: 'Monument' };

  function follow(seat: number) {
    following = { seat, n: (following?.n ?? 0) + 1 };
  }
  function tap(at: Location) {
    picked = picked === at ? null : at;
  }
  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="map-screen" role="dialog" aria-modal="true" aria-label="The map" transition:fade={{ duration: 180 }}>
  <div class="board">
    <Board {game} {prompt} onTap={tap} onPick={() => {}} {guideTo} {look} tapAny />
  </div>

  <div class="top">
    <button class="close" onclick={onClose} aria-label="Back to the game">✕</button>
    <span class="round">Round {round}</span>
  </div>

  <!-- Each faction: tap to fly to its pieces. -->
  <ul class="factions">
    {#each factions as f (f.seat)}
      <li>
        <button class:on={following?.seat === f.seat} style:--f={f.color} style:--f-ink={inkOn(f.color)} onclick={() => follow(f.seat)}>
          <b>{f.name}</b>
          <small>⭐ {f.stars} · 💪 {f.power}</small>
          <small>🤖 {f.mechs} · 👷 {f.workers} · 🏛️ {f.structures}</small>
        </button>
      </li>
    {/each}
  </ul>

  {#if report}
    <!-- What's on the tapped hex. -->
    <div class="report" transition:fade={{ duration: 120 }}>
      <p class="head"><b>{report.hex}</b> <span>{report.terrain[0]!.toUpperCase() + report.terrain.slice(1)}</span>
        <button class="dismiss" onclick={() => (picked = null)} aria-label="Close">✕</button></p>
      {#each report.units as u (u.seat)}
        <p class="line" style:--f={u.color}>
          <b>{u.name}</b>:
          {[u.character ? 'character' : '', u.mechs ? plural(u.mechs, 'mech') : '', u.workers ? plural(u.workers, 'worker') : ''].filter(Boolean).join(', ')}
        </p>
      {/each}
      {#each report.structures as s (s.structure)}
        <p class="line" style:--f={s.color}>🏛️ {STRUCTURE_NAMES[s.structure]} ({factions[s.seat]!.name})</p>
      {/each}
      {#if report.resources.length}
        <p class="line">📦 {report.resources.map((r) => `${r.amount} ${r.resource}`).join(', ')}</p>
      {/if}
      {#if report.encounter}<p class="line">⭐ An encounter waits here</p>{/if}
      {#if !report.units.length && !report.structures.length && !report.resources.length && !report.encounter}
        <p class="line quiet">Nothing here.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .map-screen {
    position: fixed;
    inset: 0;
    /* Over the game, under anything that needs you: a fight (8), the final scores (9), a pass screen (10), questions. */
    z-index: 7;
    background: var(--bg);
    padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
  }
  .board {
    position: relative;
    width: 100%;
    height: 100%;
  }
  button {
    font: inherit;
    color: var(--fg);
    cursor: pointer;
  }
  .top {
    position: absolute;
    top: calc(var(--safe-top) + 8px);
    left: calc(var(--safe-left) + 8px);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .close,
  .dismiss {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1px solid #8a7a5c;
    background: rgb(36 31 26 / 0.85);
    font-size: 16px;
  }
  .round {
    padding: 4px 10px;
    border-radius: 99px;
    background: rgb(36 31 26 / 0.85);
    font-size: 13px;
  }
  .factions {
    position: absolute;
    top: calc(var(--safe-top) + 54px);
    left: calc(var(--safe-left) + 8px);
    bottom: calc(var(--safe-bottom) + 8px);
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 5px;
    overflow-y: auto;
    width: 132px;
  }
  .factions button {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 4px 8px;
    border: 2px solid var(--f);
    border-left-width: 6px;
    border-radius: 7px;
    background: rgb(20 16 12 / 0.82);
    text-align: left;
  }
  .factions button.on {
    background: var(--f);
    color: var(--f-ink);
  }
  .factions b {
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .factions small {
    font-size: 10px;
    white-space: nowrap;
  }
  .report {
    position: absolute;
    top: calc(var(--safe-top) + 8px);
    right: calc(var(--safe-right) + 8px);
    width: min(240px, 45%);
    max-height: calc(100% - var(--safe-top) - var(--safe-bottom) - 64px);
    overflow-y: auto;
    padding: 8px 10px;
    border: 1px solid #8a7a5c;
    border-radius: 9px;
    background: rgb(20 16 12 / 0.9);
    font-size: 13px;
  }
  .report p {
    margin: 0 0 4px;
    line-height: 1.3;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .head span {
    flex: 1;
    opacity: 0.75;
  }
  .dismiss {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }
  .line {
    padding-left: 6px;
    border-left: 4px solid var(--f, transparent);
  }
  .quiet {
    opacity: 0.6;
  }
</style>
