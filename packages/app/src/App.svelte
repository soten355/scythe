<script lang="ts">
  // The whole app: the opening menu, the new game screen, saved games and the
  // game. A game in progress stays alive behind the menu, so it can be
  // continued; every game is also kept on the device after every move.
  import { baseBoard, baseFactions, baseMats } from '@scythe/content';
  import type { GameSetup } from '@scythe/engine';
  import Game from './play/Game.svelte';
  import Home from './menu/Home.svelte';
  import NewGame from './menu/NewGame.svelte';
  import SavedGames from './menu/SavedGames.svelte';
  import type { Catalog } from './menu/setup';
  import { createSave, restore, type SavedGame } from './saves/save';
  import { SaveStore } from './saves/store';
  import { exportSave, readSaveFile } from './saves/files';

  /** What there is to pick from. Maps made in the map editor can join the list later. */
  const catalog: Catalog = {
    maps: [{ id: 'standard', name: 'Standard map', board: baseBoard }],
    factions: baseFactions,
    mats: baseMats,
  };

  const store = new SaveStore();

  let screen: 'home' | 'new' | 'saves' | 'game' = $state('home');
  /** The game open (as it was when opened: the game itself keeps its moves). */
  let current = $state.raw<{ key: number; save: SavedGame } | null>(null);
  let opened = 0;
  /** Every saved game, newest first (refreshed when a menu opens). */
  let saves: SavedGame[] = $state.raw([]);
  let message = $state('');

  async function refresh() {
    try {
      saves = await store.list();
    } catch {
      message = "Saved games can't be read on this device.";
    }
  }
  void refresh();

  /** The game Continue picks up: the one open, or the last one played that isn't finished. */
  const resumable = $derived(current?.save ?? saves.find((s) => !s.finished) ?? null);

  function go(to: typeof screen) {
    screen = to;
    message = '';
    if (to === 'home' || to === 'saves') void refresh();
  }

  function play(save: SavedGame) {
    if (current?.save.id !== save.id) current = { key: ++opened, save };
    go('game');
  }

  function persist(save: SavedGame) {
    store.put(save).catch(() => alert("This game couldn't be saved on the device. Save it to a file from the game menu to keep it."));
  }

  function start(setup: GameSetup) {
    const save = createSave(setup, crypto.randomUUID(), new Date());
    // Ask the browser not to clear saves when space runs low.
    void navigator.storage?.persist?.();
    persist(save);
    current = { key: ++opened, save };
    go('game');
  }

  function open(save: SavedGame) {
    try {
      restore(save);
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
      return;
    }
    play(save);
  }

  async function remove(save: SavedGame) {
    if (current?.save.id === save.id) current = null;
    await store.delete(save.id);
    await refresh();
  }

  async function importFile(file: File) {
    let save: SavedGame;
    try {
      save = await readSaveFile(file);
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
      return;
    }
    // Never overwrite a game on the device: a file of the same game opens as a copy.
    if (await store.get(save.id)) save = { ...save, id: crypto.randomUUID() };
    await store.put(save);
    play(save);
  }
</script>

{#if screen === 'home'}
  <Home canContinue={resumable !== null} savedCount={saves.length} onContinue={() => resumable && play(resumable)} onNewGame={() => go('new')} onSaves={() => go('saves')} />
{:else if screen === 'new'}
  <NewGame {catalog} onStart={start} onBack={() => go(current ? 'game' : 'home')} backLabel={current ? 'Back to the game' : 'Menu'} />
{:else if screen === 'saves'}
  <SavedGames {saves} {message} onOpen={open} onExport={exportSave} onDelete={remove} onImport={importFile} onBack={() => go('home')} />
{/if}

{#if current}
  <div class:hidden={screen !== 'game'}>
    {#key current.key}
      <Game save={current.save} onSave={persist} onNewGame={() => go('new')} onMenu={() => go('home')} />
    {/key}
  </div>
{/if}

<style>
  .hidden {
    display: none;
  }
</style>
