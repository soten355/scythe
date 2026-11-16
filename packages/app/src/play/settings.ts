// The player's preferences, kept on this device (not part of any game), and
// changed on the settings screen (Settings.svelte, from the main menu or the
// game's ☰ menu).
import type { Action } from '@scythe/engine';
import { paceOf } from './narrate';

/**
 * How long a bot's moves stay on screen. Purely for show: a bot takes as long
 * as it needs to think, and only then is held for whatever is left of these.
 * The start of its turn holds longest, so its portrait sits there as if it
 * were weighing its move.
 */
export type BotSpeed = 'quick' | 'steady' | 'slow' | 'unhurried';

export const BOT_SPEEDS: { id: BotSpeed; label: string; hint: string; turnStart: number; watch: number; quick: number }[] = [
  { id: 'quick', label: 'Quick', hint: 'Just long enough to follow.', turnStart: 600, watch: 500, quick: 120 },
  { id: 'steady', label: 'Steady', hint: 'A short pause to start each turn.', turnStart: 1800, watch: 900, quick: 200 },
  { id: 'slow', label: 'Slow', hint: 'Each bot sits a moment before acting.', turnStart: 3000, watch: 1500, quick: 350 },
  { id: 'unhurried', label: 'Unhurried', hint: 'Plenty of time with each bot and move.', turnStart: 5000, watch: 2400, quick: 600 },
];

export interface Settings {
  /** How long a moving unit takes to cross one hex, in milliseconds. */
  moveMs: number;
  /** How long a bot's moves stay on screen. */
  botSpeed: BotSpeed;
}

export const DEFAULT_SETTINGS: Settings = { moveMs: 350, botSpeed: 'slow' };
/** The unit move speeds offered: milliseconds per hex. */
export const MOVE_SPEEDS: { ms: number; label: string }[] = [
  { ms: 200, label: 'Quick' },
  { ms: 350, label: 'Steady' },
  { ms: 600, label: 'Slow' },
];
const KEY = 'scythe-settings';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

export function loadSettings(storage: Storage | undefined = globalThis.localStorage): Settings {
  try {
    const kept = JSON.parse(storage?.getItem(KEY) ?? '{}') as Partial<Settings>;
    return {
      moveMs: typeof kept.moveMs === 'number' && kept.moveMs > 0 ? kept.moveMs : DEFAULT_SETTINGS.moveMs,
      botSpeed: BOT_SPEEDS.some((s) => s.id === kept.botSpeed) ? kept.botSpeed! : DEFAULT_SETTINGS.botSpeed,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings, storage: Storage | undefined = globalThis.localStorage): void {
  storage?.setItem(KEY, JSON.stringify(settings));
}

/** How long a bot's move stays on screen (milliseconds, counting its thinking). */
export function botPause(action: Action, speed: BotSpeed): number {
  const s = BOT_SPEEDS.find((b) => b.id === speed) ?? BOT_SPEEDS.find((b) => b.id === DEFAULT_SETTINGS.botSpeed)!;
  if (action.type === 'chooseSection') return s.turnStart;
  return paceOf(action) === 'watch' ? s.watch : s.quick;
}
