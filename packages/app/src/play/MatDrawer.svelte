<script lang="ts">
  // The current player's mat. Collapsed it shows each section's two action
  // names; tap "Mat" to open the values and costs too. The top action's
  // structure bonus and the bottom action's recruit bonus are icons on the
  // right: grey until the structure is built or a recruit placed there.
  // The sections you may choose are tappable: at the start of a turn, and
  // until your first action (to switch). While upgrading, the drawer opens
  // fully and the top-row values and bottom-row costs that can be upgraded
  // glow; tap one of each. While enlisting, the open recruit spots glow; tap
  // one. Neither greys out last turn's section. An action you can't pay for
  // is struck out, with what you still need below it.
  import { slide } from 'svelte/transition';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { bottomCost, shortfall, topValue, upgradeables, type Action, type GameState, type SectionIndex } from '@scythe/engine';
  import { BONUS_ICONS, STRUCTURE_ICONS } from './icons';
  import InlineIcon from './InlineIcon.svelte';
  import { needText, type Prompt, type Selection } from './prompt';

  let {
    game,
    choices,
    previous,
    open = $bindable(),
    onChoose,
    upgrade,
    enlist,
    onSelect,
  }: {
    game: GameState;
    choices: Action[];
    /** The section used last turn, shown dimmed. */
    previous: SectionIndex | null;
    open: boolean;
    onChoose: (a: Action) => void;
    upgrade?: Prompt['upgrade'];
    enlist?: Prompt['enlist'];
    onSelect: (selection: Selection) => void;
  } = $props();
  /** Picking an upgrade or a recruit spot: the mat stays open and nothing is greyed out. */
  const picking = $derived(!!upgrade || !!enlist);
  const shown = $derived(open || picking);
  // Opening is quick; closing takes its time so it's easy to follow.
  const opening = { duration: 260, easing: cubicOut };
  const closing = { duration: 700, easing: cubicInOut };

  const NAMES: Record<string, string> = {
    move: 'Move', trade: 'Trade', produce: 'Produce', bolster: 'Bolster',
    upgrade: 'Upgrade', deploy: 'Deploy', build: 'Build', enlist: 'Enlist',
  };
  const BONUSES: Record<string, string> = { power: 'power', coins: 'coins', popularity: 'popularity', combatCard: 'combat card' };
  /** What each structure adds to its top-row action. */
  const STRUCTURE_BONUS: Record<string, string> = {
    mine: 'Mine: works as a tunnel for your moves',
    mill: 'Mill: its hex produces one extra',
    armory: 'Armory: +1 power when you trade',
    monument: 'Monument: +1 popularity when you bolster',
  };
  const FIELDS: Record<string, string> = {
    units: 'units', coins: 'coins', popularity: 'popularity', hexes: 'hexes', power: 'power', combatCards: 'cards',
  };

  const seat = $derived(game.currentPlayer);
  const { mat } = $derived(game.setup.players[seat]!);
  const player = $derived(game.players[seat]!);
  const active = $derived(game.turn.step === 'chooseSection' ? null : game.turn.section);

  const sections = $derived(
    mat.sections.map((s, i) => {
      const section = i as SectionIndex;
      const choose = choices.find((a) => a.type === 'chooseSection' && a.section === i);
      const cost = bottomCost(player, mat, section);
      return {
        section,
        s,
        choose,
        values: upgradeables(s.top).map(([f, u]) => ({
          f,
          value: topValue(player, mat, section, f),
          max: u.upgraded,
          pick: upgrade?.tops.find((t) => t.top.section === section && t.top.field === f),
        })),
        pick: upgrade?.bottoms.find((b) => b.section === section),
        cost,
        recruit: player.recruits.includes(section),
        spot: enlist?.find((e) => e.section === section),
        need: shortfall(game, seat, section),
        built: player.structures[s.top.structure],
      };
    }),
  );
</script>

