<script lang="ts">
  // The new game screen: pick the map, how many players, and each seat's
  // faction and mat (or shuffle them), then start. The player's own maps,
  // factions and mats (made in the editors or brought in from files) are
  // offered after the built-in ones, and can be added or removed here.
  import { untrack } from 'svelte';
  import FactionEmblem from '../play/FactionEmblem.svelte';
  import type { GameSetup } from '@scythe/engine';
  import type { Library, LibraryKind } from '../content/library';
  import { defaultChoice, fitChoice, MAX_PLAYERS, maxPlayers, MIN_PLAYERS, problems, setFaction, setMat, setPlayerCount, shuffleSeats, toSetup, type Catalog } from './setup';

  let {
    catalog,
    library,
    message,
    onStart,
    onImport,
    onRemove,
    onBack,
    backLabel,
  }: {
    /** Everything to pick from: built-in, then the library. */
    catalog: Catalog;
    /** The player's own (also in the catalog), to mark and remove. */
    library: Library;
    /** What happened with the last file brought in. */
    message: string;
    onStart: (setup: GameSetup, mapName: string) => void;
    onImport: (file: File) => void;
    onRemove: (kind: LibraryKind, id: string | string[]) => void;
    onBack: () => void;
    backLabel: string;
  } = $props();

  // Always starts from the default map and the first factions and mats.
  let picked = $state(untrack(() => defaultChoice(catalog)));
  /** The picks, kept to what's still offered (something picked may have just been removed). */
  const choice = $derived(fitChoice(picked, catalog));
  const mine = (kind: LibraryKind, id: string) => (library[kind] as { id: string }[]).some((x) => x.id === id);
  /** The item whose Remove was tapped once (tap again to remove). */
  let removing: string | null = $state(null);
  let picker: HTMLInputElement | undefined = $state();
  const yours = $derived([
    ...library.maps.map((x) => ({ kind: 'maps' as const, id: x.id, name: x.name, what: 'Map' })),
    ...library.factions.map((x) => ({ kind: 'factions' as const, id: x.id, name: x.name, what: 'Faction' })),
    ...library.mats.map((x) => ({ kind: 'mats' as const, id: x.id, name: x.name, what: 'Mat' })),
    // Each deck of cards, and the tiles, show as one row each, removed all together.
    ...(library.encounters.length
      ? [{ kind: 'encounters' as const, id: library.encounters.map((c) => c.id), name: `Your ${library.encounters.length} card${library.encounters.length === 1 ? '' : 's'}`, what: 'Encounter deck' }]
      : []),
    ...(library.factory.length
      ? [{ kind: 'factory' as const, id: library.factory.map((c) => c.id), name: `Your ${library.factory.length} card${library.factory.length === 1 ? '' : 's'}`, what: 'Factory deck' }]
      : []),
    ...(library.objectives.length
      ? [{ kind: 'objectives' as const, id: library.objectives.map((c) => c.id), name: `Your ${library.objectives.length} card${library.objectives.length === 1 ? '' : 's'}`, what: 'Objective deck' }]
      : []),
    ...(library.structureBonuses.length
      ? [{ kind: 'structureBonuses' as const, id: library.structureBonuses.map((t) => t.id), name: `Your ${library.structureBonuses.length} tile${library.structureBonuses.length === 1 ? '' : 's'}`, what: 'Structure bonus tiles' }]
      : []),
  ]);

  function chosenFile() {
    const file = picker?.files?.[0];
    if (file) onImport(file);
    if (picker) picker.value = '';
  }
  const most = $derived(maxPlayers(catalog));
  const issues = $derived(problems(choice, catalog));
  const faction = (id: string) => catalog.factions.find((f) => f.id === id)!;
  const mat = (id: string) => catalog.mats.find((m) => m.id === id)!;
  /** The seat with the lowest mat number goes first. */
  const first = $derived(choice.players.reduce((best, p, i) => (mat(p.mat).turnOrder < mat(choice.players[best]!.mat).turnOrder ? i : best), 0));
  const counts = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

  // The app may use Math.random; the engine never does.
  const start = () => onStart(toSetup(choice, catalog, Math.floor(Math.random() * 2 ** 31)), catalog.maps.find((m) => m.id === choice.map)!.name);
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
            <button class="map" class:chosen={choice.map === m.id} onclick={() => (picked = { ...choice, map: m.id })}>
              <b>{m.name}</b>
              {#if i === 0}<small>Default</small>{:else if mine('maps', m.id)}<small>Yours</small>{/if}
            </button>
          {/each}
        </div>
      </section>

      <section>
        <h3>Players</h3>
        <div class="counts">
          {#each counts as n (n)}
            <button class:chosen={choice.players.length === n} disabled={n > most} onclick={() => (picked = setPlayerCount(choice, n, catalog))}>{n}</button>
          {/each}
        </div>
        {#if most < MAX_PLAYERS}
          <p class="hint">
            {catalog.factions.length} factions and {catalog.mats.length} player mats so far: one of each per player. Solo play arrives with the bots.
          </p>
        {/if}
      </section>

      <section>
        <div class="seats-head">
          <h3>Your maps, factions and mats</h3>
          <button class="small" onclick={() => picker?.click()}>Import…</button>
          <input type="file" accept=".json,application/json" bind:this={picker} onchange={chosenFile} hidden />
        </div>
        {#if message}<p class="note">{message}</p>{/if}
        {#if yours.length}
          <ul class="yours">
            {#each yours as item (item.kind + item.id)}
              <li>
                <small>{item.what}</small>
                <span>{item.name}</span>
                {#if removing === item.kind + String(item.id)}
                  <button class="small" onclick={() => ((removing = null), onRemove(item.kind, item.id))}>Remove</button>
                  <button class="quiet small" onclick={() => (removing = null)}>Keep</button>
                {:else}
                  <button class="quiet small" aria-label="Remove {item.name}" onclick={() => (removing = item.kind + String(item.id))}>✕</button>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="hint">Import a content file or any saved game's file to play with its map, factions and mats; or add them from the editors. They stay on this device.</p>
        {/if}
        {#if !library.encounters.length}
          <p class="hint">Encounters use a made-up sample deck until you add your cards from the encounter card editor.</p>
        {/if}
        {#if !library.factory.length}
          <p class="hint">The Factory uses a made-up sample deck until you add your cards from the Factory card editor.</p>
        {/if}
        {#if !library.objectives.length}
          <p class="hint">Objectives use a made-up sample deck until you add your cards from the objective card editor.</p>
        {/if}
        {#if !library.structureBonuses.length}
          <p class="hint">Structure bonus tiles are made-up samples until you add yours from the structure bonus tile editor.</p>
        {/if}
      </section>
    </div>

    <section class="col seats">
      <div class="seats-head">
        <h3>Seats <small>pass-and-play, clockwise</small></h3>
        <button class="quiet small" onclick={() => (picked = shuffleSeats(choice, catalog, Math.random))}>🔀 Shuffle</button>
      </div>
      {#each choice.players as p, seat (seat)}
        {@const f = faction(p.faction)}
        {@const m = mat(p.mat)}
        <div class="seat" style:--c={f.color}>
          <div class="crest"><FactionEmblem faction={f} /></div>
          <div class="picks">
            <label>
              <span>Faction</span>
              <select value={p.faction} onchange={(e) => (picked = setFaction(choice, seat, e.currentTarget.value))}>
                {#each catalog.factions as option (option.id)}<option value={option.id}>{option.name}{mine('factions', option.id) ? ' (yours)' : ''}</option>{/each}
              </select>
            </label>
            <label>
              <span>Mat</span>
              <select value={p.mat} onchange={(e) => (picked = setMat(choice, seat, e.currentTarget.value))}>
                {#each catalog.mats as option (option.id)}<option value={option.id}>{option.turnOrder} · {option.name}{mine('mats', option.id) ? ' (yours)' : ''}</option>{/each}
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
    overflow-y: auto;
  }
  .note {
    margin: 0 0 6px;
    padding: 5px 8px;
    border-radius: 6px;
    background: #3a3129;
    font-size: 12px;
  }
  .yours {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .yours li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .yours small {
    opacity: 0.55;
    width: 46px;
  }
  .yours span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
