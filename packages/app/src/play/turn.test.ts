import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import { applyAction, newGame, type Action, type GameState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { canSwitchSection, phase, previousSection, sectionChoices } from './turn';

const start = () =>
  newGame({
    seed: 1,
    board: baseBoard,
    players: [
      { faction: baseFactions[0]!, mat: baseMats[0]! },
      { faction: baseFactions[1]!, mat: baseMats[1]! },
    ],
  });
/** Every state reached, starting from `state`. */
const run = (state: GameState, ...actions: Action[]) =>
  actions.reduce((h, a) => [...h, applyAction(h[h.length - 1]!, a)], [state]);
const sections = (actions: Action[]) => actions.map((a) => (a as { section: number }).section);

describe('choosing a section', () => {
  it('offers every section at the start of the first turn', () => {
    const history = run(start());
    expect(phase(history[0]!)).toBe('choose');
    expect(sections(sectionChoices(history, 0))).toEqual([0, 1, 2, 3]);
  });

  it('can be switched until the first action of the turn', () => {
    const history = run(start(), { type: 'chooseSection', section: 2 });
    expect(phase(history[1]!)).toBe('top');
    expect(canSwitchSection(history, 0)).toBe(true);
    expect(sections(sectionChoices(history, 0))).toEqual([0, 1, 2, 3]);

    const acted = run(start(), { type: 'chooseSection', section: 2 }, { type: 'gainCoins' });
    expect(canSwitchSection(acted, 0)).toBe(false);
    expect(sectionChoices(acted, 0)).toEqual([]);
  });

  it("leaves out last turn's section, even while switching", () => {
    const history = run(start(), { type: 'chooseSection', section: 2 }, { type: 'gainCoins' }, { type: 'skipBottom' });
    // Player 1's turn, then back to player 0.
    const back = run(history[history.length - 1]!, { type: 'chooseSection', section: 0 }, { type: 'skipTop' }, { type: 'skipBottom' });
    const turnStart = back.length - 1;
    const now = run(back[turnStart]!, { type: 'chooseSection', section: 1 });
    const all = [...back, ...now.slice(1)];
    expect(previousSection(all, turnStart)).toBe(2);
    expect(sections(sectionChoices(all, turnStart))).toEqual([0, 1, 3]);
    expect(phase(all[all.length - 1]!)).toBe('top');
  });
});
