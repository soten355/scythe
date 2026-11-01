<script lang="ts">
  // The new game screen: pick the map, how many players, and each seat's
  // faction and mat (or shuffle them), then start. Only what's been entered
  // can be picked; the rest shows as coming later.
  import { untrack } from 'svelte';
  import FactionEmblem from '../play/FactionEmblem.svelte';
  import type { GameSetup } from '@scythe/engine';
  import { defaultChoice, MAX_PLAYERS, maxPlayers, MIN_PLAYERS, problems, setFaction, setMat, setPlayerCount, shuffleSeats, toSetup, type Catalog } from './setup';

  let { catalog, onStart, onBack, backLabel }: { catalog: Catalog; onStart: (setup: GameSetup) => void; onBack: () => void; backLabel: string } = $props();

  // Always starts from the default map and the first factions and mats.
  let choice = $state(untrack(() => defaultChoice(catalog)));
  const most = $derived(maxPlayers(catalog));
  const issues = $derived(problems(choice, catalog));
  const faction = (id: string) => catalog.factions.find((f) => f.id === id)!;
  const mat = (id: string) => catalog.mats.find((m) => m.id === id)!;
  /** The seat with the lowest mat number goes first. */
  const first = $derived(choice.players.reduce((best, p, i) => (mat(p.mat).turnOrder < mat(choice.players[best]!.mat).turnOrder ? i : best), 0));
  const counts = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

  // The app may use Math.random; the engine never does.
  const start = () => onStart(toSetup(choice, catalog, Math.floor(Math.random() * 2 ** 31)));
</script>

<div class="screen">
  <header>
    <button class="quiet" onclick={onBack}>‹ {backLabel}</button>
    <h2>New game</h2>
    <button class="primary" disabled={issues.length > 0} onclick={start}>Start</button>
  </header>

  <div class="columns">
    <div class="col">
      <section>
        <h3>Map</h3>
        <div class="maps">
          {#each catalog.maps as m, i (m.id)}
            <button class="map" class:chosen={choice.map === m.id} onclick={() => (choice = { ...choice, map: m.id })}>
              <b>{m.name}</b>
              {#if i === 0}<small>Default</small>{/if}
            </button>
          {/each}
          <button class="map" disabled title="Maps made in the map editor will be added here"><b>+ Add a map</b><small>Coming later</small></button>
        </div>
      </section>

      <section>
        <h3>Players</h3>
        <div class="counts">
          {#each counts as n (n)}
            <button class:chosen={choice.players.length === n} disabled={n > most} onclick={() => (choice = setPlayerCount(choice, n, catalog))}>{n}</button>
          {/each}
        </div>
        {#if most < MAX_PLAYERS}
          <p class="hint">
            {catalog.factions.length} factions and {catalog.mats.length} player mats so far: one of each per player. Solo play arrives with the Automa.
          </p>
        {/if}
      </section>
    </div>

    <section class="col seats">
      <div class="seats-head">
        <h3>Seats <small>pass-and-play, clockwise</small></h3>
        <button class="quiet small" onclick={() => (choice = shuffleSeats(choice, catalog, Math.random))}>🔀 Shuffle</button>
      </div>
      {#each choice.players as p, seat (seat)}
        {@const f = faction(p.faction)}
        {@const m = mat(p.mat)}
        <div class="seat" style:--c={f.color}>
          <div class="crest"><FactionEmblem faction={f} /></div>
          <div class="picks">
            <label>
              <span>Faction</span>
              <select value={p.faction} onchange={(e) => (choice = setFaction(choice, seat, e.currentTarget.value))}>
                {#each catalog.factions as option (option.id)}<option value={option.id}>{option.name}</option>{/each}
              </select>
            </label>
            <label>
              <span>Mat</span>
              <select value={p.mat} onchange={(e) => (choice = setMat(choice, seat, e.currentTarget.value))}>
                {#each catalog.mats as option (option.id)}<option value={option.id}>{option.turnOrder} · {option.name}</option>{/each}
              </select>
            </label>
            <small class="about">
              {f.ability.name} · {f.power} power · {m.coins} coins, {m.popularity} popularity
              {#if seat === first}<b class="first">Goes first</b>{/if}
            </small>
          </div>
        </div>
      {/each}
    </section>
  </div>

  {#if issues.length}
    <p class="issues">{issues.join(' ')}</p>
  {/if}
</div>

<style>
  .screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: calc(env(safe-area-inset-top) + 6px) calc(env(safe-area-inset-right) + 10px) calc(env(safe-area-inset-bottom) + 6px)
      calc(env(safe-area-inset-left) + 10px);
    gap: 8px;
    font-size: 13px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  h2 {
    flex: 1;
    margin: 0;
    text-align: center;
    color: var(--accent);
    font-size: 18px;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--accent);
  }
  h3 small {
    color: var(--fg);
    opacity: 0.55;
    font-weight: 400;
  }
  .columns {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 14px;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }
  .col:first-child {
    width: 38%;
  }
  .seats {
    flex: 1;
    overflow-y: auto;
    gap: 6px;
  }
  .seats-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  button {
    font: inherit;
    color: var(--fg);
    background: #3a3129;
    border: 1px solid var(--accent);
    border-radius: 7px;
    padding: 6px 10px;
    cursor: pointer;
  }
  button.primary {
    background: var(--accent);
    color: #1e1a16;
    font-weight: 700;
    padding: 6px 18px;
  }
  button.quiet {
    background: none;
    border-color: transparent;
    color: var(--accent);
  }
  button.small {
    padding: 2px 6px;
  }
  button.chosen {
    border-color: #ffd23f;
    background: #4a3d1e;
  }
  button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .maps {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .map {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    text-align: left;
  }
  .map small {
    opacity: 0.6;
  }
  .counts {
    display: flex;
    gap: 5px;
  }
  .counts button {
    width: 34px;
    padding: 6px 0;
  }
  .hint {
    margin: 6px 0 0;
    opacity: 0.6;
    font-size: 12px;
  }
  .seat {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 5px 8px;
    border-left: 4px solid var(--c);
    border-radius: 6px;
    background: #2a241e;
  }
  .crest {
    width: 40px;
    flex: none;
  }
  .picks {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    align-items: center;
  }
  label {
    display: flex;
    gap: 5px;
    align-items: center;
  }
  label span {
    opacity: 0.6;
  }
  select {
    font: inherit;
    color: var(--fg);
    background: #3a3129;
    border: 1px solid #5a4d3e;
    border-radius: 6px;
    padding: 3px 4px;
  }
  .about {
    width: 100%;
    opacity: 0.75;
  }
  .first {
    margin-left: 6px;
    color: var(--accent);
  }
  .issues {
    margin: 0;
    color: #ff9b85;
    text-align: center;
  }
</style>
