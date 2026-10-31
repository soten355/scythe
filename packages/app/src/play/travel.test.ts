import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import { applyAction, legalActions, newGame, type Action, type GameState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';
import { buildPrompt } from './prompt';
import { travelOf } from './travel';

const start = (): GameState => {
  const s = newGame({
    seed: 1,
    board: baseBoard,
    players: [
      { faction: baseFactions[0]!, mat: baseMats[0]! },
      { faction: baseFactions[1]!, mat: baseMats[1]! },
    ],
  });
  // Nordic: Speed out, a mech on C5 with a worker and 2 wood.
  return {
    ...s,
    players: [{ ...s.players[0]!, mechs: ['C5'], workers: ['C5', 'A4'], mechAbilities: [3] }, s.players[1]!],
    resources: { C5: { wood: 2 } },
  };
};
const mech = { kind: 'mech' as const, index: 0 };

describe('travel', () => {
  it('follows a unit hex by hex, with what it carried', () => {
    const before = applyAction(start(), { type: 'chooseSection', section: 2 });
    const load: Action[] = [
      { type: 'carryWorker', unit: mech, worker: 0 },
      { type: 'carryResource', unit: mech, resource: 'wood' },
    ];
    // Any two-hex route the prompt offers.
    const p = buildPrompt(before, legalActions(before, 0), { unit: mech });
    const [end, route] = [...p.tapRoutes!][0]!;
    const actions = [...load, ...route];
    const after = actions.reduce(applyAction, before);
    expect(travelOf(before, after, actions, 7)).toEqual({
      id: 7,
      seat: 0,
      kind: 'mechs',
      path: ['C5', (route[0] as { to: string }).to, end],
      workers: 1,
      resources: { wood: 1 },
    });
  });

  it('is nothing when nothing moved', () => {
    const before = start();
    const actions: Action[] = [{ type: 'chooseSection', section: 2 }];
    expect(travelOf(before, actions.reduce(applyAction, before), actions, 1)).toBeNull();
  });
});

describe('settings', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };

  it('remembers the movement speed, with a default', () => {
    const storage = memory();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    saveSettings({ moveMs: 200 }, storage);
    expect(loadSettings(storage).moveMs).toBe(200);
  });
});
