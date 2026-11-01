import { describe, expect, it } from 'vitest';
import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import { activeSeat, ENGINE_VERSION, legalActions, type Action, type GameSetup } from '@scythe/engine';
import { createSave, fileName, parseSaveFile, restore, saveFileText, updateSave } from './save';

const setup: GameSetup = {
  seed: 7,
  board: baseBoard,
  players: [
    { faction: baseFactions[0]!, mat: baseMats[0]! },
    { faction: baseFactions[1]!, mat: baseMats[1]! },
  ],
};
const at = new Date('2026-11-01T12:00:00Z');
const later = new Date('2026-11-01T12:05:00Z');

/** Plays the first legal action, `n` times, as single-action steps. */
function play(n: number) {
  let { history } = restore(createSave(setup, 'g1', at));
  const steps: Action[][] = [];
  for (let i = 0; i < n; i++) {
    const s = history[history.length - 1]!;
    const a = legalActions(s, activeSeat(s))[0]!;
    steps.push([a]);
    history = restore({ ...createSave(setup, 'g1', at), steps }).history;
  }
  return { steps, history };
}

describe('save records', () => {
  it('a new game is its setup, no steps, and the engine version', () => {
    const save = createSave(setup, 'g1', at);
    expect(save).toMatchObject({ id: 'g1', engineVersion: ENGINE_VERSION, steps: [], turnStart: 0, finished: false });
    expect(save.created).toBe(at.toISOString());
    expect(save.summary.factions.map((f) => f.name)).toEqual([baseFactions[0]!.name, baseFactions[1]!.name]);
    expect(save.summary.round).toBe(1);
  });

  it('restoring replays every step, one state per step', () => {
    const { steps, history } = play(5);
    const save = updateSave(createSave(setup, 'g1', at), steps, 3, history[history.length - 1]!, later);
    const back = restore(save);
    expect(back.history).toHaveLength(6);
    expect(back.history[5]).toEqual(history[5]);
    expect(back.turnStart).toBe(3);
    expect(save.updated).toBe(later.toISOString());
    expect(save.created).toBe(at.toISOString());
  });

  it('a step of several actions is one state (one undo step)', () => {
    const { steps } = play(3);
    const save = { ...createSave(setup, 'g1', at), steps: [steps.flat()] };
    const back = restore(save);
    expect(back.history).toHaveLength(2);
    expect(back.history[1]).toEqual(play(3).history[3]);
  });

  it('turnStart out of range is clamped to the last state', () => {
    const { steps } = play(2);
    expect(restore({ ...createSave(setup, 'g1', at), steps, turnStart: 99 }).turnStart).toBe(2);
  });
});

describe('save files', () => {
  it('round-trips through the file text', () => {
    const { steps, history } = play(4);
    const save = updateSave(createSave(setup, 'g1', at), steps, 2, history[4]!, later);
    expect(parseSaveFile(saveFileText(save))).toEqual(save);
  });

  it('carries its own map, factions and mats, so custom ones load without being on the device', () => {
    const custom: GameSetup = {
      ...setup,
      board: { ...baseBoard, rivers: [] },
      players: [
        { faction: { ...baseFactions[0]!, name: 'Home-made', color: '#123456', power: 5 }, mat: { ...baseMats[0]!, name: 'My mat', coins: 9 } },
        setup.players[1]!,
      ],
    };
    const back = parseSaveFile(saveFileText(createSave(custom, 'c1', at)));
    expect(back.setup).toEqual(custom);
    const state = restore(back).history[0]!;
    expect(state.setup.players[0]!.faction.name).toBe('Home-made');
    expect(state.players[0]!.power).toBe(5);
    expect(state.players[0]!.coins).toBe(9);
    expect(back.summary.factions[0]).toEqual({ name: 'Home-made', color: '#123456' });
  });

  it('names the file after the factions and date', () => {
    expect(fileName(createSave(setup, 'g1', at))).toMatch(/^scythe-.+-2026-11-01\.scythe\.json$/);
  });

  it('rejects text that is not a save', () => {
    expect(() => parseSaveFile('not json')).toThrow(/isn't a Scythe save/);
    expect(() => parseSaveFile('{"hello":1}')).toThrow(/isn't a Scythe save/);
  });

  it('rejects a save whose moves are not legal, saying which one', () => {
    const { steps } = play(3);
    const bad = { ...createSave(setup, 'g1', at), steps: [steps[0]!, [{ type: 'nonsense' } as unknown as Action]] };
    expect(() => parseSaveFile(saveFileText(bad))).toThrow(/move 2/);
  });

  it('a save from another engine version that no longer replays says so', () => {
    const bad = { ...createSave(setup, 'g1', at), engineVersion: '0.0.0-old', steps: [[{ type: 'nonsense' } as unknown as Action]] };
    expect(() => parseSaveFile(saveFileText(bad))).toThrow(/version 0\.0\.0-old/);
  });
});
