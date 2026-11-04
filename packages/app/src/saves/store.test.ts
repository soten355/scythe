import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import type { GameSetup } from '@scythe/engine';
import { createSave } from './save';
import { SaveStore } from './store';
import { EMPTY_LIBRARY } from '../content/library';
import { DEFAULT_THEME, setPicture } from '../theme/theme';

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
});

