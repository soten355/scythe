// The player's preferences, kept on this device (not part of any game).
// There's no screen for them yet; they're read once when a game opens.

export interface Settings {
  /** How long a moving unit takes to cross one hex, in milliseconds. */
  moveMs: number;
}

export const DEFAULT_SETTINGS: Settings = { moveMs: 350 };
const KEY = 'scythe-settings';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

export function loadSettings(storage: Storage | undefined = globalThis.localStorage): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(storage?.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings, storage: Storage | undefined = globalThis.localStorage): void {
  storage?.setItem(KEY, JSON.stringify(settings));
}
