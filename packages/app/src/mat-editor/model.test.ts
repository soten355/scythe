import { validateMat } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { formatMats, newMat, setBottomAction, setField, setTopAction } from './model';

describe('mat editor model', () => {
  it('starts a new mat that is already valid', () => {
    const mat = newMat('mat-a');
    expect(mat.id).toBe('mat-a');
    expect(validateMat(mat)).toEqual([]);
  });

  it('swaps sections when a top-row action already used elsewhere is picked', () => {
    const mat = newMat('m');
    const tradeAt = mat.sections.findIndex((s) => s.top.action === 'trade');
    const target = tradeAt === 0 ? 1 : 0;
    const before = mat.sections[target]!.top;
    const next = setTopAction(mat, target, 'trade');
    expect(next.sections[target]!.top).toEqual(mat.sections[tradeAt]!.top);
    expect(next.sections[tradeAt]!.top).toEqual(before);
    expect(validateMat(next)).toEqual([]);
  });

  it('gives new top-row actions their standard building bonus, and keeps it with the action on a swap', () => {
    const mat = newMat('m');
    const structureOf = (action: string) => mat.sections.find((s) => s.top.action === action)!.top.structure;
    expect([structureOf('move'), structureOf('produce'), structureOf('trade'), structureOf('bolster')]).toEqual([
      'mine',
      'mill',
      'armory',
      'monument',
    ]);
    const next = setTopAction(mat, 0, 'move');
    expect(next.sections[0]!.top).toMatchObject({ action: 'move', structure: 'mine' });
  });

  it('swaps bottom-row actions the same way, keeping each one\'s numbers', () => {
    const mat = setField(newMat('m'), 'sections.0.bottom.coins', 3);
    const from = mat.sections[0]!.bottom.action;
    const otherAt = 2;
    const other = mat.sections[otherAt]!.bottom.action;
    const next = setBottomAction(mat, 0, other);
    expect(next.sections[0]!.bottom.action).toBe(other);
    expect(next.sections[otherAt]!.bottom).toMatchObject({ action: from, coins: 3 });
  });

  it('sets nested numbers and text by path without changing the original', () => {
    const mat = newMat('m');
    const next = setField(setField(mat, 'sections.1.top.cost', 2), 'name', 'Fancy');
    expect(next.name).toBe('Fancy');
    expect(next.sections[1]!.top).toMatchObject({ cost: 2 });
    expect(mat.name).not.toBe('Fancy');
  });

  it('exports mats as text that parses back to the same data', () => {
    const mats = [newMat('a'), newMat('b')];
    const text = formatMats(mats);
    expect(JSON.parse(text)).toEqual(mats);
  });
});
