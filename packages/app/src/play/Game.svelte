<script lang="ts">
  // Pass-and-play game: Nordic on Industrial against Rusviet on Engineering.
  // The game is its setup plus every state reached so far, so undo just steps
  // back (within your own turn). Not saved yet: autosave arrives in Phase 2.
  import { baseBoard, baseFactions, baseMats } from '@scythe/content';
  import { applyAction, legalActions, newGame, type Action, type GameState, type Location } from '@scythe/engine';
  import Board from './Board.svelte';
  import MatDrawer from './MatDrawer.svelte';
  import PlayerBar from './PlayerBar.svelte';
  import { buildPrompt, type Selection } from './prompt';

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
  /** Index in history where the current player's turn began. */
  let turnStart = $state(0);
  let selection: Selection = $state({});
  /** Seat being handed the device; the board is hidden until they tap. */
  let handoff: number | null = $state(null);

  const game = $derived(history[history.length - 1]!);
  const actions = $derived(legalActions(game, game.currentPlayer));
  const prompt = $derived(buildPrompt(game, actions, selection));
  const canUndo = $derived(history.length - 1 > turnStart);

  function act(action: Action) {
    const seat = game.currentPlayer;
    const next = applyAction(game, action);
    history = [...history, next];
    selection = {};
    if (next.currentPlayer !== seat) {
      turnStart = history.length - 1;
      handoff = next.currentPlayer;
    }
  }

  function tap(at: Location) {
    const action = prompt.tapActions.get(at);
    if (action) act(action);
    else selection = { hex: at };
  }

  function undo() {
    if (!canUndo) return;
    history = history.slice(0, -1);
    selection = {};
  }

  function restart() {
    if (!confirm('Start a new game? This one is not saved.')) return;
    history = [start()];
    turnStart = 0;
    selection = {};
    handoff = null;
  }

  const name = (seat: number) => game.setup.players[seat]!.faction.name;
  const color = (seat: number) => game.setup.players[seat]!.faction.color;
</script>

<div class="game">
  <header>
    <a class="menu" href={import.meta.env.BASE_URL}>☰</a>
    <PlayerBar {game} />
  </header>

  <main>
    <div class="board"><Board {game} {prompt} onTap={tap} /></div>
    <aside style:--c={color(game.currentPlayer)}>
      <p class="title">{prompt.title}</p>
      <div class="buttons">
        {#each prompt.buttons as b, i (i)}
          <button class:quiet={b.quiet} onclick={() => (b.action ? act(b.action) : (selection = b.select ?? {}))}>{b.label}</button>
        {/each}
      </div>
      <div class="footer">
        <button class="quiet" onclick={undo} disabled={!canUndo}>↶ Undo</button>
        <button class="quiet" onclick={restart}>New game</button>
      </div>
    </aside>
  </main>

  <MatDrawer {game} {actions} onAction={act} />

  {#if handoff !== null}
    <button class="handoff" style:--c={color(handoff)} onclick={() => (handoff = null)}>
      <span>Pass to <b>{name(handoff)}</b></span>
      <small>Tap when ready</small>
    </button>
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
  .buttons {
    flex: 1;
    overflow-y: auto;
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
  .handoff b {
    color: var(--c);
    filter: brightness(1.4);
  }
  .handoff small {
    font-size: 14px;
    opacity: 0.6;
  }
</style>