{#snippet content(x: (typeof sections)[number])}
  {@const structure = x.s.top.structure}
  {@const bonus = x.s.bottom.recruitBonus}
  <div class="half">
    <div class="head">
      <b class:struck={x.need.top.length}>{NAMES[x.s.top.action]}</b>
      <span class="badge" class:locked={!x.built} title="{STRUCTURE_BONUS[structure]}{x.built ? '' : ' (build the ' + structure + ' to unlock)'}"
        ><InlineIcon icon={STRUCTURE_ICONS[structure]} /></span
      >
    </div>
    {#if shown}
      <div class="info" in:slide={opening} out:slide={closing}>
        {#if x.need.top.length}<span class="need">need {needText(x.need.top)}</span>{/if}
        {#if 'cost' in x.s.top}<span class="dim">pay {x.s.top.cost}◉</span>{/if}
        {#each x.values as v (v.f)}
          {@const text = `${v.value} ${FIELDS[v.f]}${v.value < v.max ? '' : '★'}`}
          {#if v.pick}
            {@const pick = v.pick}
            <button class="chip" class:chosen={pick.chosen} onclick={() => onSelect(pick.select)}>{text}</button>
          {:else}
            <span>{text}</span>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
  <div class="half bottom">
    <div class="head">
      <b class:struck={x.need.bottom.length}>{NAMES[x.s.bottom.action]}</b>
      {#if x.spot}
        {@const spot = x.spot}
        <button class="chip badge" title="Recruit here: +1 {BONUSES[bonus]} each time" class:chosen={spot.chosen} onclick={() => onSelect(spot.select)}
          ><InlineIcon icon={BONUS_ICONS[bonus]} /></button
        >
      {:else}
        <span class="badge" class:locked={!x.recruit} title="Recruit bonus: +1 {BONUSES[bonus]}{x.recruit ? '' : ' (no recruit yet)'}"
          ><InlineIcon icon={BONUS_ICONS[bonus]} /></span
        >
      {/if}
    </div>
    {#if shown}
      <div class="info" in:slide={opening} out:slide={closing}>
        {#if x.need.bottom.length}<span class="need">need {needText(x.need.bottom)}</span>{/if}
        {#if x.pick}
          {@const pick = x.pick}
          <button class="chip" class:chosen={pick.chosen} onclick={() => onSelect(pick.select)}>{x.cost.amount} {x.cost.resource}</button>
        {:else}
          <span>{x.cost.amount} {x.cost.resource}</span>
        {/if}
        <span class="dim">+{x.s.bottom.coins}◉</span>
      </div>
    {/if}
  </div>
{/snippet}

<div class="drawer" class:open={shown}>
  <div class="sections">
    <button class="toggle" disabled={picking} onclick={() => (open = !open)}>{shown ? '▾' : '▴'} Mat</button>
    {#each sections as x (x.section)}
      {#if x.choose}
        {@const choose = x.choose}
        <button
          class="section choosable"
          class:active={active === x.section}
          class:last={!picking && previous === x.section}
          onclick={() => onChoose(choose)}>{@render content(x)}</button
        >
      {:else}
        <div class="section" class:active={active === x.section} class:last={!picking && previous === x.section}>{@render content(x)}</div>
      {/if}
    {/each}
  </div>
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
  .chip {
    background: #3a3129;
    border: 1px solid #fff6c8;
    border-radius: 5px;
    padding: 1px 6px;
    cursor: pointer;
    animation: glow 1.4s ease-in-out infinite;
  }
  .chip.chosen {
    border-color: #ffd23f;
    background: #ffd23f;
    color: #1e1a16;
    animation: none;
  }
  @keyframes glow {
    50% {
      border-color: rgba(255, 246, 200, 0.3);
    }
  }
  .section.choosable {
    border-color: #fff6c8;
    cursor: pointer;
  }
  .section.active,
  .section.active.choosable {
    border-color: #ffd23f;
    background: #3a3020;
  }
  .section.last {
    opacity: 0.45;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .info {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-top: 1px;
  }
  .bottom {
    margin-top: 2px;
    padding-top: 2px;
    border-top: 1px dashed #4a4036;
  }
  .dim {
    opacity: 0.65;
  }
  .struck {
    text-decoration: line-through;
    text-decoration-thickness: 2px;
    opacity: 0.6;
  }
  .need {
    color: #ff9a7a;
  }
  /* Each half's bonus (structure on top, recruit below) sits at its right. */
  .badge {
    margin-left: auto;
    font-size: 13px;
  }
  .badge.locked {
    filter: grayscale(1);
    opacity: 0.35;
  }
  .chip.badge {
    padding: 0 5px;
  }
</style>
