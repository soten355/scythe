import { describe, expect, it } from 'vitest';
import { BOT_SPEEDS, botPause, DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';

const memory = () => {
  const kept = new Map<string, string>();
  return { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) };
};

describe('settings', () => {
  it('starts from the usual ones, and keeps what is changed', () => {
    const storage = memory();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    saveSettings({ ...DEFAULT_SETTINGS, botSpeed: 'quick' }, storage);
    expect(loadSettings(storage).botSpeed).toBe('quick');
  });

  it('ignores a bot speed it does not know', () => {
    const storage = memory();
    storage.setItem('scythe-settings', JSON.stringify({ botSpeed: 'warp' }));
    expect(loadSettings(storage).botSpeed).toBe(DEFAULT_SETTINGS.botSpeed);
  });
});

describe("how long a bot's move stays on screen", () => {
  const section = { type: 'chooseSection', section: 0 } as const;
  const move = { type: 'moveUnit', unit: { kind: 'character' }, to: 'A1' } as const;
  const pay = { type: 'pay', hex: 'A1' } as const;

  it('holds longest at the start of its turn (its portrait sits there), then on the moves to watch, briefly on small steps', () => {
    for (const { id } of BOT_SPEEDS) {
      expect(botPause(section, id)).toBeGreaterThanOrEqual(botPause(move, id));
      expect(botPause(move, id)).toBeGreaterThan(botPause(pay, id));
    }
  });

  it('is slower at each speed down the list', () => {
    for (let i = 1; i < BOT_SPEEDS.length; i++) {
      const [faster, slower] = [BOT_SPEEDS[i - 1]!.id, BOT_SPEEDS[i]!.id];
      for (const a of [section, move, pay]) expect(botPause(a, slower)).toBeGreaterThan(botPause(a, faster));
    }
  });

  it('by default lets the portrait be seen before the bot starts', () => {
    // The portrait has faded in by 2 seconds into the turn.
    expect(botPause(section, DEFAULT_SETTINGS.botSpeed)).toBeGreaterThanOrEqual(2500);
  });
});
