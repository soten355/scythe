// Saved games, the player's own maps, factions and mats, and the theme in use, on this device,
// in IndexedDB (kept by installed home-screen apps, unlike some browser
// storage). One record per game, by id; the library is a single record.
import { EMPTY_LIBRARY, type Library } from '../content/library';
import type { SavedGame } from './save';
import { DEFAULT_THEME, type Theme } from '../theme/theme';

const DB = 'scythe';
const STORE = 'games';
const LIBRARY = 'library';
/** The theme in use, kept in the library's store under its own key. */
const THEME = 'theme';

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

  /** The theme in use (pictures and colours); the usual look if none is set. */
  async theme(): Promise<Theme> {
    const saved = await this.run('readonly', (s) => s.get(THEME) as IDBRequest<Theme | undefined>, LIBRARY);
    return { ...DEFAULT_THEME, ...saved };
  }

  async putTheme(theme: Theme): Promise<void> {
    await this.run('readwrite', (s) => s.put(plain(theme), THEME), LIBRARY);
  }
}

/** Plain data for IndexedDB (Svelte's reactive proxies can't be stored). */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
