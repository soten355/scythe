import { sampleStructureBonuses } from '@scythe/content';
import { validateStructureBonus } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { setPath } from '../shared/editor-utils';
import { addStep, cleanTile, editable, newTile, nextId, removeStep, setCountKind, tileProblems, toggleTerrain } from './model';

describe('the structure bonus tile editor', () => {
  it('starts a tile with one payout step to fill in', () => {
    const tile = newTile('tile-1');
    expect(tile.pays).toHaveLength(1);
    expect(validateStructureBonus(cleanTile(tile))).toEqual(['payouts must be whole numbers of 0 or more, each step higher than the last']);
  });

  it('numbers new tiles after the ones there', () => {
    expect(nextId([])).toBe('tile-1');
    expect(nextId([newTile('tile-1'), newTile('tile-3')])).toBe('tile-4');
  });

  it('changes what a tile counts', () => {
    expect(setCountKind(newTile('t'), 'on').count).toEqual({ kind: 'on', tunnel: false, terrains: [] });
    expect(setCountKind(newTile('t'), 'inRow').count).toEqual({ kind: 'inRow' });
    expect(setCountKind(newTile('t'), 'adjacent').count).toEqual({ kind: 'adjacent', feature: 'tunnel' });
  });

  it('turns terrains on and off, in the usual order', () => {
    let tile = setCountKind(newTile('t'), 'on');
    tile = toggleTerrain(tile, 'tundra', true);
    tile = toggleTerrain(tile, 'farm', true);
    expect(tile.count).toMatchObject({ terrains: ['farm', 'tundra'] });
    expect(toggleTerrain(tile, 'farm', false).count).toMatchObject({ terrains: ['tundra'] });
  });

  it('adds a step one higher than the last, and removes any but the last one left', () => {
    let tile = setPath(newTile('t'), 'pays.0.coins', 2);
    tile = addStep(tile);
    expect(tile.pays[1]).toEqual({ atLeast: 2, coins: null });
    expect(removeStep(tile, 0).pays).toEqual([{ atLeast: 2, coins: null }]);
    expect(removeStep(removeStep(tile, 0), 0).pays).toHaveLength(1);
  });

  it('stores tiles without unticked parts, and a stored tile comes back the same', () => {
    let tile = setCountKind(setPath(newTile(' t '), 'name', ' Roots '), 'on');
    tile = setPath(tile, 'count.tunnel', true);
    tile = setPath(tile, 'pays.0.coins', 3);
    expect(cleanTile(tile)).toEqual({ id: 't', name: 'Roots', count: { kind: 'on', tunnel: true }, pays: [{ atLeast: 1, coins: 3 }] });
    for (const t of sampleStructureBonuses) expect(cleanTile(editable(t))).toEqual(t);
  });

  it('lists the problems by tile, including a repeated ID', () => {
    const fine = sampleStructureBonuses[0]!;
    expect(tileProblems([fine])).toEqual([]);
    expect(tileProblems([fine, { ...fine, name: 'Copy' }])).toEqual([`Copy: another tile has the ID ${fine.id}`]);
  });
});
