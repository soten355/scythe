<script lang="ts">
  // A game, new or from a save: people passing the device, bots, or both.
  // The game is its setup plus every state reached so far, and the moves that
  // led to each, so undo just steps back (within your own turn). It's saved
  // after every change. Bots think in a background thread and play their
  // moves one at a time; while they do, their cards, objectives and choices
  // stay hidden and the controls are off.
  import { onDestroy } from 'svelte';
  import { activeSeat, applyAction, isGameOver, legalActions, playerView, structureBonusTile, type Action, type CombatResult, type GameState, type Location } from '@scythe/engine';
  import Board from './Board.svelte';
  import MatDrawer from './MatDrawer.svelte';
  import PlayerBar from './PlayerBar.svelte';
  import InlineIcon from './InlineIcon.svelte';
  import FactionEmblem from './FactionEmblem.svelte';
  import FactionDossier from './FactionDossier.svelte';
  import FightScreen from './FightScreen.svelte';
  import GameOver from './GameOver.svelte';
  import GameOverMoment from './GameOverMoment.svelte';
  import { battleOf, type Battle } from './fight';
  import { fade } from 'svelte/transition';
  import { guide } from './camera';
  import { showMoment, type Moment } from './fly';
  import { inkOn } from './ink';
  import { BONUS_ICONS, ENCOUNTER_CARD_ICON, RECRUIT_ICON, RESOURCE_ICONS, STAR_ICON, STAR_KIND_ICONS, type Icon } from './icons';
  import { gainsBetween, recruitPayoutsIn, type GainKind } from './gains';
  import { buildPrompt, combatSummary, sectionHeadings, type Button, type Prompt, type RowStatus, type Selection } from './prompt';
  import { canSwitchSection, phase, previousSection, sectionChoices } from './turn';
  import { loadSettings } from './settings';
  import { travelOf, type Travel } from './travel';
  import { countText, paysText } from './structure-bonus-text';
  import { restore, updateSave, type SavedGame } from '../saves/save';
  import { exportSave } from '../saves/files';
  import { startBots } from '../bots/client';
  import { personalityFor, type RemoteSeat } from '@scythe/bots';
  import { botName, isBot, needsPass, people } from './seats';
  import { botTurnsSince, paceOf } from './narrate';
  import type { BoardLook } from '../theme/theme';
  import { cardPicture, uiPicture } from '../theme/current.svelte';
  import { cardLook } from '../content/card-pictures';

  let {
    save,
    onSave,
    onNewGame,
    onMenu,
    look,
  }: {
    /** The game to play (a new game is a save with no moves yet). */
    save: SavedGame;
    /** Called after every change, to keep the save on the device. */
    onSave: (save: SavedGame) => void;
    /** Go to the new game screen (after "are you sure?"). */
    onNewGame: () => void;
    /** Back to the opening menu; this game stays to continue. */
    onMenu: () => void;
    /** The board's pictures and colours, from the theme in use. */
    look?: BoardLook;
  } = $props();
  /** The theme's picture behind the side panel, if any. */
  const panelPicture = $derived(uiPicture('ui.panel'));

  // The save given never changes for a game: another game is a new Game.
  // svelte-ignore state_referenced_locally
  let record = save;
  const restored = restore(record);
  let history: GameState[] = $state.raw(restored.history);
  /** The moves that led to each state after the first (steps[i] leads to history[i + 1]). */
  let steps: Action[][] = $state.raw(record.steps);
  /** Off once a test browser has loaded a position with no moves behind it. */
  let saving = $state(true);
  // Local dev server only (never in the built app): lets a test browser set up a position, e.g. a fight.
  if (import.meta.env.DEV) {
    Object.assign(globalThis, {
      __scythe: {
        state: () => history[history.length - 1],
        load: (state: GameState) => ((saving = false), (history = [state]), (steps = []), (turnStart = 0), (selection = {})),
        applyAction,
      },
    });
  }
  /**
   * Index in history where the current player's turn began, or where play
   * last passed to another seat or a fight was revealed: undo stops there.
   */
  let turnStart = $state(restored.turnStart);
  let selection: Selection = $state({});
  /**
   * Seat being handed the device (and who just played, and why if mid-turn); the board is hidden until they tap.
   * A game picked up again opens on this too, for whoever's turn it is.
   */
  // Opening a game partway through: pass to whoever acts next (not for a finished game, which opens on its final scores).
  const opened = restored.history[restored.history.length - 1]!;
  const bots = record.bots;
  const seats = opened.players.length;
  const passFirst = record.steps.length > 0 && !isGameOver(opened) && needsPass(bots, seats, null, activeSeat(opened));
  let handoff: { from?: number; to: number; note?: string } | null = $state(passFirst ? { to: activeSeat(opened) } : null);
  /** The person who last had the device (null until someone does), so it's only passed between different people. */
  let viewer: number | null = passFirst || isBot(bots, activeSeat(opened)) ? null : activeSeat(opened);

  /** The bots, one per bot seat, thinking in a background thread started for this game. */
  const botThread = bots?.some(Boolean) ? startBots() : null;
  const botSeats: (RemoteSeat | null)[] = (bots ?? []).map((level, seat) =>
    level && botThread ? botThread.client.seat(`${record.id}:${seat}`, { level, seed: record.setup.seed + seat + 1 }) : null,
  );
  onDestroy(() => botThread?.stop());
  /** How long a bot's move stays on screen before the next: the ones worth watching, and the small steps between. */
  const BOT_PACE = { watch: 900, quick: 200 };
  let botBusy = $state(false);
  /** Skip was tapped: bots play on at once, without showing their moves, until it's a person's turn (or, with no people, the next turn). */
  let skipping = $state(false);
  let storiesOpen = $state(false);
  let botTrouble: string | null = $state(null);

  // Autosave: every move, undo and new turn.
  $effect(() => {
    if (!saving || (steps === record.steps && turnStart === record.turnStart)) return;
    record = updateSave(record, steps, turnStart, history[history.length - 1]!, new Date());
    onSave(record);
  });
  const settings = loadSettings();
  const GAIN_ICONS: Record<GainKind, Icon> = { ...BONUS_ICONS, ...RESOURCE_ICONS };
  /** Which top bar number each gain flies to. */
  const GAIN_STAT: Record<GainKind, string> = {
    coins: 'coins', power: 'power', popularity: 'popularity', combatCard: 'combatCard',
    worker: 'workers', oil: 'resources', metal: 'resources', wood: 'resources', food: 'resources',
  };
  /**
   * Big moments to show (a recruit placed, a star earned, a mech deployed),
   * in order: each is pinned over the map, then flies to where it belongs.
   * They wait for any pass screen or fight reveal to be closed.
   */
  let moments: Moment[] = $state([]);
  let showingMoment = $state(false);
  let boardArea: HTMLElement | undefined = $state();
  $effect(() => {
    if (showingMoment || handoff || battle || revealed || !moments.length || !boardArea) return;
    const [m, ...rest] = moments;
    showingMoment = true;
    showMoment(m!, boardArea).finally(() => {
      moments = rest;
      showingMoment = false;
    });
  });
  /** The last unit to move, for the map to animate. */
  let travel: Travel | null = $state(null);
  let travels = 0;
  /** A fight just finished: both sides' picks, shown once the device is back with whoever plays on. */
  let revealed: CombatResult | null = $state(null);
  /** The same fight, played out on the fight screen first (before any pass screen or the summary). */
  let battle: Battle | null = $state(null);
  /** Whose dossier is open (tapped in the top bar), if any. */
  let dossier: number | null = $state(null);
  /** An "are you sure?" question shown in the game, and what to do on Yes. */
  let asking: { message: string; yes: () => void } | null = $state(null);
  const ask = (message: string, yes: () => void) => (asking = { message, yes });
  /** The encounter card is put aside to look at the map. */
  let peeking = $state(false);
  $effect(() => {
    if (!prompt.encounter) peeking = false;
  });
  /** The mat opens at the start of each turn and closes at the turn's first action. */
  let matOpen = $state(true);

  const game = $derived(history[history.length - 1]!);
  /** Who acts now: the current player, or a defender choosing for a fight. */
  const seatNow = $derived(activeSeat(game));
  const actions = $derived(legalActions(game, seatNow));
  /** A bot acts now: nothing to choose for whoever watches. */
  const botNow = $derived(isBot(bots, seatNow) && !isGameOver(game));
  /** Changes each time play passes to a seat (once the pass screen is gone): the side panel's crest and text play in again. */
  const intro = $derived(handoff ? -1 : `${seatNow}|${game.turnsTaken}`);
  const prompt = $derived(buildPrompt(game, botNow ? [] : actions, botNow ? {} : selection));
  /** What the board and top bar draw: the game, with resources picked to pay with already taken off. */
  const shown = $derived(prompt.preview ?? game);
  const canUndo = $derived(history.length - 1 > turnStart);
  const step = $derived(phase(game));
  /** Someone has placed their sixth star: final scores, once every animation and pop-up is done. */
  const over = $derived(isGameOver(game));
  /** The final scores are put aside to look at the board. */
  let viewingBoard = $state(false);
  /** The game-over moment is still to be shown (not for a game that was already over when opened). */
  let endingToShow = $state(!isGameOver(opened));
  $effect(() => {
    // Undoing the last move and finishing again shows it again.
    if (!over) endingToShow = true;
  });
  const settled = $derived(!battle && !revealed && !handoff && !moments.length && !showingMoment);
  const showEnding = $derived(over && endingToShow && settled);
  const showScores = $derived(over && !endingToShow && !viewingBoard && settled);
  /** Who placed the last star. */
  const finisher = $derived(game.players.findIndex((p, seat) => p.stars.length >= game.setup.players[seat]!.faction.stars));
  const headings = $derived(seatNow === game.currentPlayer ? sectionHeadings(game) : null);
  const choices = $derived(sectionChoices(history, turnStart));
  const canSwitch = $derived(canSwitchSection(history, turnStart));

  /** Apply one action, or several in order as a single undo step. */
  function act(...actions: Action[]) {
    const before = game;
    const seat = seatNow;
    const byBot = isBot(bots, seat);
    if (!byBot) viewer = seat;
    if (canSwitch && actions[0]?.type !== 'chooseSection') matOpen = false;
    // Each step along the way: a fight's loser may have gone home by the end, but the battle still shows them.
    const states = [before];
    for (const a of actions) states.push(applyAction(states[states.length - 1]!, a));
    const next = states[states.length - 1]!;
    history = [...history, next];
    steps = [...steps, actions];
    /** A bot's move played while skipping: nothing to show for it. */
    const unseen = byBot && skipping;
    travel = unseen ? null : (travelOf(before, next, actions, ++travels) ?? travel);
    const added: Moment[] = [];
    const { faction, mat } = before.setup.players[before.currentPlayer]!;
    for (const a of actions) {
      if (a.type === 'enlist') {
        // The recruit flies to its spot on the mat; its one-time bonus, beside it, to that stat in the top bar.
        const amount = faction.recruitBonuses.find((r) => r.bonus === a.bonus)?.amount ?? 0;
        const seat = before.currentPlayer;
        added.push({
          icon: RECRUIT_ICON,
          below: BONUS_ICONS[mat.sections[a.section]!.bottom.recruitBonus],
          target: `[data-recruit="${a.section}"]`,
          sides: [{ text: `+${amount}`, icon: BONUS_ICONS[a.bonus], targets: [`[data-stat="${seat}|${a.bonus}"]`, `[data-player="${seat}"]`] }],
        });
      }
      if (a.type === 'deploy') added.push({ mech: { color: faction.color, initial: faction.name[0]! }, target: `[data-mech="${before.currentPlayer}|${a.hex}"]` });
    }
    // An encounter option (or a resource of your choice): what it gave flies to the top bar.
    if (actions.some((a) => a.type === 'encounterOption' || a.type === 'encounterResource')) {
      const seat = before.currentPlayer;
      const gains = gainsBetween(before, next, seat);
      if (gains.length) {
        added.push({
          icon: ENCOUNTER_CARD_ICON,
          target: `[data-player="${seat}"]`,
          sides: gains.map((g) => ({ text: `+${g.amount}`, icon: GAIN_ICONS[g.kind], targets: [`[data-stat="${seat}|${GAIN_STAT[g.kind]}"]`, `[data-player="${seat}"]`] })),
        });
      }
    }
    // Ongoing recruit bonuses: the player's and their neighbours', each on a chip of their colour, to that stat in their top bar.
    const payouts = recruitPayoutsIn(states);
    if (payouts.length) {
      added.push({
        icon: RECRUIT_ICON,
        target: `[data-player="${before.currentPlayer}"]`,
        sides: payouts.map(({ seat, bonus }) => ({
          text: '+1',
          icon: BONUS_ICONS[bonus],
          color: color(seat),
          targets: [`[data-stat="${seat}|${bonus}"]`, `[data-player="${seat}"]`],
        })),
      });
    }
    next.players.forEach((p, seat) => {
      for (const kind of p.stars.slice(before.players[seat]!.stars.length)) added.push({ icon: STAR_ICON, below: STAR_KIND_ICONS[kind], target: `[data-stars="${seat}"]` });
    });
    if (added.length && !unseen) moments = [...moments, ...added];
    selection = {};
    const nextSeat = activeSeat(next);
    // A bot's moves can't be undone.
    if (byBot) turnStart = history.length - 1;
    const pass = needsPass(bots, seats, viewer, nextSeat);
    if (!isBot(bots, nextSeat) || (next.currentPlayer !== before.currentPlayer && people(bots, seats).length === 0)) skipping = false;
    if (next.currentPlayer !== before.currentPlayer) {
      turnStart = history.length - 1;
      if (pass) handoff = { from: seat, to: nextSeat };
      matOpen = !isBot(bots, nextSeat);
    } else if (nextSeat !== seat) {
      // Mid-turn hand-over (to a defender, or back to the attacker): no undoing what the other seat chose.
      turnStart = history.length - 1;
      if (pass) handoff = { from: seat, to: nextSeat, note: handoffNote(next, nextSeat) };
    }
    if (next.lastCombat !== before.lastCombat && !unseen) {
      // A fight was revealed: it can't be taken back.
      turnStart = history.length - 1;
      revealed = next.lastCombat ?? null;
      battle = next.lastCombat ? battleOf(states, next.lastCombat) : null;
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
    if (botNow) return;
    if (canSwitch) {
      history = history.slice(0, -1);
      steps = steps.slice(0, -1);
    }
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
    if (botNow) return;
    if (b.confirm && !sure) return ask(b.confirm, () => press(b, true));
    if (b.action?.type === 'chooseSection') choose(b.action);
    else if (b.action) act(b.action);
    else if (b.actions) act(...b.actions);
    else selection = b.select ?? {};
  }

  function tap(at: Location) {
    if (botNow) return;
    const action = prompt.tapActions.get(at);
    const route = prompt.tapRoutes?.get(at);
    const select = prompt.tapSelects.get(at);
    if (action) act(...(prompt.tapFirst ?? []), action);
    else if (route) act(...(prompt.tapFirst ?? []), ...route);
    else if (select) selection = select;
    else selection = { hex: at };
  }

  function undo() {
    if (!canUndo || botNow) return;
    history = history.slice(0, -1);
    steps = steps.slice(0, -1);
    selection = {};
    travel = null;
    if (phase(history[history.length - 1]!) === 'choose') matOpen = true;
  }

  // A bot's turn: ask it for each move (once whatever is showing is done), then play it.
  $effect(() => {
    if (!botNow || botBusy || botTrouble || handoff || battle || revealed || moments.length || showingMoment) return;
    const state = game;
    const seat = seatNow;
    const started = performance.now();
    botBusy = true;
    botSeats[seat]!.chooseAction(playerView(state, seat), legalActions(state, seat)).then(
      async (action) => {
        const wait = skipping ? 0 : BOT_PACE[paceOf(action)] - (performance.now() - started);
        if (wait > 0) await new Promise((done) => setTimeout(done, wait));
        botBusy = false;
        // Only if the game is still where the bot was asked (nothing else has moved it on).
        if (game === state) act(action);
      },
      (e: unknown) => {
        botBusy = false;
        botTrouble = e instanceof Error ? e.message : String(e);
      },
    );
  });
  const botLabel = (seat: number) => `${name(seat)} (${botName(bots![seat]!)})`;
  /** What the bots have done since a person last finished a turn, told in plain lines; the last may be under way. */
  const stories = $derived(bots && (botNow || storiesOpen) ? botTurnsSince(history, steps, bots) : []);
  const playing = $derived(botNow ? stories.findLast((t) => t.seat === game.currentPlayer) : undefined);

  let menuOpen = $state(false);

  function restart() {
    ask('Start a new game? This one stays in Saved games.', onNewGame);
  }

  const name = (seat: number) => game.setup.players[seat]!.faction.name;
  const color = (seat: number) => game.setup.players[seat]!.faction.color;
  /** Round 1 until everyone has had a turn, and so on. */
  const round = $derived(Math.floor(game.turnsTaken / game.players.length) + 1);
  /** This game's structure bonus tile, scored at the end; tap it for its payouts. */
  const tile = $derived(structureBonusTile(game));
  let tileOpen = $state(false);
</script>

{#snippet current()}
  <div bind:this={currentStep}>
    <p class="title">{prompt.title}</p>
    {@render slots()}
    {@render combat()}
    {@render buttons()}
  </div>
{/snippet}

<!-- Done rows get a tick and skipped ones say so, so it's clear both rows are dealt with before ending the turn. -->
{#snippet mark(status: RowStatus)}
  {#if status === 'done'}<span class="tick" aria-label="Done">✓</span>{:else if status === 'skipped'}<span class="skipped">Skipped</span>{/if}
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
    <button class="menu" aria-label="Menu" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>☰</button>
    <PlayerBar game={shown} onOpen={(seat) => (dossier = seat)} />
  </header>

  <main>
    <div class="board" bind:this={boardArea}>
      <!-- Where we are in the story, like a date on the map. -->
      <div class="corner">
        <div class="round"><small>Round</small><b>{round}</b></div>
        {#if tile}
          <!-- The structure bonus tile, for all to see: what it counts; tap for the coins it pays at the end. -->
          <button class="tile" class:open={tileOpen} onclick={() => (tileOpen = !tileOpen)} aria-expanded={tileOpen}>
            <small>🏛️ Structure bonus</small>
            <span>{countText(tile.count)}</span>
            {#if tileOpen}<span class="pays">{paysText(tile.pays)}<br /><i>at the end of the game</i></span>{/if}
          </button>
        {/if}
      </div>
      <Board game={shown} {prompt} onTap={tap} onPick={(sel) => (selection = sel)} guideTo={guide(game, prompt)} paused={handoff !== null} {travel} moveMs={settings.moveMs} {look} /></div>
    <aside style:--c={color(seatNow)}>
      {#if panelPicture}<div class="panel-picture" style:background-image="url({panelPicture})" aria-hidden="true"></div>{/if}
      <!-- Whoever acts now: their crest shows, then fades behind the text as it appears (again each time play passes, once the pass screen is gone). -->
      {#key intro}
        <div class="emblem"><FactionEmblem faction={game.setup.players[seatNow]!.faction} /></div>
      {/key}
      <div class="panel" bind:this={panel}>
        {#key intro}<div class="intro">
        {#if botNow}
          <p class="title">{botLabel(seatNow)} is playing…</p>
          {#if playing && playing.seat === seatNow}
            <ul class="story">{#each playing.lines as line, i (i)}<li>{line}</li>{/each}</ul>
          {/if}
          {#if !skipping}
            <button class="skip" onclick={() => (skipping = true)}>⏭ {people(bots, seats).length ? 'Skip to your turn' : 'Skip this turn'}</button>
          {/if}
          {#if botTrouble}
            <p class="hint">Something went wrong while it was thinking: {botTrouble}</p>
            <button class="primary" onclick={() => (botTrouble = null)}>Try again</button>
          {/if}
        {:else if over}
          <p class="title">Game over: a sixth star has been placed.</p>
          <button class="primary" onclick={() => (viewingBoard = false)}>Final scores</button>
        {:else if !headings}
          {@render current()}
        {:else}
          <section class:done={step === 'bottom'}>
            <h3>{@render mark(headings.status.top)}{headings.top}</h3>
            {#if step === 'top'}
              {@render current()}
              {#if canSwitch}<p class="hint">Or tap another section on your mat to switch.</p>{/if}
            {/if}
          </section>
          <hr />
          <section class:waiting={step !== 'bottom'}>
            <h3>{@render mark(headings.status.bottom)}{headings.bottom}</h3>
            {#if step === 'bottom'}{@render current()}{:else}<p class="hint">After the top action.</p>{/if}
          </section>
        {/if}
        </div>{/key}
      </div>
      {#if prompt.end && !over && !botNow}
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
        {#if bots?.some(Boolean) && game.turnsTaken > 0 && !botNow}<button class="quiet" onclick={() => (storiesOpen = true)}>📜 Bots' turns</button>{/if}
      </div>
    </aside>
  </main>

  <!-- A fight takes over the screen until it's decided. -->
  <FightScreen game={shown} {prompt} seat={seatNow} waiting={botNow ? `${botLabel(seatNow)} is choosing…` : null} {canUndo} onUndo={undo} onSelect={(sel) => (selection = sel)} onPress={press} {battle} onBattleDone={() => (battle = null)} />

  {#if showEnding && finisher >= 0}
    <GameOverMoment name={name(finisher)} color={color(finisher)} stars={game.setup.players[finisher]!.faction.stars} onDone={() => (endingToShow = false)} />
  {/if}

  {#if showScores}
    <GameOver {game} {canUndo} onUndo={undo} onBoard={() => (viewingBoard = true)} {onNewGame} {onMenu} />
  {/if}

  {#if dossier !== null && !handoff}
    <FactionDossier
      game={shown}
      seat={dossier}
      secret={(seat) => isBot(bots, seat) || (people(bots, seats).length > 1 && seat !== viewer)}
      playedBy={(seat) => (isBot(bots, seat) ? botName(bots![seat]!) : people(bots, seats).length > 1 ? 'A person' : 'You')}
      leaning={(seat) => (isBot(bots, seat) ? personalityFor(game.setup.players[seat]!.faction.id).summary : undefined)}
      onSwitch={(seat) => (dossier = seat)}
      onClose={() => (dossier = null)}
    />
  {/if}

  {#if menuOpen}
    <!-- Tapping anywhere outside the menu closes it. -->
    <button class="menu-backdrop" aria-label="Close menu" onclick={() => (menuOpen = false)}></button>
    <nav class="menu-list" transition:fade={{ duration: 120 }}>
      <button onclick={() => ((menuOpen = false), restart())}>New game</button>
      <button onclick={() => ((menuOpen = false), exportSave(record))} disabled={!saving}>Save to a file</button>
      <button onclick={() => ((menuOpen = false), onMenu())}>Main menu</button>
    </nav>
  {/if}

  <MatDrawer {game} {choices} {previous} secret={isBot(bots, game.currentPlayer)} bind:open={matOpen} onChoose={choose} upgrade={prompt.upgrade} onSelect={(sel) => (selection = sel)} />

  {#if handoff !== null && !battle}
    {@const { from, to } = handoff}
    <button class="handoff" style:--c={color(to)} onclick={() => ((viewer = to), (handoff = null))} transition:fade={{ duration: 350 }}>
      <!-- The last player's badge slides off to the left as the next one slides in from the right. -->
      <span class="badges">
        {#key handoff}
          {#if from !== undefined}<span class="badge leaving" style:--f={color(from)} style:color={inkOn(color(from))}>{name(from)[0]}</span>{/if}
          <span class="badge arriving" style:--f={color(to)} style:color={inkOn(color(to))}>{name(to)[0]}</span>
        {/key}
      </span>
      <span>Pass to <b>{name(to)}</b>{handoff.note ? ` ${handoff.note}` : ''}</span>
      <small>Tap when ready</small>
    </button>
  {/if}

  {#if prompt.choice && !handoff && !botNow}
    {@const c = prompt.choice}
    <div class="ask" role="dialog" aria-modal="true" style:--c={color(game.currentPlayer)}>
      <div class="box">
        <p>{c.message}</p>
        <div class="options">
          {#each c.options as o (o.label)}
            <button onclick={() => (selection = o.select)}><span class="big"><InlineIcon icon={o.icon} /></span> {o.label}</button>
          {/each}
        </div>
        {#if c.cancel}{@const cancel = c.cancel}<button class="quiet back" onclick={() => (selection = cancel)}>Back</button>{/if}
      </div>
    </div>
  {/if}

  {#if prompt.encounter && !handoff && !battle && !revealed && !botNow}
    {@const e = prompt.encounter}
    {@const shown = cardLook(e, cardPicture(e.picture))}
    {#if peeking}
      <button class="primary back-to-card" onclick={() => (peeking = false)}>⭐ Back to the encounter</button>
    {:else}
      <!-- The encounter card: its story, then one button per option (greyed out when it can't be paid for). -->
      <div class="ask" role="dialog" aria-modal="true" style:--c={color(game.currentPlayer)}>
        <div class="box encounter">
          <p class="heading"><b>⭐ {e.name}</b><span class="where">Encounter on {e.hex}</span></p>
          {#if shown.picture}
            <!-- The card's picture, with its story over the bottom when it shows both. -->
            <div class="card-picture" style:background-image="url({shown.picture})">
              {#if shown.story}<p class="story">{shown.story}</p>{/if}
            </div>
          {:else if shown.story}
            <p class="story">{shown.story}</p>
          {/if}
          <p class="note">{e.note}:</p>
          <div class="options">
            {#each e.options as o, i (i)}
              <button class:taken={o.taken} disabled={!o.action} onclick={() => o.action && press({ label: o.text, action: o.action })}>
                <span class="text">{o.taken ? '✓ ' : ''}{o.text}</span>
                <span class="cost">{o.cost}</span>
                <span class="gain">{o.gain}</span>
                {#if o.why}<span class="why">{o.why}</span>{/if}
              </button>
            {/each}
          </div>
          <div class="row">
            <button class="quiet" onclick={() => (peeking = true)}>Look at the map</button>
            {#if e.stop}{@const stop = e.stop}<button class="quiet" onclick={() => press(stop)}>{stop.label}</button>{/if}
          </div>
        </div>
      </div>
    {/if}
  {/if}

  {#if prompt.factoryOffer && !handoff && !battle && !revealed && !botNow}
    {@const f = prompt.factoryOffer}
    <!-- The Factory: keep one of the cards on offer. -->
    <div class="ask" role="dialog" aria-modal="true" style:--c={color(game.currentPlayer)}>
      <div class="box encounter">
        <p class="heading"><b>🏭 The Factory</b><span class="where">Keep one card for the rest of the game</span></p>
        <p class="note">It becomes a fifth section beside your mat: its top part, then a move.</p>
        <div class="options" style:grid-template-columns="repeat({Math.min(f.cards.length, 4)}, 1fr)">
          {#each f.cards as c (c.name)}
            <button onclick={() => press({ label: c.name, action: c.action })}>
              <span class="text">{c.name}</span>
              <span class="cost">{c.top}</span>
              <span class="gain">Then {c.move}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  {#if revealed && !handoff && !battle}
    {@const r = combatSummary(game, revealed)}
    <div class="ask" role="dialog" aria-modal="true" style:--c={color(revealed.winner)}>
      <div class="box">
        <p><b>⚔ {r.title}</b></p>
        {#each r.lines as line, i (i)}<p class="line">{line}</p>{/each}
        <button class="primary ok" onclick={() => (revealed = null)}>OK</button>
      </div>
    </div>
  {/if}

  {#if storiesOpen && !botNow}
    <!-- What each bot did since your last turn, oldest first. -->
    <div class="ask" role="dialog" aria-modal="true" style:--c={color(game.currentPlayer)}>
      <div class="box stories">
        <p><b>📜 Since your last turn</b></p>
        <div class="list">
          {#each stories as t, i (i)}
            <section style:--f={color(t.seat)}>
              <h4>{botLabel(t.seat)}</h4>
              <ul class="story">{#each t.lines as line, j (j)}<li>{line}</li>{/each}</ul>
            </section>
          {/each}
        </div>
        <button class="primary ok" onclick={() => (storiesOpen = false)}>OK</button>
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
          <!-- Take what Yes does before closing: `q` follows `asking`, so it's gone once that's cleared. -->
          <button class="primary" onclick={() => { const yes = q.yes; asking = null; yes(); }}>Yes</button>
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
    background: none;
    border: none;
    padding: 0 8px;
    font-size: 18px;
    cursor: pointer;
  }
  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: transparent;
    border: none;
  }
  .menu-list {
    position: fixed;
    top: calc(env(safe-area-inset-top) + 30px);
    left: calc(env(safe-area-inset-left) + 6px);
    z-index: 31;
    display: flex;
    flex-direction: column;
    min-width: 150px;
    padding: 4px;
    border-radius: 8px;
    background: var(--panel);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.5);
  }
  .menu-list > * {
    padding: 9px 12px;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--fg);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }
  .menu-list > *:hover {
    background: rgb(255 255 255 / 0.08);
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
    position: relative;
    width: 230px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    border-left: 3px solid var(--c);
    background: color-mix(in srgb, var(--panel) 75%, var(--bg));
    font-size: 13px;
  }
  @keyframes text-in {
    0%,
    40% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
  .title {
    margin: 0;
    line-height: 1.3;
  }
  .emblem {
    position: absolute;
    z-index: 0;
    inset: 30px 15px auto;
    aspect-ratio: 1;
    pointer-events: none;
    animation: emblem 1.6s ease-in-out forwards;
  }
  @keyframes emblem {
    0% {
      opacity: 0;
      transform: scale(0.92);
    }
    25%,
    45% {
      opacity: 0.6;
      transform: none;
    }
    100% {
      opacity: 0.1;
    }
  }
  /* Everything in the side panel sits above the crest. */
  /* The theme's side panel picture, dimmed under the words (the crest still shows over it). */
  .panel-picture {
    position: absolute;
    z-index: 0;
    inset: 0;
    background: center / cover no-repeat;
    pointer-events: none;
  }
  .panel-picture::after {
    content: '';
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--panel) 72%, transparent);
  }
  aside > :not(.emblem, .panel-picture) {
    position: relative;
    z-index: 1;
  }
  .intro {
    animation: text-in 1.6s ease-out;
  }
  .panel {
    position: relative;
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
    border-top: 1px solid var(--line);
    margin: 8px 0;
  }
  .done,
  .waiting {
    opacity: 0.55;
  }
  /* A finished row fades less, so its tick stands out. */
  .done:has(.tick) {
    opacity: 0.8;
  }
  .tick {
    display: inline-grid;
    place-items: center;
    width: 15px;
    height: 15px;
    margin-right: 5px;
    border-radius: 50%;
    background: #4caf50;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    vertical-align: 1px;
  }
  .skipped {
    margin-right: 5px;
    padding: 0 4px;
    border: 1px solid currentColor;
    border-radius: 4px;
    font-size: 10px;
    opacity: 0.8;
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
    border-color: var(--line);
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
  .story {
    margin: 6px 0;
    padding-left: 16px;
    font-size: 12px;
    line-height: 1.45;
  }
  .skip {
    margin-top: 4px;
  }
  .stories .list {
    max-height: 60vh;
    overflow-y: auto;
    text-align: left;
  }
  .stories section {
    border-left: 4px solid var(--f);
    padding-left: 8px;
    margin-bottom: 8px;
  }
  .stories h4 {
    margin: 0;
    font-size: 13px;
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
    background: var(--raised);
    border: 1px solid var(--accent);
    border-radius: 7px;
    padding: 8px;
    text-align: left;
    min-height: 36px;
  }
  button.quiet {
    border-color: var(--line);
    background: none;
  }
  button.primary {
    text-align: center;
    font-weight: 700;
    font-size: 15px;
    background: var(--accent);
    color: var(--on-accent);
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
    border-color: var(--glow);
    background: color-mix(in srgb, var(--glow) 22%, var(--panel));
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
  .corner {
    position: absolute;
    top: 8px;
    right: 10px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    pointer-events: none;
  }
  .tile {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    max-width: 150px;
    padding: 4px 8px 5px;
    border: 1px solid #8a7a5c;
    border-radius: 4px;
    background: #d9cba8;
    color: #2a241e;
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.4);
    font: 11px/1.25 Georgia, 'Times New Roman', serif;
    text-align: left;
  }
  .tile small {
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .tile .pays {
    padding-top: 3px;
    border-top: 1px solid #8a7a5c;
  }
  .round {
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
    font-family: var(--font-heading);
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
    font-family: var(--font-heading);
    font-size: 17px;
  }
  .hand .card.chosen {
    background: var(--glow);
    box-shadow: 0 0 0 2px var(--glow);
  }
  .total {
    text-align: right;
    font-size: 15px;
  }
  .box .line {
    margin: 0 0 6px;
  }
  .box.encounter {
    width: min(640px, 94vw);
    max-height: 92vh;
    overflow-y: auto;
  }
  .encounter .heading {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 6px;
  }
  .encounter .where {
    font-size: 13px;
    opacity: 0.6;
  }
  .encounter .story {
    font-style: italic;
    opacity: 0.85;
  }
  /* A wide band: short enough to leave room for the options on a phone held sideways. */
  .encounter .card-picture {
    position: relative;
    height: clamp(80px, 30vh, 220px);
    margin-bottom: 8px;
    border-radius: 8px;
    background: center / cover no-repeat;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
  }
  .encounter .card-picture .story {
    margin: 0;
    width: 100%;
    padding: 18px 10px 6px;
    opacity: 1;
    color: #fff;
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.8);
    background: linear-gradient(transparent, rgb(0 0 0 / 0.65));
  }
  .encounter .note {
    margin-bottom: 8px;
  }
  /* Three options side by side, to fit a phone held sideways. */
  .encounter .options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }
  .encounter .options button {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
    padding: 10px;
  }
  .encounter .options button:disabled {
    opacity: 0.4;
  }
  .encounter .why {
    font-size: 12px;
    font-style: italic;
  }
  .encounter .options button.taken {
    opacity: 0.7;
    border-color: var(--c);
  }
  .encounter .cost {
    font-size: 13px;
    font-weight: bold;
  }
  .encounter .gain {
    font-size: 13px;
    opacity: 0.85;
  }
  .encounter .row {
    display: flex;
    justify-content: space-between;
  }
  .back-to-card {
    position: fixed;
    left: 50%;
    bottom: 16px;
    z-index: 20;
    transform: translateX(-50%);
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
