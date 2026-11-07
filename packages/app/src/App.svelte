<script lang="ts">
  // The whole app: the opening menu, the new game screen, saved games, the
  // codex, the skins and the game. The skin in use gives every screen its look
  // and the factions, mats and maps their names; a game shows in the skin it
  // was started in. A game in progress stays alive behind the menu, so it can be
  // continued; every game is also kept on the device after every move.
  import type { GameSetup } from '@scythe/engine';
  import type { Level } from '@scythe/bots';
  import Game from './play/Game.svelte';
  import Home from './menu/Home.svelte';
  import Workshop from './menu/Workshop.svelte';
  import Codex from './menu/Codex.svelte';
  import Skins from './menu/Skins.svelte';
  import NewGame from './menu/NewGame.svelte';
  import SavedGames from './menu/SavedGames.svelte';
  import { BUILT_IN } from './content/catalog';
  import { createSave, restore, type SavedGame } from './saves/save';
  import { SaveStore } from './saves/store';
  import { exportSave, exportSkin, readSaveFile } from './saves/files';
  import { boardLook, uiStyle } from './theme/theme';
  import { applyWords, cardsToShare, freeName, newSkin, ORIGINAL, parseSkinCards, parseSkinFile, useSkinCards, type Skin, type SkinCards } from './skins/skin';
  import type { SkinIndex } from './saves/store';
  import { untrack } from 'svelte';
  import { useCardPictures, useTheme } from './theme/current.svelte';
  import { addToLibrary, catalogWith, EMPTY_LIBRARY, parseContentFile, removeFromLibrary, type Library, type LibraryKind } from './content/library';

  const builtIn = BUILT_IN;

  const store = new SaveStore();

  // The editors' back links come back to the workshop (#workshop).
  type Screen = 'home' | 'new' | 'saves' | 'workshop' | 'codex' | 'skins' | 'game';
  let screen = $state<Screen>(location.hash === '#workshop' ? 'workshop' : location.hash === '#skins' ? 'skins' : 'home');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  /** The game open (as it was when opened: the game itself keeps its moves). */
  let current = $state.raw<{ key: number; save: SavedGame } | null>(null);
  let opened = 0;
  /** Every saved game, newest first (refreshed when a menu opens). */
  let saves: SavedGame[] = $state.raw([]);
  let message = $state('');
  /** The player's own maps, factions and mats, kept on the device. */
  let library: Library = $state.raw(EMPTY_LIBRARY);
  /** The skin in use, and every skin on the device. */
  let skin: Skin = $state.raw(ORIGINAL);
  let skinIndex: SkinIndex = $state.raw({ active: ORIGINAL.id, skins: [] });
  async function loadSkins() {
    skinIndex = await store.skinIndex();
    skin = await store.skin(skinIndex.active);
  }
  loadSkins().catch(() => {});
  /** What there is to pick from on the new game screen, named as the skin names it. */
  const catalog = $derived(applyWords(catalogWith(builtIn, library), skin.words));

  async function refresh() {
    try {
      saves = await store.list();
    } catch {
      message = "Saved games can't be read on this device.";
    }
  }
  void refresh();
  store.library().then((l) => (library = l), () => {});
  /** The skin the open game was started in, when it's another one on this device. */
  let gameSkin = $state.raw<Skin | null>(null);
  // Follows the open game and the skin in use (a game keeps its skin when another is put in use).
  $effect(() => {
    const save = current?.save;
    const id = save?.skin;
    if (!save || !id || id === skin.id || !skinIndex.skins.some((s) => s.id === id)) {
      gameSkin = null;
      return;
    }
    if (untrack(() => gameSkin?.id) === id) return;
    store.skin(id).then((found) => {
      if (current?.save.id === save.id) gameSkin = found;
    }, () => {});
  });
  /** The look on screen: the open game's skin while it's showing, else the skin in use. */
  const theme = $derived(screen === 'game' && gameSkin ? gameSkin.theme : skin.theme);
  $effect(() => useTheme(theme));
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
    if (to === 'skins') {
      skinMessage = '';
      store.library().then((l) => (library = l), () => {});
    }
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

  // Skins.
  let skinMessage = $state('');
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  /** How many of their own cards the player has in each deck (the made-up samples don't count). */
  const ownCards = $derived({ encounters: library.encounters.length, factory: library.factory.length, objectives: library.objectives.length });
  /** Does something to the skins, then reads them again; says what happened (or went wrong). */
  async function skinDo(what: () => Promise<unknown>, done = '') {
    try {
      const said = await what();
      await loadSkins();
      skinMessage = typeof said === 'string' ? said : done;
    } catch (e) {
      skinMessage = e instanceof Error ? e.message : String(e);
    }
  }
  const useSkin = (id: string) => skinDo(() => store.useSkin(id));
  const takenNames = (except?: string) => skinIndex.skins.filter((s) => s.id !== except).map((s) => s.name);
  const makeSkin = (wanted: string, from: string) =>
    skinDo(async () => {
      const name = freeName(wanted, takenNames());
      await store.putSkin(newSkin(name, await store.skin(from), crypto.randomUUID()), { use: true });
      return `Made "${name}" and put it in use. Edit it from here or the Workshop.`;
    });
  const renameSkin = (id: string, name: string) => skinDo(async () => store.putSkin({ ...(await store.skin(id)), name: freeName(name, takenNames(id)) }));
  const deleteSkin = (id: string) => skinDo(() => store.deleteSkin(id), 'Deleted.');
  /** Saves a skin to a file, with the player's own card decks if asked. */
  const exportSkinById = (id: string, withCards: boolean) =>
    skinDo(async () => void (await exportSkin(await store.skin(id), withCards ? cardsToShare(library, await store.cardPictures()) : undefined)));
  const importSkin = (file: File) =>
    skinDo(async () => {
      const text = await file.text();
      const read = parseSkinFile(text, crypto.randomUUID());
      const opened = { ...read, name: freeName(read.name, skinIndex.skins.map((s) => s.name)) };
      // Its cards, if it brings any, are checked before anything is kept.
      let cards: SkinCards | undefined;
      let cardTrouble = '';
      try {
        cards = parseSkinCards(text);
      } catch (e) {
        cardTrouble = e instanceof Error ? e.message : String(e);
      }
      await store.putSkin(opened, { use: true });
      const added = `Added "${opened.name}" and put it in use.`;
      if (cardTrouble) return `${added} Its cards weren't used: ${cardTrouble}`;
      if (!cards) return added;
      const what = [plural(cards.encounters.length, 'encounter card'), plural(cards.factory.length, 'Factory card'), plural(cards.objectives.length, 'objective card')].filter((t) => !t.startsWith('0 ')).join(', ');
      if (!confirm(`"${opened.name}" comes with its own cards: ${what}. Use them for new games? They take the place of the cards new games use now (games already started keep theirs).`)) return `${added} Its cards were left out.`;
      await store.putCardPictures(cards.pictures);
      useCardPictures(await store.cardPictures());
      await keep(useSkinCards(library, cards));
      return `${added} New games use its cards: ${what}.`;
    });

  function persist(save: SavedGame) {
    store.put(save).catch(() => alert("This game couldn't be saved on the device. Save it to a file from the game menu to keep it."));
  }

  function start(setup: GameSetup, mapName: string, bots: (Level | null)[]) {
    const save = createSave(setup, crypto.randomUUID(), new Date(), mapName, bots, skin.id);
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
  <Home canContinue={resumable !== null} savedCount={saves.length} onContinue={() => resumable && play(resumable)} onNewGame={() => go('new')} onSaves={() => go('saves')} onCodex={() => go('codex')} onSkins={() => go('skins')} onWorkshop={() => go('workshop')} skinName={skin.name} />
{:else if screen === 'codex'}
  <Codex {catalog} {builtIn} board={builtIn.maps[0]!.board} {look} words={skin.words} onBack={() => go('home')} />
{:else if screen === 'skins'}
  <Skins index={skinIndex} factions={builtIn.factions} cards={ownCards} message={skinMessage} loadSkin={(id) => store.skin(id)} onUse={useSkin} onNew={makeSkin} onRename={renameSkin} onDelete={deleteSkin} onExport={exportSkinById} onImport={importSkin} onBack={() => go('home')} />
{:else if screen === 'workshop'}
  <Workshop onBack={() => go('home')} />
{:else if screen === 'new'}
  <NewGame {catalog} {library} {message} onStart={start} onImport={importContent} onRemove={removeContent} onBack={() => go(current ? 'game' : 'home')} backLabel={current ? 'Back to the game' : 'Menu'} skins={[{ id: ORIGINAL.id, name: ORIGINAL.name }, ...skinIndex.skins]} skin={skin.id} onSkin={useSkin} />
{:else if screen === 'saves'}
  <SavedGames {saves} {message} onOpen={open} onExport={exportSave} onDelete={remove} onImport={importFile} onBack={() => go('home')} />
{/if}

{#if current}
  <div class="game-frame" class:hidden={screen !== 'game'}>
    {#key current.key}
      <Game save={current.save} onSave={persist} onNewGame={() => go('new')} onMenu={() => go('home')} {look} />
    {/key}
  </div>
{/if}

<style>
  .hidden {
    display: none;
  }
  /* The game: always laid out sideways. Its sizes and phone rules measure this frame. */
  .game-frame {
    container: screen / size;
    position: fixed;
    inset: 0;
  }
  /*
   * iPhones won't let a web app lock its rotation, so on a phone held upright the
   * frame is drawn a quarter turn round, sideways however the phone is held. Its
   * left edge lies along the phone's top, so the safe margins go round with it.
   * Keep the rule's condition in step with play/frame.ts.
   */
  @media (orientation: portrait) and (pointer: coarse) and (max-width: 600px) {
    .game-frame {
      inset: 0 auto auto 0;
      width: 100dvh;
      height: 100vw;
      transform-origin: top left;
      transform: translateX(100vw) rotate(90deg);
      --safe-top: calc(env(safe-area-inset-right) + 18px);
      --safe-right: env(safe-area-inset-bottom);
      --safe-bottom: env(safe-area-inset-left);
      --safe-left: env(safe-area-inset-top);
    }
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
