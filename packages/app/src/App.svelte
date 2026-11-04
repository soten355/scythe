<script lang="ts">
  // The whole app: the opening menu, the new game screen, saved games and the
  // game. A game in progress stays alive behind the menu, so it can be
  // continued; every game is also kept on the device after every move.
  import type { GameSetup } from '@scythe/engine';
  import type { Level } from '@scythe/bots';
  import Game from './play/Game.svelte';
  import Home from './menu/Home.svelte';
  import Workshop from './menu/Workshop.svelte';
  import Codex from './menu/Codex.svelte';
  import NewGame from './menu/NewGame.svelte';
  import SavedGames from './menu/SavedGames.svelte';
  import { BUILT_IN } from './content/catalog';
  import { createSave, restore, type SavedGame } from './saves/save';
  import { SaveStore } from './saves/store';
  import { exportSave, readSaveFile } from './saves/files';
  import { boardLook, DEFAULT_THEME, uiStyle, type Theme } from './theme/theme';
  import { useCardPictures, useTheme } from './theme/current.svelte';
  import { addToLibrary, catalogWith, EMPTY_LIBRARY, parseContentFile, removeFromLibrary, type Library, type LibraryKind } from './content/library';

  const builtIn = BUILT_IN;

  const store = new SaveStore();

  // The editors' back links come back to the workshop (#workshop).
  let screen: 'home' | 'new' | 'saves' | 'workshop' | 'codex' | 'game' = $state(location.hash === '#workshop' ? 'workshop' : 'home');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  /** The game open (as it was when opened: the game itself keeps its moves). */
  let current = $state.raw<{ key: number; save: SavedGame } | null>(null);
  let opened = 0;
  /** Every saved game, newest first (refreshed when a menu opens). */
  let saves: SavedGame[] = $state.raw([]);
  let message = $state('');
  /** The player's own maps, factions and mats, kept on the device. */
  let library: Library = $state.raw(EMPTY_LIBRARY);
  /** What there is to pick from on the new game screen. */
  const catalog = $derived(catalogWith(builtIn, library));

  async function refresh() {
    try {
      saves = await store.list();
    } catch {
      message = "Saved games can't be read on this device.";
    }
  }
  void refresh();
  store.library().then((l) => (library = l), () => {});
  /** The theme in use (made in the theme editor), for the board's look. */
  let theme: Theme = $state.raw(DEFAULT_THEME);
  store.theme().then((t) => ((theme = t), useTheme(t)), () => {});
  store.cardPictures().then(useCardPictures, () => {});
  const look = $derived(boardLook(theme));
  // The look and feel: the theme's colours and fonts, set on the page for every screen to read.
  $effect(() => {
    for (const [name, value] of Object.entries(uiStyle(theme))) document.documentElement.style.setProperty(name, value);
  });
  const menuPicture = $derived(theme.pictures['ui.menu']);

  /** The game Continue picks up: the one open, or the last one played that isn't finished. */
  const resumable = $derived(current?.save ?? saves.find((s) => !s.finished) ?? null);

  function go(to: typeof screen) {
    screen = to;
    message = '';
    if (to === 'home' || to === 'saves') void refresh();
    // The editors may have added to the library since.
    if (to === 'new' || to === 'codex') store.library().then((l) => (library = l), () => {});
  }

  async function keep(next: Library) {
    library = next;
    try {
      await store.putLibrary(next);
    } catch {
      message = "That couldn't be kept on this device; it's here until the app is closed.";
    }
  }

  async function importContent(file: File) {
    try {
      const content = parseContentFile(await file.text());
      // Its encounter cards' pictures are kept on the device, apart from the cards.
      if (content.pictures) {
        await store.putCardPictures(content.pictures);
        useCardPictures(await store.cardPictures());
      }
      const { library: next, added } = addToLibrary(library, builtIn, content);
      message = added.length ? `Added ${added.join(', ')}.` : 'Nothing new: everything in that file is already here.';
      await keep(next);
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
  }

  const removeContent = (kind: LibraryKind, id: string | string[]) => keep(removeFromLibrary(library, kind, id));

  function play(save: SavedGame) {
    if (current?.save.id !== save.id) current = { key: ++opened, save };
    go('game');
  }

  function persist(save: SavedGame) {
    store.put(save).catch(() => alert("This game couldn't be saved on the device. Save it to a file from the game menu to keep it."));
  }

  function start(setup: GameSetup, mapName: string, bots: (Level | null)[]) {
    const save = createSave(setup, crypto.randomUUID(), new Date(), mapName, bots);
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

{#if menuPicture && screen !== 'game'}
  <!-- The theme's menu picture: in full behind the opening menu, dimmed behind the others. -->
  <div class="menu-picture" class:dim={screen !== 'home'} style:background-image="url({menuPicture})" aria-hidden="true"></div>
{/if}

{#if screen === 'home'}
  <Home canContinue={resumable !== null} savedCount={saves.length} onContinue={() => resumable && play(resumable)} onNewGame={() => go('new')} onSaves={() => go('saves')} onCodex={() => go('codex')} onWorkshop={() => go('workshop')} />
{:else if screen === 'codex'}
  <Codex {catalog} {builtIn} board={builtIn.maps[0]!.board} onBack={() => go('home')} />
{:else if screen === 'workshop'}
  <Workshop onBack={() => go('home')} />
{:else if screen === 'new'}
  <NewGame {catalog} {library} {message} onStart={start} onImport={importContent} onRemove={removeContent} onBack={() => go(current ? 'game' : 'home')} backLabel={current ? 'Back to the game' : 'Menu'} />
{:else if screen === 'saves'}
  <SavedGames {saves} {message} onOpen={open} onExport={exportSave} onDelete={remove} onImport={importFile} onBack={() => go('home')} />
{/if}

{#if current}
  <div class:hidden={screen !== 'game'}>
    {#key current.key}
      <Game save={current.save} onSave={persist} onNewGame={() => go('new')} onMenu={() => go('home')} {look} />
    {/key}
  </div>
{/if}

<style>
  .hidden {
    display: none;
  }
  .menu-picture {
    position: fixed;
    inset: 0;
    z-index: -1;
    background: center / cover no-repeat;
  }
  /* A soft pool of the background colour behind the opening menu's buttons, so they read over any picture. */
  .menu-picture::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 34% 60% at 50% 50%, color-mix(in srgb, var(--bg) 70%, transparent), transparent);
  }
  .menu-picture.dim::after {
    background: color-mix(in srgb, var(--bg) 82%, transparent);
  }
</style>
