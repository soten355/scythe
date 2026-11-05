// The owner's structure bonus tiles 4, 5 and 6 (Nov 5, 2026), checked on the
// real map, in the words of the tiles:
// 4: tunnel territories with your structures on them (a Mine doesn't make a tunnel);
// 5: your structures in a row (any straight line; only the longest; rivers don't break it);
// 6: farms and tundras with your structures on them.
import { newGame, structureBonusCount, type GameState, type PlayerState, type StructureBonusTile } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { baseBoard } from './board';
import { baseFactions } from './factions';
import { baseMats } from './mats';

const pays = [{ atLeast: 1, coins: 1 }];
const onTunnels: StructureBonusTile = { id: 'tile-4', name: 'Tunnels', count: { kind: 'on', tunnel: true }, pays };
const inRow: StructureBonusTile = { id: 'tile-5', name: 'In a row', count: { kind: 'inRow' }, pays };
const onFarmsAndTundra: StructureBonusTile = { id: 'tile-6', name: 'Farms and tundra', count: { kind: 'on', terrains: ['farm', 'tundra'] }, pays };

const base: GameState = newGame({ seed: 1, board: baseBoard, players: baseFactions.slice(0, 2).map((faction, i) => ({ faction, mat: baseMats[i]! })) });
const count = (structures: PlayerState['structures'], tile: StructureBonusTile) =>
  structureBonusCount({ ...base, players: [{ ...base.players[0]!, structures }, base.players[1]!] }, 0, tile);

/** The hex at axial q, r, if there is one. */
const at = (q: number, r: number) => Object.values(baseBoard.hexes).find((h) => h.q === q && h.r === r);

describe("the owner's structure bonus tiles", () => {
  it('4: counts structures on printed tunnels; a Mine elsewhere is not a tunnel', () => {
    expect(baseBoard.hexes.C2!.tunnel && baseBoard.hexes.B4!.tunnel && !baseBoard.hexes.A2!.tunnel).toBe(true);
    expect(count({ mine: 'A2' }, onTunnels)).toBe(0);
    expect(count({ mine: 'C2' }, onTunnels)).toBe(1);
    expect(count({ mine: 'A2', mill: 'C2', armory: 'B4', monument: 'A5' }, onTunnels)).toBe(2);
  });

  it('5: a river between two of them does not break the row', () => {
    // A2 A3 | A4 A5 runs straight along row A, with a river between A3 and A4.
    expect(baseBoard.rivers.some(([a, b]) => [a, b].sort().join() === 'A3,A4')).toBe(true);
    expect(count({ mill: 'A2', armory: 'A3', mine: 'A4', monument: 'A5' }, inRow)).toBe(4);
  });

  it('5: any straight line counts, along each of the three directions', () => {
    for (const [dq, dr] of [[1, 0], [0, 1], [1, -1]] as const) {
      // Three land hexes in a line, somewhere on the map.
      const start = Object.values(baseBoard.hexes).find((h) => [0, 1, 2].every((i) => { const x = at(h.q + dq * i, h.r + dr * i); return x && x.terrain !== 'lake'; }))!;
      const [a, b, c] = [0, 1, 2].map((i) => at(start.q + dq * i, start.r + dr * i)!.id);
      expect(count({ mill: a, armory: b, mine: c }, inRow)).toBe(3);
    }
  });

  it('5: only the longest row counts, and a gap breaks it', () => {
    // Two rows of two, apart: 2, not 4.
    expect(count({ mill: 'A2', armory: 'A3', mine: 'F2', monument: 'F3' }, inRow)).toBe(2);
    // A2 and A4 with A3 empty between them are not a row.
    expect(count({ mill: 'A2', armory: 'A4' }, inRow)).toBe(1);
  });

  it('6: counts structures on farms and tundra only', () => {
    // A2 farm, A3 village, A4 forest, A5 tundra.
    expect(count({ mill: 'A2', armory: 'A3', mine: 'A4', monument: 'A5' }, onFarmsAndTundra)).toBe(2);
    expect(count({ mill: 'A3', armory: 'A4' }, onFarmsAndTundra)).toBe(0);
    // Mixed in any way: two farms and two tundras make 4.
    const farms = Object.values(baseBoard.hexes).filter((h) => h.terrain === 'farm').slice(0, 2).map((h) => h.id);
    const tundras = Object.values(baseBoard.hexes).filter((h) => h.terrain === 'tundra').slice(0, 2).map((h) => h.id);
    expect(count({ mill: farms[0], armory: farms[1], mine: tundras[0], monument: tundras[1] }, onFarmsAndTundra)).toBe(4);
  });
});
