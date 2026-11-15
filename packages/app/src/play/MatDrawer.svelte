<script lang="ts">
  // The current player's mat. Collapsed it shows each section's two action
  // names; tap "Mat" to open the values and costs too. The top action's
  // structure bonus and the bottom action's recruit bonus are icons on the
  // right: grey until the structure is built or a recruit placed there.
  // The sections you may choose are tappable: at the start of a turn, and
  // until your first action (to switch). While upgrading, the drawer opens
  // fully and the top-row values and bottom-row costs that can be upgraded
  // glow; tap one of each. That doesn't grey out last turn's section. An action you can't pay for
  // is struck out, with what you still need below it. A Factory card, once
  // taken, sits after the four sections and is picked the same way.
  import { slide } from 'svelte/transition';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { bottomCost, FACTORY, heldFactoryCard, shortfall, topValue, upgradeables, type Action, type GameState, type Section, type SectionIndex } from '@scythe/engine';
  import { BONUS_ICONS, RESOURCE_ICONS, STRUCTURE_ICONS } from './icons';
  import InlineIcon from './InlineIcon.svelte';
  import { costText, gainText, moveText, needText, type Prompt, type Selection } from './prompt';
  import { objectiveStatus } from './objective-text';

  let {
    game,
    choices,
    previous,
    open = $bindable(),
    onChoose,
    upgrade,
    onSelect,
    secret = false,
  }: {
    game: GameState;
    choices: Action[];
    /** The section used last turn, shown dimmed. */
    previous: Section | null;
    open: boolean;
    onChoose: (a: Action) => void;
    upgrade?: Prompt['upgrade'];
    onSelect: (selection: Selection) => void;
    /** The current player's objectives are hidden (a bot's turn, watched by a person). */
    secret?: boolean;
  } = $props();
  /** Picking an upgrade: the mat stays open and nothing is greyed out. */
  const picking = $derived(!!upgrade);
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
    mill: 'Mill: an extra hex to produce on, as one more worker',
    armory: 'Armory: +1 power when you trade',
    monument: 'Monument: +1 popularity when you bolster',
  };
  /** A top-row value in a few characters: "2⚡", "1◉", "2 hexes". */
  const FIELDS: Record<string, (n: number) => string> = {
    units: (n) => `${n} unit${n === 1 ? '' : 's'}`,
    hexes: (n) => `${n} hex${n === 1 ? '' : 'es'}`,
    coins: (n) => `${n}◉`,
    popularity: (n) => `${n}❤️`,
    power: (n) => `${n}⚡`,
    combatCards: (n) => `${n}🃏`,
  };
  /** Objectives open in a pop-up from their button, as not everyone goes for them. */
  let objectivesOpen = $state(false);

  const seat = $derived(game.currentPlayer);
  const { mat } = $derived(game.setup.players[seat]!);
  const player = $derived(game.players[seat]!);
  const active = $derived(game.turn.step === 'chooseSection' ? null : game.turn.section);
  const factory = $derived(heldFactoryCard(game, seat));
  /** Your objective cards (the drawer only ever shows the current player's). */
  const objectives = $derived(objectiveStatus(game, seat));
  const OBJECTIVE_MARK = { done: '★', ready: '✓', notYet: '', closed: '' } as const;
  const chooseFactory = $derived(choices.find((a) => a.type === 'chooseSection' && a.section === FACTORY));

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
        <!-- One short line: what it costs (red if you can't pay), then what you get, "or" between the choices. -->
        {#if 'cost' in x.s.top}<span class:dim={!x.need.top.length} class:need={x.need.top.length} title={x.need.top.length ? `need ${needText(x.need.top)}` : ''}>{x.s.top.cost}◉ →</span>
        {:else if x.need.top.length}<span class="need">need {needText(x.need.top)}</span>{/if}
        {#each x.values as v, i (v.f)}
          {@const text = `${FIELDS[v.f]!(v.value)}${v.value < v.max ? '' : '★'}`}
          {#if i > 0}<span class="dim">or</span>{/if}
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
      <span class="badge" data-recruit={x.section} class:locked={!x.recruit} title="Recruit bonus: +1 {BONUSES[bonus]}{x.recruit ? '' : ' (no recruit yet)'}"
        ><InlineIcon icon={BONUS_ICONS[bonus]} /></span
      >
    </div>
    {#if shown}
      <div class="info" in:slide={opening} out:slide={closing}>
        <!-- The cost, red (with what's missing on hover) if you can't pay it; then the coins it pays. -->
        {#if x.pick}
          {@const pick = x.pick}
          <button class="chip" class:chosen={pick.chosen} onclick={() => onSelect(pick.select)}>{x.cost.amount}<InlineIcon icon={RESOURCE_ICONS[x.cost.resource]} /></button>
        {:else}
          <span class:need={x.need.bottom.length} title={x.need.bottom.length ? `need ${needText(x.need.bottom)}` : ''}>{x.cost.amount}<InlineIcon icon={RESOURCE_ICONS[x.cost.resource]} /></span>
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
    {#if factory}
      <!-- The Factory card: its top part, then its move. -->
      {@const card = factory}
      {#snippet factoryContent()}
        <div class="half">
          <div class="head"><b>🏭 {card.name}</b></div>
          {#if shown}
            <div class="info" in:slide={opening} out:slide={closing}><span>{costText(card.cost)} → {gainText(card.gain, '')}</span></div>
          {/if}
        </div>
        <div class="half bottom">
          <div class="head"><b>Move</b></div>
          {#if shown}
            <div class="info" in:slide={opening} out:slide={closing}><span>{moveText(card)}</span></div>
          {/if}
        </div>
      {/snippet}
      {#if chooseFactory}
        {@const choose = chooseFactory}
        <button class="section factory choosable" class:active={active === FACTORY} class:last={!picking && previous === FACTORY} onclick={() => onChoose(choose)}
          >{@render factoryContent()}</button
        >
      {:else}
        <div class="section factory" class:active={active === FACTORY} class:last={!picking && previous === FACTORY}>{@render factoryContent()}</div>
      {/if}
    {/if}
    {#if objectives.length && !secret}
      <!-- Your objectives: hidden from the others, so only on your own mat. A button, as they're optional: tap for the cards. -->
      {@const ready = objectives.some((o) => o.status === 'ready')}
      {@const done = objectives.some((o) => o.status === 'done')}
      <button class="toggle objectives-button" class:ready aria-haspopup="dialog" onclick={() => (objectivesOpen = true)} title="Your objectives"
        >🎯{#if done}<span class="mark done">★</span>{:else if ready}<span class="mark">✓</span>{/if}</button
      >
    {/if}
  </div>
</div>

{#if objectivesOpen && objectives.length && !secret}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={() => (objectivesOpen = false)}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="popup" role="dialog" aria-label="Your objectives" tabindex="-1" onclick={(e) => e.stopPropagation()}>
      <div class="popup-head">
        <h2>🎯 Your objectives</h2>
        <button class="close" aria-label="Close" onclick={() => (objectivesOpen = false)}>✕</button>
      </div>
      <p class="hint">Optional: complete one for a star. Keep them hidden from the other players.</p>
      {#each objectives as o (o.name)}
        <div class="objective {o.status}">
          <b>{OBJECTIVE_MARK[o.status]} {o.name}</b>
          <span>{o.text}</span>
          {#if o.story}<i>{o.story}</i>{/if}
          <small>{{ done: 'Done', ready: 'Ready: you can claim it now', notYet: 'Not yet', closed: 'Closed: one objective a game' }[o.status]}</small>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .drawer {
    background: var(--panel);
    border-top: 1px solid var(--line);
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
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0 8px;
    min-width: 52px;
  }
  .section {
    flex: 1;
    text-align: left;
    background: var(--bg);
    border: 2px solid var(--raised);
    border-radius: 6px;
    padding: 4px 6px;
    opacity: 1;
  }
  .chip {
    background: var(--raised);
    border: 1px solid #fff6c8;
    border-radius: 5px;
    padding: 1px 6px;
    cursor: pointer;
    animation: glow 1.4s ease-in-out infinite;
  }
  .chip.chosen {
    border-color: var(--glow);
    background: var(--glow);
    color: var(--on-glow);
    animation: none;
  }
  @keyframes glow {
    50% {
      border-color: rgba(255, 246, 200, 0.3);
    }
  }
  .section.factory {
    background: #241e28;
  }
  .objectives-button {
    min-width: 40px;
    font-size: 16px;
    background: #1e2622;
    position: relative;
  }
  .objectives-button.ready {
    border-color: #9be08a;
  }
  .mark {
    position: absolute;
    top: 2px;
    right: 3px;
    font-size: 10px;
    color: #9be08a;
  }
  .mark.done {
    color: var(--glow);
  }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.55);
  }
  .popup {
    width: min(460px, calc(100vw - 40px));
    max-height: calc(100dvh - 40px);
    overflow-y: auto;
    padding: 12px 16px 14px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: #1e2622;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .popup-head {
    display: flex;
    align-items: center;
  }
  .popup h2 {
    margin: 0;
    font-size: 17px;
  }
  /* A finger-sized target (44px, as phones ask), pulled into the corner so the header stays slim. */
  .close {
    margin: -10px -12px -10px auto;
    min-width: 44px;
    min-height: 44px;
    display: grid;
    place-items: center;
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    touch-action: manipulation;
  }
  .hint {
    margin: 0;
    font-size: 12px;
    opacity: 0.7;
  }
  .objective {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .objective i {
    font-size: 12px;
    opacity: 0.7;
  }
  .objective small {
    font-size: 11px;
    opacity: 0.75;
  }
  .objective.ready small {
    color: #9be08a;
    opacity: 1;
  }
  .objective.ready b {
    color: #9be08a;
  }
  .objective.done b {
    color: var(--glow);
  }
  .objective.closed {
    opacity: 0.45;
  }
  .section.choosable {
    border-color: #fff6c8;
    cursor: pointer;
  }
  .section.active,
  .section.active.choosable {
    border-color: var(--glow);
    background: color-mix(in srgb, var(--glow) 16%, var(--bg));
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
    border-top: 1px dashed var(--line);
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
</style>
