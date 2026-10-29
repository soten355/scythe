<script lang="ts">
  // The current player's mat. Collapsed it shows the four sections; tap
  // "Mat" to open the details (values, costs, upgrades, recruits, structures).
  // At the start of a turn, the sections you may choose are tappable.
  import { bottomCost, produceCost, topValue, upgradeables, type Action, type GameState, type SectionIndex } from '@scythe/engine';

  let { game, actions, onAction }: { game: GameState; actions: Action[]; onAction: (a: Action) => void } = $props();
  let open = $state(false);

  const NAMES: Record<string, string> = {
    move: 'Move', trade: 'Trade', produce: 'Produce', bolster: 'Bolster',
    upgrade: 'Upgrade', deploy: 'Deploy', build: 'Build', enlist: 'Enlist',
  };
  const BONUSES: Record<string, string> = { power: 'power', coins: 'coins', popularity: 'popularity', combatCard: 'combat card' };
  const FIELDS: Record<string, string> = {
    units: 'units', coins: 'coins', popularity: 'popularity', hexes: 'hexes', power: 'power', combatCards: 'cards',
  };

  const seat = $derived(game.currentPlayer);
  const { faction, mat } = $derived(game.setup.players[seat]!);
  const player = $derived(game.players[seat]!);
  const active = $derived(game.turn.step === 'chooseSection' ? null : game.turn.section);

  const sections = $derived(
    mat.sections.map((s, i) => {
      const section = i as SectionIndex;
      const choose = actions.find((a) => a.type === 'chooseSection' && a.section === i);
      const cost = bottomCost(player, mat, section);
      return {
        section,
        s,
        choose,
        values: upgradeables(s.top).map(([f, u]) => ({ f, value: topValue(player, mat, section, f), max: u.upgraded })),
        cost,
        cubes: player.upgrades.bottom.filter((b) => b === section).length,
        recruit: player.recruits.includes(section),
        built: player.structures[s.top.structure],
      };
    }),
  );
  const produce = $derived(produceCost(player));
</script>

<div class="drawer" class:open>
  <div class="sections">
    <button class="toggle" onclick={() => (open = !open)}>{open ? '▾' : '▴'} Mat</button>
    {#each sections as x (x.section)}
      <button
        class="section"
        class:active={active === x.section}
        class:last={player.lastSection === x.section && active === null}
        class:choosable={!!x.choose}
        disabled={!x.choose}
        onclick={() => x.choose && onAction(x.choose)}
      >
        <div class="top">
          <b>{NAMES[x.s.top.action]}</b>
          {#if 'cost' in x.s.top}<span class="dim">pay {x.s.top.cost}◉</span>{/if}
          {#each x.values as v (v.f)}<span>{v.value} {FIELDS[v.f]}{v.value < v.max ? '' : '★'}</span>{/each}
        </div>
        <div class="bottom">
          <b>{NAMES[x.s.bottom.action]}</b>
          <span>{x.cost.amount} {x.cost.resource}</span>
          <span class="dim">+{x.s.bottom.coins}◉</span>
          {#if x.recruit}<span title="recruit">☻</span>{/if}
        </div>
        {#if open}
          <div class="details">
            <div>Structure: {x.s.top.structure}{x.built ? ` (built on ${x.built})` : ''}</div>
            <div>Upgrades here: {x.cubes} of {x.s.bottom.upgradeSpaces}</div>
            <div>Recruit bonus: {BONUSES[x.s.bottom.recruitBonus]}{x.recruit ? ' (enlisted)' : ''}</div>
          </div>
        {/if}
      </button>
    {/each}
  </div>
  {#if open}
    <div class="extra">
      <span><b>{faction.name}</b> · {mat.name} mat</span>
      <span>Mechs: {player.mechAbilities.map((a) => faction.mechAbilities[a]?.name).join(', ') || 'none'}</span>
      <span>
        Producing costs:
        {[produce.power && '1 power', produce.popularity && '1 popularity', produce.coins && '1 coin'].filter(Boolean).join(' + ') || 'nothing'}
      </span>
      <span>One-time recruit bonuses used: {player.recruitBonusesTaken.map((b) => BONUSES[b]).join(', ') || 'none'}</span>
    </div>
  {/if}
</div>

<style>
  .drawer {
    background: #2a241e;
    border-top: 1px solid #4a4036;
    font-size: 11px;
  }
  .sections {
    display: flex;
    gap: 4px;
    padding: 4px;
  }
  button {
    font: inherit;
    color: inherit;
  }
  .toggle {
    background: none;
    border: 1px solid #4a4036;
    border-radius: 6px;
    padding: 0 8px;
    min-width: 52px;
  }
  .section {
    flex: 1;
    text-align: left;
    background: #1e1a16;
    border: 2px solid #3a3129;
    border-radius: 6px;
    padding: 4px 6px;
    opacity: 1;
  }
  .section:disabled {
    color: inherit;
  }
  .section.choosable {
    border-color: #fff6c8;
    cursor: pointer;
  }
  .section.active {
    border-color: #ffd23f;
    background: #3a3020;
  }
  .section.last {
    opacity: 0.45;
  }
  .top,
  .bottom {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .bottom {
    margin-top: 2px;
    padding-top: 2px;
    border-top: 1px dashed #4a4036;
  }
  .dim {
    opacity: 0.65;
  }
  .details {
    margin-top: 4px;
    opacity: 0.8;
  }
  .extra {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    padding: 2px 8px 6px;
  }
</style>
