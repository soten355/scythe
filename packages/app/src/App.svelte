<script lang="ts">
  // The whole app: the opening menu, the new game screen and the game. A game
  // in progress stays alive behind the menu, so it can be continued.
  import { baseBoard, baseFactions, baseMats } from '@scythe/content';
  import type { GameSetup } from '@scythe/engine';
  import Game from './play/Game.svelte';
  import Home from './menu/Home.svelte';
  import NewGame from './menu/NewGame.svelte';
  import type { Catalog } from './menu/setup';

  /** What there is to pick from. Maps made in the map editor can join the list later. */
  const catalog: Catalog = {
    maps: [{ id: 'standard', name: 'Standard map', board: baseBoard }],
    factions: baseFactions,
    mats: baseMats,
  };

  let screen: 'home' | 'new' | 'game' = $state('home');
  let current: { id: number; setup: GameSetup } | null = $state(null);
  let games = 0;

  function start(setup: GameSetup) {
    current = { id: ++games, setup };
    screen = 'game';
  }
</script>

{#if screen === 'home'}
  <Home canContinue={current !== null} onContinue={() => (screen = 'game')} onNewGame={() => (screen = 'new')} />
{:else if screen === 'new'}
  <NewGame {catalog} onStart={start} onBack={() => (screen = current ? 'game' : 'home')} backLabel={current ? 'Back to the game' : 'Menu'} />
{/if}

{#if current}
  <div class:hidden={screen !== 'game'}>
    {#key current.id}
      <Game setup={current.setup} onNewGame={() => (screen = 'new')} onMenu={() => (screen = 'home')} />
    {/key}
  </div>
{/if}

<style>
  .hidden {
    display: none;
  }
</style>
