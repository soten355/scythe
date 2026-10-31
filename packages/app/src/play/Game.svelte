<script lang="ts">
  // Pass-and-play game: Nordic on Industrial against Rusviet on Engineering.
  // The game is its setup plus every state reached so far, so undo just steps
  // back (within your own turn). Not saved yet: autosave arrives in Phase 2.
  import { baseBoard, baseFactions, baseMats } from '@scythe/content';
  import { activeSeat, applyAction, legalActions, newGame, type Action, type CombatResult, type GameState, type Location } from '@scythe/engine';
  import Board from './Board.svelte';
  import MatDrawer from './MatDrawer.svelte';
  import PlayerBar from './PlayerBar.svelte';
  import InlineIcon from './InlineIcon.svelte';
  import { fade } from 'svelte/transition';
  import { guide } from './camera';
  import { flyTo } from './fly';
  import { buildPrompt, combatSummary, sectionHeadings, type Button, type Prompt, type Selection } from './prompt';
  import { canSwitchSection, phase, previousSection, sectionChoices } from './turn';

  const start = () =>
    newGame({
      // The app may use the clock to pick a seed; the engine never does.
      seed: Math.floor(Math.random() * 2 ** 31),
      board: baseBoard,
      players: [
        { faction: baseFactions.find((f) => f.id === 'nordic')!, mat: baseMats.find((m) => m.id === 'mat-1')! },
        { faction: baseFactions.find((f) => f.id === 'rusviet')!, mat: baseMats.find((m) => m.id === 'mat-2')! },
      ],
    });

  let history: GameState[] = $state.raw([start()]);
  /**
   * Index in history where the current player's turn began, or where play
   * last passed to another seat or a fight was revealed: undo stops there.
   */
  let turnStart = $state(0);
  let selection: Selection = $state({});
  /** Seat being handed the device (and who just played, and why if mid-turn); the board is hidden until they tap. */
  let handoff: { from: number; to: number; note?: string } | null = $state(null);
  /** A fight just finished: both sides' picks, shown once the device is back with whoever plays on. */
  let revealed: CombatResult | null = $state(null);
  /** An "are you sure?" question shown in the game, and what to do on Yes. */
  let asking: { message: string; yes: () => void } | null = $state(null);
  const ask = (message: string, yes: () => void) => (asking = { message, yes });
  /** The mat opens at the start of each turn and closes at the turn's first action. */
  let matOpen = $state(true);

  const game = $derived(history[history.length - 1]!);
  /** Who acts now: the current player, or a defender choosing for a fight. */
  const seatNow = $derived(activeSeat(game));
  const actions = $derived(legalActions(game, seatNow));
  const prompt = $derived(buildPrompt(game, actions, selection));
  /** What the board and top bar draw: the game, with resources picked to pay with already taken off. */
  const shown = $derived(prompt.preview ?? game);
  const canUndo = $derived(history.length - 1 > turnStart);
  const step = $derived(phase(game));
  const headings = $derived(seatNow === game.currentPlayer ? sectionHeadings(game) : null);
  const choices = $derived(sectionChoices(history, turnStart));
  const canSwitch = $derived(canSwitchSection(history, turnStart));

  /** Apply one action, or several in order as a single undo step. */
  function act(...actions: Action[]) {
    const before = game;
    const seat = seatNow;
    if (canSwitch && actions[0]?.type !== 'chooseSection') matOpen = false;
    const next = actions.reduce(applyAction, game);
    history = [...history, next];
    selection = {};
    const nextSeat = activeSeat(next);
    if (next.currentPlayer !== before.currentPlayer) {
      turnStart = history.length - 1;
      handoff = { from: seat, to: nextSeat };
      matOpen = true;
    } else if (nextSeat !== seat) {
      // Mid-turn hand-over (to a defender, or back to the attacker): no undoing what the other seat chose.
      turnStart = history.length - 1;
      handoff = { from: seat, to: nextSeat, note: handoffNote(next, nextSeat) };
    }
    if (next.lastCombat !== before.lastCombat) {
      // A fight was revealed: it can't be taken back.
      turnStart = history.length - 1;
      revealed = next.lastCombat ?? null;
    }
  }

  /** Why play passes mid-turn: to defend a fight, or to retreat after losing one. */
  function handoffNote(state: GameState, seat: number): string | undefined {
    if (state.turn.step !== 'combat') return undefined;
    if (state.turn.retreat?.seat === seat) return `to retreat from ${state.turn.retreat.hex}`;
    const fight = state.turn.fight;
    return fight && seat === fight.defender.seat ? `to defend ${fight.hex}` : undefined;
  }

  /** Last turn's section, shown as off-limits on the mat (unless an ability allows it again). */
  const previous = $derived.by(() => {
    const last = previousSection(history, turnStart);
    return choices.some((a) => a.type === 'chooseSection' && a.section === last) ? null : last;
  });

  /** Pick a section, replacing the one picked earlier if nothing else has happened yet. */
  function choose(action: Action) {
    if (canSwitch) history = history.slice(0, -1);
    act(action);
  }

  /** Bring a newly shown finish button (Produce, Deploy...) into view in the side panel. */
  function reveal(node: HTMLElement) {
    node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  let panel: HTMLElement | undefined = $state();
  let currentStep: HTMLElement | undefined = $state();
  /** Changes when a new step appears (not when you just pick things within a step). */
  const stepKey = $derived(`${history.length}|${prompt.title}`);
  /** Changes when new choices appear within a step (tapping a hex, picking a resource...). */
  const choicesKey = $derived(prompt.buttons.map((b) => b.label).join('|'));
  let lastStep = '';
  /**
   * Keep what to do next in view in the side panel, which is short on a
   * phone: a new step shows from its question down; new choices within a
   * step scroll into view.
   */
  $effect(() => {
    const key = stepKey;
    void choicesKey;
    if (!panel || !currentStep) return;
    const target = key === lastStep ? currentStep.querySelector('.buttons') : currentStep;
    lastStep = key;
    if (target) showInPanel(panel, target);
  });

  /** Scroll so all of `el` shows if it fits, otherwise its top. */
  function showInPanel(panel: HTMLElement, el: Element) {
    const box = panel.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    let by = 0;
    if (r.height > box.height || r.top < box.top) by = r.top - box.top;
    else if (r.bottom > box.bottom) by = r.bottom - box.bottom;
    if (by) panel.scrollBy({ top: by, behavior: 'smooth' });
  }

  function press(b: Button, sure = false) {
    if (b.confirm && !sure) return ask(b.confirm, () => press(b, true));
    if (b.action?.type === 'chooseSection') choose(b.action);
    else if (b.action) act(b.action);
    else if (b.actions) act(...b.actions);
    else selection = b.select ?? {};
  }

  function tap(at: Location) {
    const action = prompt.tapActions.get(at);
    const select = prompt.tapSelects.get(at);
    if (action) act(...(prompt.tapFirst ?? []), action);
    else if (select) selection = select;
    else selection = { hex: at };
  }

  /** A pop-up gain (a recruit's bonus): its icons fly to your spot in the top bar, then play moves on. */
  let flying = $state(false);
  async function pick(option: NonNullable<Prompt['choice']>['options'][number], from: HTMLElement) {
    if (flying) return;
    flying = true;
    const icon = from.querySelector('.big');
    const target = document.querySelector('.player.current');
    if (icon && target) await flyTo(icon, target, option.amount);
    flying = false;
    selection = option.select;
  }

  function undo() {
    if (!canUndo) return;
    history = history.slice(0, -1);
    selection = {};
    if (phase(history[history.length - 1]!) === 'choose') matOpen = true;
  }

  function restart(sure = false) {
    if (!sure) return ask('Start a new game? This one is not saved.', () => restart(true));
    history = [start()];
    turnStart = 0;
    selection = {};
    handoff = null;
    revealed = null;
    matOpen = true;
  }

  const name = (seat: number) => game.setup.players[seat]!.faction.name;
  const color = (seat: number) => game.setup.players[seat]!.faction.color;
  /** Round 1 until everyone has had a turn, and so on. */
  const round = $derived(Math.floor(game.turnsTaken / game.players.length) + 1);
</script>

{#snippet current()}
  <div bind:this={currentStep}>
    <p class="title">{prompt.title}</p>
    {@render slots()}
    {@render combat()}
    {@render buttons()}
  </div>
{/snippet}

{#snippet combat()}
  {#if prompt.combat}
    {@const c = prompt.combat}
    <div class="combat">
      <p class="them" style:--o={c.opponent.color}>
        <b>{c.opponent.name}</b> has {c.opponent.power} power and {c.opponent.cards} card{c.opponent.cards === 1 ? '' : 's'}
        (may play {c.opponent.maxCards})
      </p>
      <p class="label">Power</p>
      <div class="dial">
        {#each c.powers as p (p.power)}
          <button class:chosen={p.chosen} onclick={() => (selection = p.select)}>{p.power}</button>
        {/each}
      </div>
      <p class="label">Cards · up to {c.maxCards}</p>
      <div class="hand">
        {#each c.hand as card, i (i)}
          <button class="card" class:chosen={card.chosen} disabled={!card.select} onclick={() => card.select && (selection = card.select)}
            >{card.value}</button
          >
        {:else}
          <span class="hint">No cards</span>
        {/each}
      </div>
      <p class="total">Total <b>{c.total}</b></p>
    </div>
  {/if}
{/snippet}

{#snippet slots()}
  {#if prompt.slots}
    <ol class="slots">
      {#each prompt.slots as slot, i (i)}
        {#if 'text' in slot}
          <li class="slot">
            {#if slot.icon}<InlineIcon icon={slot.icon} />{/if}
            <span>{slot.text}</span>
            <button class="trash" aria-label="Remove" onclick={() => (selection = slot.remove)}>🗑️</button>
          </li>
        {:else}
          <li class="slot empty">{slot.empty}</li>
        {/if}
      {/each}
    </ol>
  {/if}
{/snippet}

{#snippet buttons()}
  <div class="buttons">
    {#each prompt.buttons as b, i (i)}
      {#if b.primary}
        <button class="primary" use:reveal onclick={() => press(b)}>{b.label}</button>
      {:else}
        <button class:quiet={b.quiet} class:chosen={b.chosen} class:dim={b.dim} onclick={() => press(b)}
          >{b.chosen ? '✓ ' : ''}{b.label}</button
        >
      {/if}
    {/each}
  </div>
{/snippet}

<div class="game">
  <header>
    <a class="menu" href={import.meta.env.BASE_URL}>☰</a>
    <PlayerBar game={shown} />
  </header>

  <main>
    <div class="board">
      <!-- Where we are in the story, like a date on the map. -->
      <div class="round"><small>Round</small><b>{round}</b></div>
      <Board game={shown} {prompt} onTap={tap} onPick={(sel) => (selection = sel)} guideTo={guide(game, prompt)} paused={handoff !== null} /></div>
    <aside style:--c={color(seatNow)}>
      <div class="panel" bind:this={panel}>
        {#if !headings}
          {@render current()}
        {:else}
          <section class:done={step === 'bottom'}>
            <h3>{headings.top}{step === 'bottom' ? ' ✓' : ''}</h3>
            {#if step === 'top'}
              {@render current()}
              {#if canSwitch}<p class="hint">Or tap another section on your mat to switch.</p>{/if}
            {/if}
          </section>
          <hr />
          <section class:waiting={step !== 'bottom'}>
            <h3>{headings.bottom}</h3>
            {#if step === 'bottom'}{@render current()}{:else}<p class="hint">After the top action.</p>{/if}
          </section>
        {/if}
      </div>
      {#if prompt.end}
        {@const end = prompt.end}
        {#if end.primary}
          <!-- Nothing else to do this turn: End turn is the main button. -->
          <button class="primary end" use:reveal onclick={() => press(end)}>{end.label}</button>
        {:else}
          <button class="quiet end" onclick={() => press(end)}>{end.label}</button>
        {/if}
      {/if}
      <div class="footer">
        <button class="quiet" onclick={undo} disabled={!canUndo}>↶ Undo</button>
        <button class="quiet" onclick={() => restart()}>New game</button>
      </div>
    </aside>
  </main>

  <MatDrawer {game} {choices} {previous} bind:open={matOpen} onChoose={choose} upgrade={prompt.upgrade} enlist={prompt.enlist} onSelect={(sel) => (selection = sel)} />

  {#if handoff !== null}
    {@const { from, to } = handoff}
    <button class="handoff" style:--c={color(to)} onclick={() => (handoff = null)} transition:fade={{ duration: 350 }}>
      <!-- The last player's badge slides off to the left as the next one slides in from the right. -->
      <span class="badges">
        {#key handoff}
          <span class="badge leaving" style:--f={color(from)}>{name(from)[0]}</span>
          <span class="badge arriving" style:--f={color(to)}>{name(to)[0]}</span>
        {/key}
      </span>
      <span>Pass to <b>{name(to)}</b>{handoff.note ? ` ${handoff.note}` : ''}</span>
      <small>Tap when ready</small>
    </button>
  {/if}

  {#if prompt.choice && !handoff}
    {@const c = prompt.choice}
    <div class="ask" role="dialog" aria-modal="true" style:--c={color(game.currentPlayer)}>
      <div class="box">
        <p>{c.message}</p>
        <div class="options">
          {#each c.options as o (o.label)}
            <button disabled={flying} onclick={(e) => pick(o, e.currentTarget)}><span class="big"><InlineIcon icon={o.icon} /></span> {o.label}</button>
          {/each}
        </div>
        <button class="quiet back" onclick={() => (selection = c.cancel)}>Back</button>
      </div>
    </div>
  {/if}

  {#if revealed && !handoff}
    {@const r = combatSummary(game, revealed)}
    <div class="ask" role="dialog" aria-modal="true" style:--c={color(revealed.winner)}>
      <div class="box">
        <p><b>⚔ {r.title}</b></p>
        {#each r.lines as line, i (i)}<p class="line">{line}</p>{/each}
        <button class="primary ok" onclick={() => (revealed = null)}>OK</button>
      </div>
    </div>
  {/if}

  {#if asking}
    {@const q = asking}
    <div class="ask" role="dialog" aria-modal="true" style:--c={color(game.currentPlayer)}>
      <div class="box">
        <p>{q.message}</p>
        <div class="choices">
          <button class="quiet" onclick={() => (asking = null)}>No</button>
          <button class="primary" onclick={() => ((asking = null), q.yes())}>Yes</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .game {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  header {
    display: flex;
    align-items: center;
  }
  .menu {
    color: var(--fg);
    text-decoration: none;
    padding: 0 8px;
    font-size: 18px;
  }
  main {
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .board {
    flex: 1;
    min-width: 0;
    position: relative;
  }
  aside {
    width: 230px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    border-left: 3px solid var(--c);
    background: #241f1a;
    font-size: 13px;
  }
  .title {
    margin: 0;
    line-height: 1.3;
  }
  .panel {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  h3 {
    margin: 0 0 4px;
    font-size: 13px;
    color: var(--accent);
  }
  hr {
    border: none;
    border-top: 1px solid #4a4036;
    margin: 8px 0;
  }
  .done,
  .waiting {
    opacity: 0.55;
  }
  .hint {
    margin: 6px 0 0;
    font-size: 12px;
    opacity: 0.7;
  }
  .slots {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .slot {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 0 0 8px;
    border: 1px solid var(--accent);
    border-radius: 7px;
  }
  .slot span {
    flex: 1;
  }
  .slot.empty {
    border-style: dashed;
    border-color: #4a4036;
    opacity: 0.6;
  }
  .trash {
    border: none;
    background: none;
    min-height: 28px;
    padding: 0 10px;
  }
  .buttons {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .footer {
    display: flex;
    gap: 5px;
  }
  .footer button {
    flex: 1;
  }
  button {
    font: inherit;
    color: var(--fg);
    background: #3a3129;
    border: 1px solid var(--accent);
    border-radius: 7px;
    padding: 8px;
    text-align: left;
    min-height: 36px;
  }
  button.quiet {
    border-color: #4a4036;
    background: none;
  }
  button.primary {
    text-align: center;
    font-weight: 700;
    font-size: 15px;
    background: var(--accent);
    color: #1e1a16;
  }
  button.dim {
    opacity: 0.4;
  }
  .end {
    text-align: center;
    min-height: 30px;
    padding: 4px;
  }
  button.chosen {
    border-color: #ffd23f;
    background: #4a3d1e;
  }
  button:disabled {
    opacity: 0.35;
  }
  .handoff {
    position: fixed;
    inset: 0;
    z-index: 10;
    border: none;
    border-radius: 0;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 26px;
    text-align: center;
  }
  .ask {
    position: fixed;
    inset: 0;
    z-index: 20;
    background: rgb(0 0 0 / 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .box {
    width: min(340px, 90vw);
    padding: 16px;
    border: 2px solid var(--c);
    border-radius: 10px;
    background: #241f1a;
    font-size: 15px;
  }
  .box p {
    margin: 0 0 14px;
    line-height: 1.35;
  }
  .choices {
    display: flex;
    gap: 8px;
  }
  .choices button {
    flex: 1;
    text-align: center;
  }
  .round {
    position: absolute;
    top: 8px;
    right: 10px;
    z-index: 2;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 54px;
    padding: 4px 8px 5px;
    border: 1px solid #8a7a5c;
    border-radius: 4px;
    background: #e9dcc0;
    color: #2a241e;
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.4);
    font-family: Georgia, 'Times New Roman', serif;
    line-height: 1;
  }
  .round small {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .round b {
    font-size: 24px;
    margin-top: 2px;
  }
  .options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .options button {
    text-align: center;
    font-size: 15px;
  }
  .big {
    font-size: 20px;
  }
  .back {
    width: 100%;
    margin-top: 10px;
    text-align: center;
  }
  .badges {
    position: relative;
    width: 90px;
    height: 90px;
  }
  .badge {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: var(--f);
    border: 3px solid #1e1a16;
    box-shadow: 0 0 0 2px var(--f);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 44px;
    font-weight: 700;
    color: #fff;
  }
  .leaving {
    animation: leave 0.7s ease-in forwards;
  }
  .arriving {
    opacity: 0;
    animation: arrive 0.7s ease-out 0.35s forwards;
  }
  @keyframes leave {
    to {
      transform: translateX(-140px);
      opacity: 0;
    }
  }
  @keyframes arrive {
    from {
      transform: translateX(140px);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
  .combat {
    margin-top: 6px;
  }
  .combat p {
    margin: 4px 0;
  }
  .them {
    padding: 4px 6px;
    border-left: 3px solid var(--o);
    background: #2e2721;
    font-size: 12px;
  }
  .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.7;
  }
  .dial,
  .hand {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }
  .dial button,
  .hand button {
    text-align: center;
    padding: 4px;
    font-weight: 700;
  }
  .hand .card {
    min-height: 44px;
    border-radius: 4px;
    background: #e9dcc0;
    color: #2a241e;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 17px;
  }
  .hand .card.chosen {
    background: #ffd23f;
    box-shadow: 0 0 0 2px #ffd23f;
  }
  .total {
    text-align: right;
    font-size: 15px;
  }
  .box .line {
    margin: 0 0 6px;
  }
  .ok {
    width: 100%;
    margin-top: 8px;
  }
  .handoff b {
    color: var(--c);
    filter: brightness(1.4);
  }
  .handoff small {
    font-size: 14px;
    opacity: 0.6;
  }
</style>
