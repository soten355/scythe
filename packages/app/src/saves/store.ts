// Saved games on this device, in IndexedDB (kept by installed home-screen
// apps, unlike some browser storage). One record per game, by id.
import type { SavedGame } from './save';

const DB = 'scythe';
const STORE = 'games';

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
      const request = this.idb.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, use: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    const tx = db.transaction(STORE, mode);
    const finished = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
    const [result] = await Promise.all([done(use(tx.objectStore(STORE))), finished]);
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
}

/** Plain data for IndexedDB (Svelte's reactive proxies can't be stored). */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
