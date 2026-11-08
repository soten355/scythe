// Phase 2's finish line: complete 5-faction games, with every rule and deck
// (encounters, the Factory, objectives, a structure bonus tile), played to
// final scoring by random legal moves, then saved to a file and read back.
import { activeSeat, applyAction, isGameOver, legalActions, newGame, nextInt, seedRng, standings, type Action } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { BUILT_IN } from '../content/catalog';
import { toSetup } from '../menu/setup';
import { createSave, parseSaveFile, restore, saveFileText, updateSave } from './save';

describe('a full 5-faction game', () => {
  // Games picked so each one takes a Factory card and completes an objective too (random moves rarely manage either); mats rotate between games.
  it.each([3, 6, 7])('plays to final scoring and comes back the same from a save file (game %i)', (seed) => {
    const choice = { map: 'standard', players: BUILT_IN.factions.map((f, i) => ({ faction: f.id, mat: BUILT_IN.mats[(i + seed) % 5]!.id, bot: null })) };
    const setup = toSetup(choice, BUILT_IN, seed);
    expect(setup.players).toHaveLength(5);
    expect(setup).toMatchObject({ encounters: expect.any(Array), factory: expect.any(Array), objectives: expect.any(Array), structureBonuses: expect.any(Array) });

    let state = newGame(setup);
    let rng = seedRng(seed);
    const steps: Action[][] = [];
    while (!isGameOver(state)) {
      const options = legalActions(state, activeSeat(state));
      expect(options.length, `stuck at move ${steps.length + 1}`).toBeGreaterThan(0);
      let pick: number;
      [pick, rng] = nextInt(rng, options.length);
      state = applyAction(state, options[pick]!);
      steps.push([options[pick]!]);
      expect(steps.length, 'the game never ended').toBeLessThan(40_000);
    }

    const saved = updateSave(createSave(setup, `full-${seed}`, new Date('2026-11-02T00:00:00Z')), steps, steps.length, state, new Date('2026-11-02T01:00:00Z'));
    expect(saved.finished).toBe(true);
    const reopened = parseSaveFile(saveFileText(saved));
    const { history } = restore(reopened);
    const final = history.at(-1)!;
    expect(final).toEqual(state);
    expect(isGameOver(final)).toBe(true);
    expect(standings(final)).toEqual(standings(state));
    // Every part of the rules came up: encounters, a Factory card, an objective, the structure bonus tile.
    expect(final.encounterDiscard.length).toBeGreaterThan(0);
    expect(final.players.some((p) => p.factoryCard)).toBe(true);
    expect(final.players.some((p) => p.stars.includes('objective'))).toBe(true);
    expect(final.structureBonus).toBeDefined();
    // Someone placed their sixth star, and the winner has the most coins.
    expect(final.players.some((p) => p.stars.length >= 6)).toBe(true);
    const [winner, ...rest] = standings(final);
    for (const r of rest) expect(winner!.total).toBeGreaterThanOrEqual(r.total);
  }, 120_000);
});
