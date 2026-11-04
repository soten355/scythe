<script lang="ts">
  // The final scores, once someone places their sixth star: who won, and
  // how each player's coins add up (coins in hand, then stars, territories
  // and resources at their popularity tier's rates, and any structure bonus
  // tile). The board can still be
  // looked at behind it.
  import { standings, structureBonusTile, type GameState, type ScoreLine } from '@scythe/engine';
  import { countText } from './structure-bonus-text';
  import { fade, fly } from 'svelte/transition';
  import FactionEmblem from './FactionEmblem.svelte';
  import { STAR_KIND_ICONS } from './icons';
  import InlineIcon from './InlineIcon.svelte';

  let {
    game,
    canUndo,
    onUndo,
    onBoard,
    onNewGame,
    onMenu,
  }: {
    game: GameState;
    canUndo: boolean;
    onUndo: () => void;
    /** Hide this to look at the board. */
    onBoard: () => void;
    onNewGame: () => void;
    onMenu: () => void;
  } = $props();

  const rows = $derived(standings(game));
  const faction = (seat: number) => game.setup.players[seat]!.faction;
  const winners = $derived(rows.filter((r) => r.place === 1).map((r) => faction(r.seat).name));
  const PLACES = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
  const tier = (popularity: number) => (popularity >= 13 ? 'top' : popularity >= 7 ? 'middle' : 'bottom');
  const sum = (l: ScoreLine, per = '') => `${l.count}${per} × ${l.rate}`;
  const tile = $derived(structureBonusTile(game));
</script>

<div class="over" style:--c={faction(rows[0]!.seat).color} transition:fade={{ duration: 300 }}>
  <header in:fly={{ y: -30, duration: 500 }}>
    <div class="crest"><FactionEmblem faction={faction(rows[0]!.seat)} /></div>
    <div>
      <p class="label">Game over</p>
      <h2>{winners.length > 1 ? `${winners.join(' and ')} share the win!` : `${winners[0]} wins!`}</h2>
    </div>
  </header>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th></th>
          <th class="name">Faction</th>
          <th>Coins</th>
          <th>Stars</th>
          <th>Territories</th>
          <th>Resources</th>
          {#if tile}<th>Structures</th>{/if}
          <th class="total">Total</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r, i (r.seat)}
          {@const f = faction(r.seat)}
          <tr class:first={r.place === 1} style:--f={f.color} in:fly={{ x: 40, duration: 400, delay: 200 + i * 120 }}>
            <td class="place">{PLACES[r.place - 1]}</td>
            <td class="name">
              <b>{f.name}</b>
              <small>❤️ {r.popularity}: {tier(r.popularity)} tier</small>
            </td>
            <td><b>{r.coins}</b><small>in hand</small></td>
            <td>
              <b>{r.stars.coins}</b>
              <small>
                {#each game.players[r.seat]!.stars as kind, k (k)}<InlineIcon icon={STAR_KIND_ICONS[kind]} />{/each}
                {sum(r.stars)}
              </small>
            </td>
            <td><b>{r.territories.coins}</b><small>{sum(r.territories)}</small></td>
            <td><b>{r.resources.coins}</b><small>{r.resources.count} ÷ 2 × {r.resources.rate}</small></td>
            {#if tile}<td><b>{r.structureBonus.coins}</b><small>{r.structureBonus.count} counted</small></td>{/if}
            <td class="total"><b>{r.total}</b></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="note">{#if tile}Structure bonus: {countText(tile.count).toLowerCase()}.{" "}{/if}The Factory counts as 3 territories. Ties go to more workers, mechs, structures and recruits, then power, then popularity.</p>

  <div class="buttons">
    {#if canUndo}<button class="quiet" onclick={onUndo}>↶ Undo last move</button>{/if}
    <button onclick={onBoard}>See the board</button>
    <button onclick={onMenu}>Main menu</button>
    <button class="primary" onclick={onNewGame}>New game</button>
  </div>
</div>

<style>
  .over {
    position: fixed;
    inset: 0;
    z-index: 9;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: calc(env(safe-area-inset-top) + 8px) calc(env(safe-area-inset-right) + 12px) calc(env(safe-area-inset-bottom) + 8px)
      calc(env(safe-area-inset-left) + 12px);
    background: radial-gradient(ellipse at top, color-mix(in srgb, var(--c) 35%, var(--bg)), #120e0b 70%);
    font-size: 13px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
  .crest {
    width: 46px;
  }
  .label {
    margin: 0;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    font-size: 11px;
    color: var(--glow);
  }
  h2 {
    margin: 0;
    font-size: 26px;
    color: #fff;
    text-shadow: 0 0 18px color-mix(in srgb, var(--c) 80%, white);
  }
  .table-wrap {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0 4px;
  }
  th {
    font-weight: 400;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.6;
    padding: 0 6px;
  }
  td {
    padding: 4px 6px;
    text-align: center;
    background: rgb(20 14 10 / 0.6);
  }
  td:first-child {
    border-left: 4px solid var(--f);
    border-radius: 6px 0 0 6px;
  }
  td:last-child {
    border-radius: 0 6px 6px 0;
  }
  td b {
    display: block;
    font-size: 16px;
  }
  td small {
    display: block;
    opacity: 0.7;
    font-size: 11px;
    white-space: nowrap;
  }
  .name {
    text-align: left;
  }
  td.name b {
    color: color-mix(in srgb, var(--f) 55%, white);
  }
  .place {
    font-weight: 700;
    width: 34px;
  }
  .total b {
    font-size: 20px;
    color: var(--accent);
  }
  tr.first td {
    background: color-mix(in srgb, var(--f) 22%, rgb(20 14 10 / 0.8));
  }
  tr.first .place {
    color: var(--glow);
  }
  .note {
    margin: 0;
    text-align: center;
    font-size: 11px;
    opacity: 0.55;
  }
  .buttons {
    display: flex;
    justify-content: center;
    gap: 8px;
  }
  button {
    font: inherit;
    color: var(--fg);
    background: var(--raised);
    border: 1px solid var(--accent);
    border-radius: 7px;
    padding: 6px 14px;
    cursor: pointer;
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
</style>
