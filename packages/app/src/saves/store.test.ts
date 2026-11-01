import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import type { GameSetup } from '@scythe/engine';
import { createSave } from './save';
import { SaveStore } from './store';

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
});
