import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import type { GameSetup } from '@scythe/engine';
import { createSave } from './save';
import { SaveStore } from './store';
import { EMPTY_LIBRARY } from '../content/library';
import { DEFAULT_THEME, setPicture } from '../theme/theme';
import { ORIGINAL, type Skin } from '../skins/skin';

const setup: GameSetup = {
  seed: 1,
  board: baseBoard,
  players: [
    { faction: baseFactions[0]!, mat: baseMats[0]! },
    { faction: baseFactions[1]!, mat: baseMats[1]! },
  ],
};

let store: SaveStore;
beforeEach(() => {
  store = new SaveStore(new IDBFactory());
});

describe('save store', () => {
  it('starts empty', async () => {
    expect(await store.list()).toEqual([]);
    expect(await store.get('nope')).toBeUndefined();
  });

  it('keeps saves, newest first, and replaces one with the same id', async () => {
    const a = createSave(setup, 'a', new Date('2026-11-01T10:00:00Z'));
    const b = createSave(setup, 'b', new Date('2026-11-01T11:00:00Z'));
    await store.put(a);
    await store.put(b);
    expect((await store.list()).map((s) => s.id)).toEqual(['b', 'a']);
    await store.put({ ...a, updated: '2026-11-01T12:00:00.000Z' });
    expect((await store.list()).map((s) => s.id)).toEqual(['a', 'b']);
    expect((await store.get('a'))?.updated).toBe('2026-11-01T12:00:00.000Z');
  });

  it('deletes', async () => {
    await store.put(createSave(setup, 'a', new Date()));
    await store.delete('a');
    expect(await store.list()).toEqual([]);
  });

  it('keeps saves across reopening', async () => {
    const idb = new IDBFactory();
    await new SaveStore(idb).put(createSave(setup, 'a', new Date()));
    expect((await new SaveStore(idb).list()).map((s) => s.id)).toEqual(['a']);
  });

  it('keeps the library of maps, factions and mats', async () => {
    expect(await store.library()).toEqual(EMPTY_LIBRARY);
    const lib = { maps: [], factions: [{ ...baseFactions[0]!, id: 'x', name: 'X' }], mats: [], encounters: [], factory: [], objectives: [], structureBonuses: [] };
    await store.putLibrary(lib);
    expect(await store.library()).toEqual(lib);
    expect(await store.list()).toEqual([]);
  });

  it('opens a database made before the library existed, keeping its games', async () => {
    const idb = new IDBFactory();
    await new Promise<void>((resolve) => {
      const r = idb.open('scythe', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('games', { keyPath: 'id' }).put(createSave(setup, 'old', new Date()));
      r.onsuccess = () => (r.result.close(), resolve());
    });
    const s = new SaveStore(idb);
    expect((await s.list()).map((g) => g.id)).toEqual(['old']);
    expect(await s.library()).toEqual(EMPTY_LIBRARY);
  });

  it('keeps the theme in use (the usual look until one is set)', async () => {
    expect(await store.theme()).toEqual(DEFAULT_THEME);
    const theme = { ...setPicture(DEFAULT_THEME, 'hex.farm', 'data:image/jpeg;base64,AA=='), name: 'Golden' };
    await store.putTheme(theme);
    expect(await store.theme()).toEqual(theme);
    // Separate from the library.
    expect(await store.library()).toEqual(EMPTY_LIBRARY);
  });

  it("keeps encounter cards' pictures, each once by its reference, apart from the library and theme", async () => {
    expect(await store.cardPictures()).toEqual({});
    await store.putCardPictures({ 'pic-a': 'data:image/jpeg;base64,AA==', 'pic-b': 'data:image/jpeg;base64,BB==' });
    await store.putCardPictures({ 'pic-a': 'data:image/jpeg;base64,AA==' });
    expect(await store.cardPictures()).toEqual({ 'pic-a': 'data:image/jpeg;base64,AA==', 'pic-b': 'data:image/jpeg;base64,BB==' });
    expect(await store.library()).toEqual(EMPTY_LIBRARY);
    expect(await store.theme()).toEqual(DEFAULT_THEME);
  });

describe('skins on the device', () => {
  const words: Skin['words'] = { factions: { nordic: { name: 'Frostwake' } }, mats: {}, maps: {} };

  it('starts with Original in use, and nothing of its own', async () => {
    expect(await store.skinIndex()).toEqual({ active: 'original', skins: [] });
    expect(await store.activeSkin()).toEqual(ORIGINAL);
  });

  it('a change to the look while Original is in use starts "My skin", put in use', async () => {
    const theme = setPicture(DEFAULT_THEME, 'ui.menu', 'data:image/png;base64,AA==');
    await store.putTheme(theme);
    const index = await store.skinIndex();
    expect(index.skins).toHaveLength(1);
    expect(index.skins[0]!.name).toBe('My skin');
    expect(index.active).toBe(index.skins[0]!.id);
    expect(await store.theme()).toEqual(theme);
    // Further changes go into that skin.
    const next = setPicture(theme, 'hex.farm', 'data:image/png;base64,BB==');
    await store.putTheme(next);
    expect((await store.skinIndex()).skins).toHaveLength(1);
    expect(await store.theme()).toEqual(next);
  });

  it("changes the words of the skin in use, starting \"My skin\" if Original is in use", async () => {
    const first = await store.changeSkin((s) => ({ ...s, words }));
    expect(first.name).toBe('My skin');
    expect((await store.activeSkin()).words).toEqual(words);
    const again = await store.changeSkin((s) => ({ ...s, words: ORIGINAL.words }));
    expect(again.id).toBe(first.id);
    expect((await store.skinIndex()).skins).toHaveLength(1);
  });

  it('keeps several skins, switches between them, and renames and deletes them', async () => {
    const a: Skin = { id: 'a', name: 'Iron Tide', theme: setPicture(DEFAULT_THEME, 'ui.menu', 'data:image/png;base64,AA=='), words };
    const b: Skin = { id: 'b', name: 'Ashfall', theme: DEFAULT_THEME, words: ORIGINAL.words };
    await store.putSkin(a, { use: true });
    await store.putSkin(b);
    expect(await store.skinIndex()).toEqual({ active: 'a', skins: [{ id: 'a', name: 'Iron Tide' }, { id: 'b', name: 'Ashfall' }] });
    expect(await store.activeSkin()).toEqual(a);
    await store.useSkin('b');
    expect((await store.activeSkin()).name).toBe('Ashfall');
    await store.useSkin('original');
    expect(await store.activeSkin()).toEqual(ORIGINAL);
    await store.putSkin({ ...a, name: 'Iron Tide II' });
    expect((await store.skinIndex()).skins[0]).toEqual({ id: 'a', name: 'Iron Tide II' });
    await store.useSkin('a');
    await store.deleteSkin('a');
    expect(await store.skinIndex()).toEqual({ active: 'original', skins: [{ id: 'b', name: 'Ashfall' }] });
    expect(await store.skin('a')).toEqual(ORIGINAL);
    await expect(store.useSkin('a')).rejects.toThrow(/no longer/);
    await expect(store.putSkin(ORIGINAL)).rejects.toThrow(/can't be changed/);
  });

  describe('saved to a file, or not', () => {
    const skin: Skin = { id: 's', name: 'Iron Tide', theme: DEFAULT_THEME, words };
    const unsaved = async (id: string) => (await store.skinIndex()).skins.find((s) => s.id === id)?.unsaved;

    it('a new skin is not saved to a file until it is', async () => {
      await store.putSkin(skin, { from: 'new' });
      expect(await unsaved('s')).toBe(true);
      await store.markSkinSaved('s');
      expect(await unsaved('s')).toBe(false);
      // A change after that needs saving again.
      await store.putSkin({ ...skin, words: ORIGINAL.words });
      expect(await unsaved('s')).toBe(true);
    });

    it('"My skin", started by a change while Original is in use, is new too', async () => {
      const made = await store.changeSkin((s) => ({ ...s, words }));
      expect(await unsaved(made.id)).toBe(true);
    });

    it('an opened skin file is saved until it is changed, or renamed', async () => {
      await store.putSkin(skin, { from: 'file', use: true });
      expect(await unsaved('s')).toBe(false);
      await store.changeSkin((s) => ({ ...s, words: ORIGINAL.words }));
      expect(await unsaved('s')).toBe(true);
      await store.markSkinSaved('s');
      await store.putSkin({ ...skin, name: 'Iron Tide II' });
      expect(await unsaved('s')).toBe(true);
    });

    it("skins from before this was kept aren't flagged", async () => {
      await store.putSkin(skin);
      await store.putSkin({ ...skin, words: ORIGINAL.words });
      expect(await unsaved('s')).toBeUndefined();
    });
  });

  it('a theme kept from before skins becomes a skin of its own, in use', async () => {
    const old = { ...setPicture(DEFAULT_THEME, 'hex.farm', 'data:image/png;base64,AA=='), name: 'Golden' };
    await (store as unknown as { write: (r: [string, unknown][]) => Promise<void> }).write([['theme', old]]);
    const index = await store.skinIndex();
    expect(index.skins.map((s) => s.name)).toEqual(['Golden']);
    expect(index.active).toBe(index.skins[0]!.id);
    expect(await store.theme()).toEqual(old);
    // Only once.
    expect(await store.skinIndex()).toEqual(index);
  });
});
});
