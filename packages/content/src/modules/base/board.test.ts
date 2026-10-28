import { hasRiver, neighbors } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { baseBoard } from './board';

const hexes = Object.values(baseBoard.hexes);
const count = (pred: (h: (typeof hexes)[number]) => boolean) => hexes.filter(pred).length;

describe('base game board', () => {
  it('has one Factory, 6 tunnels, 11 encounters and 7 home bases', () => {
    expect(count((h) => h.terrain === 'factory')).toBe(1);
    expect(count((h) => h.tunnel)).toBe(6);
    expect(count((h) => h.encounter)).toBe(11);
    expect(Object.keys(baseBoard.homeBases)).toHaveLength(7);
  });

  it('has no tunnels or encounters on lakes or the Factory', () => {
    const special = hexes.filter((h) => h.terrain === 'lake' || h.terrain === 'factory');
    expect(special.filter((h) => h.tunnel || h.encounter)).toEqual([]);
  });

  it('has no rivers touching lakes', () => {
    const touchesLake = baseBoard.rivers.filter(([a, b]) =>
      [a, b].some((id) => baseBoard.hexes[id]?.terrain === 'lake'),
    );
    expect(touchesLake).toEqual([]);
  });

  it('gives every home base two land hexes to start on', () => {
    for (const borders of Object.values(baseBoard.homeBases)) {
      expect(borders).toHaveLength(2);
      expect(neighbors(baseBoard, borders[0]!)).toContain(borders[1]);
    }
  });

  it('lets every land hex reach the Factory over land (ignoring rivers)', () => {
    const factory = hexes.find((h) => h.terrain === 'factory')!.id;
    const seen = new Set([factory]);
    const queue = [factory];
    while (queue.length) {
      for (const n of neighbors(baseBoard, queue.shift()!)) {
        if (!seen.has(n) && baseBoard.hexes[n]?.terrain !== 'lake') {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    expect(count((h) => h.terrain !== 'lake' && !seen.has(h.id))).toBe(0);
  });

  it('has symmetric adjacency and rivers', () => {
    for (const h of hexes) {
      for (const n of neighbors(baseBoard, h.id)) {
        expect(neighbors(baseBoard, n)).toContain(h.id);
        expect(hasRiver(baseBoard, h.id, n)).toBe(hasRiver(baseBoard, n, h.id));
      }
    }
  });
});
