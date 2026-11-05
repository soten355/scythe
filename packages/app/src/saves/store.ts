// Saved games, the player's own maps, factions and mats, and the skins (each a
// theme and its own words, one of them in use), on this device,
// in IndexedDB (kept by installed home-screen apps, unlike some browser
// storage). One record per game, by id; the library is a single record.
import { EMPTY_LIBRARY, type Library } from '../content/library';
import type { SavedGame } from './save';
import { DEFAULT_THEME, type Theme } from '../theme/theme';
import { newSkin, ORIGINAL, type Skin } from '../skins/skin';

const DB = 'scythe';
const STORE = 'games';
const LIBRARY = 'library';
/** The theme from before skins: it becomes the first skin of one's own (see skinIndex). */
const THEME = 'theme';
/** Which skins there are (besides Original) and which is in use; each skin is kept under "skin:<id>". */
const SKINS = 'skins';
const SKIN = 'skin:';

/** The skins kept on this device, besides Original, and the one in use. */
export interface SkinIndex {
  active: string;
  skins: { id: string; name: string }[];
}
/** Encounter cards' pictures, each kept once in the library's store under "picture:<ref>". */
const PICTURE = 'picture:';

const done = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export class SaveStore {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly idb: IDBFactory = globalThis.indexedDB) {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const request = this.idb.open(DB, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(LIBRARY)) db.createObjectStore(LIBRARY);
      };
      request.onsuccess = () => {
        // Let a newer version of the app (in another tab) upgrade the database.
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, use: (store: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
    const db = await this.open();
    const tx = db.transaction(store, mode);
    const finished = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
    const [result] = await Promise.all([done(use(tx.objectStore(store))), finished]);
    return result;
  }

  /** Every saved game, most recently played first. */
  async list(): Promise<SavedGame[]> {
    const all = await this.run('readonly', (s) => s.getAll() as IDBRequest<SavedGame[]>);
    return all.sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0));
  }

  get(id: string): Promise<SavedGame | undefined> {
    return this.run('readonly', (s) => s.get(id) as IDBRequest<SavedGame | undefined>);
  }

  async put(save: SavedGame): Promise<void> {
    await this.run('readwrite', (s) => s.put(plain(save)));
  }

  async delete(id: string): Promise<void> {
    await this.run('readwrite', (s) => s.delete(id));
  }

  /** The player's own maps, factions and mats. */
  async library(): Promise<Library> {
    const saved = await this.run('readonly', (s) => s.get(LIBRARY) as IDBRequest<Library | undefined>, LIBRARY);
    return { ...EMPTY_LIBRARY, ...saved };
  }

  async putLibrary(library: Library): Promise<void> {
    await this.run('readwrite', (s) => s.put(plain(library), LIBRARY), LIBRARY);
  }

  /** Writes some records of the library's store in one go. */
  private async write(records: [string, unknown][], remove: string[] = []): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(LIBRARY, 'readwrite');
    const store = tx.objectStore(LIBRARY);
    for (const [key, value] of records) store.put(plain(value), key);
    for (const key of remove) store.delete(key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }

  /**
   * The skins on this device and the one in use (Original when there are none).
   * A theme kept from before skins becomes a skin of its own, in use, the first time.
   */
  async skinIndex(): Promise<SkinIndex> {
    const index = await this.run('readonly', (s) => s.get(SKINS) as IDBRequest<SkinIndex | undefined>, LIBRARY);
    if (index) return index;
    const old = await this.run('readonly', (s) => s.get(THEME) as IDBRequest<Theme | undefined>, LIBRARY);
    if (!old) return { active: ORIGINAL.id, skins: [] };
    const skin: Skin = { ...newSkin(old.name?.trim() || 'My skin', ORIGINAL, crypto.randomUUID()), theme: { ...DEFAULT_THEME, ...old } };
    const made: SkinIndex = { active: skin.id, skins: [{ id: skin.id, name: skin.name }] };
    await this.write([[SKIN + skin.id, skin], [SKINS, made]], [THEME]);
    return made;
  }

  /** A skin by its ID (Original for Original, or one that's gone). */
  async skin(id: string): Promise<Skin> {
    if (id === ORIGINAL.id) return ORIGINAL;
    const saved = await this.run('readonly', (s) => s.get(SKIN + id) as IDBRequest<Skin | undefined>, LIBRARY);
    return saved ? { ...saved, theme: { ...DEFAULT_THEME, ...saved.theme } } : ORIGINAL;
  }

  /** The skin in use. */
  async activeSkin(): Promise<Skin> {
    return this.skin((await this.skinIndex()).active);
  }

  /** Keeps a skin (new or changed); Original can't be changed. */
  async putSkin(skin: Skin, { use = false } = {}): Promise<void> {
    if (skin.id === ORIGINAL.id) throw new Error("The Original skin can't be changed.");
    const index = await this.skinIndex();
    const skins = index.skins.some((s) => s.id === skin.id) ? index.skins.map((s) => (s.id === skin.id ? { id: skin.id, name: skin.name } : s)) : [...index.skins, { id: skin.id, name: skin.name }];
    await this.write([[SKIN + skin.id, skin], [SKINS, { active: use ? skin.id : index.active, skins }]]);
  }

  /** Puts a skin in use. */
  async useSkin(id: string): Promise<void> {
    const index = await this.skinIndex();
    if (id !== ORIGINAL.id && !index.skins.some((s) => s.id === id)) throw new Error('That skin is no longer on this device.');
    await this.write([[SKINS, { ...index, active: id }]]);
  }

  /** Removes a skin; if it was in use, Original is used instead. */
  async deleteSkin(id: string): Promise<void> {
    const index = await this.skinIndex();
    await this.write([[SKINS, { active: index.active === id ? ORIGINAL.id : index.active, skins: index.skins.filter((s) => s.id !== id) }]], [SKIN + id]);
  }

  /** The theme of the skin in use (the usual look with Original). */
  async theme(): Promise<Theme> {
    return (await this.activeSkin()).theme;
  }

  /**
   * Changes the theme of the skin in use. Original can't be changed, so a
   * change made while it's in use starts a skin of one's own ("My skin"), put in use.
   */
  async putTheme(theme: Theme): Promise<void> {
    const skin = await this.activeSkin();
    if (skin.id === ORIGINAL.id) await this.putSkin({ ...newSkin('My skin', ORIGINAL, crypto.randomUUID()), theme }, { use: true });
    else await this.putSkin({ ...skin, theme });
  }

  /** Every encounter card picture kept on the device, by reference. */
  async cardPictures(): Promise<Record<string, string>> {
    // Keys alone are cheap to list; then only the pictures are read.
    const keys = (await this.run('readonly', (s) => s.getAllKeys(), LIBRARY)).map(String).filter((k) => k.startsWith(PICTURE));
    const db = await this.open();
    const store = db.transaction(LIBRARY, 'readonly').objectStore(LIBRARY);
    const urls = await Promise.all(keys.map((k) => done(store.get(k) as IDBRequest<string>)));
    return Object.fromEntries(keys.map((k, i) => [k.slice(PICTURE.length), urls[i]!]));
  }

  /** Keeps encounter card pictures (one already kept under its reference is the same picture). */
  async putCardPictures(pictures: Record<string, string>): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(LIBRARY, 'readwrite');
    const store = tx.objectStore(LIBRARY);
    for (const [ref, url] of Object.entries(pictures)) store.put(url, PICTURE + ref);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }
}

/** Plain data for IndexedDB (Svelte's reactive proxies can't be stored). */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
