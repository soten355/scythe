import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import { applyAction, legalActions, newGame, type Action, type GameState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { buildPrompt, label } from './prompt';

// Nordic (home "ne": workers on B5, B6) on Industrial; Rusviet on Engineering.
const start = () =>
  newGame({
    seed: 1,
    board: baseBoard,
    players: [
      { faction: baseFactions[0]!, mat: baseMats[0]! },
      { faction: baseFactions[1]!, mat: baseMats[1]! },
    ],
  });
const play = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);
const prompt = (state: GameState, sel = {}) => buildPrompt(state, legalActions(state, state.currentPlayer), sel);

describe('the prompt', () => {
  it('offers the four sections by name at the start of a turn', () => {
    const p = prompt(start());
    expect(p.title).toBe('Nordic: choose a section of your mat');
    expect(p.buttons.map((b) => b.label)).toEqual(['Bolster / Upgrade', 'Produce / Deploy', 'Move / Build', 'Trade / Enlist']);
    expect(p.highlights.size).toBe(0);
  });

  it('highlights hexes with units to move, and offers coins instead', () => {
    const state = play(start(), { type: 'chooseSection', section: 2 });
    const p = prompt(state);
    expect([...p.highlights].sort()).toEqual(['B5', 'B6', 'home']);
    expect(p.buttons.map((b) => b.label)).toEqual(['Gain 1 coin instead', 'Skip the top action']);
  });

  it('selects the only unit on a tapped hex, then highlights where it can go', () => {
    const state = play(start(), { type: 'chooseSection', section: 2 });
    const p = prompt(state, { hex: 'home' });
    expect(p.selected).toBe('home');
    expect([...p.tapActions.keys()].sort()).toEqual(['B5', 'B6']);
    expect(p.tapActions.get('B5')).toEqual({ type: 'moveUnit', unit: { kind: 'character' }, to: 'B5' });
  });

  it('keeps the loading unit selected until it moves', () => {
    let state = play(start(), { type: 'chooseSection', section: 3 }, { type: 'tradeResource', resource: 'food', hex: 'B5' },
      { type: 'tradeResource', resource: 'food', hex: 'B5' }, { type: 'skipBottom' }, { type: 'chooseSection', section: 3 },
      { type: 'gainCoins' }, { type: 'skipBottom' }, { type: 'chooseSection', section: 2 });
    state = play(state, { type: 'carryResource', unit: { kind: 'worker', index: 0 }, resource: 'food' });
    const p = prompt(state, {});
    expect(p.buttons.map((b) => b.label)).toEqual(['Pick up 1 food']);
    expect(p.tapActions.size).toBeGreaterThan(0);
  });

  it('lists what can be done on a selected hex', () => {
    const state = play(start(), { type: 'chooseSection', section: 3 });
    const p = prompt(state, { hex: 'B5' });
    expect(p.buttons.map((b) => b.label)).toEqual(['Take 1 oil', 'Take 1 metal', 'Take 1 wood', 'Take 1 food', 'Back']);
  });

  it('names mech abilities and recruit bonuses in plain words', () => {
    const state = start();
    expect(label(state, { type: 'deploy', hex: 'B5', ability: 3 })).toBe('Mech: Speed');
    expect(label(state, { type: 'enlist', section: 1, bonus: 'power' })).toBe('Recruit on Deploy (then +1 coins); now +2 power');
  });
});
