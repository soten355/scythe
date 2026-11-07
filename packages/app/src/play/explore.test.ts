import { baseBoard, baseFactions, baseMats, sampleObjectives } from '@scythe/content';
import { newGame, type GameState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { factionsOnMap, hexReport } from './explore';

const start = (): GameState =>
  newGame({
    seed: 4,
    board: baseBoard,
    objectives: sampleObjectives,
    players: [0, 1, 2].map((i) => ({ faction: baseFactions[i]!, mat: baseMats[i]! })),
  });

/** A land hex (not a lake) to put things on. */
const land = Object.values(baseBoard.hexes).find((h) => h.terrain !== 'lake')!.id;

describe('the map screen: each faction', () => {
  it('lists every faction with what it has on the map', () => {
    const game = start();
    const f = factionsOnMap(game);
    expect(f.map((x) => x.seat)).toEqual([0, 1, 2]);
    expect(f[1]).toMatchObject({ name: baseFactions[1]!.name, color: baseFactions[1]!.color, mechs: 0, workers: game.players[1]!.workers.length, structures: 0, stars: 0 });
  });

  it("points the camera at a faction's units and structures, its home base standing for 'home'", () => {
    let game = start();
    game = { ...game, players: game.players.map((p, s) => (s === 2 ? { ...p, mechs: [land, 'home'], structures: { mine: land } } : p)) };
    const f = factionsOnMap(game)[2]!;
    expect(f.mechs).toBe(2);
    expect(f.structures).toBe(1);
    expect(f.spots).toContain(land);
    expect(f.spots).toContain(`base:${baseFactions[2]!.homeBase}`);
    expect(f.spots).not.toContain('home');
    // Each spot once.
    expect(new Set(f.spots).size).toBe(f.spots.length);
  });
});

describe('the map screen: a tapped hex', () => {
  it("says who is there, what's built, what's lying there and if an encounter waits", () => {
    let game = start();
    game = {
      ...game,
      players: game.players.map((p, s) =>
        s === 0 ? { ...p, character: land, mechs: [land, land], workers: [land, ...p.workers.slice(1)], structures: { mill: land } } : p,
      ),
      resources: { ...game.resources, [land]: { oil: 2, food: 1 } },
      encounterTokens: [land],
    };
    const r = hexReport(game, land)!;
    expect(r.hex).toBe(land);
    expect(r.terrain).toBe(baseBoard.hexes[land]!.terrain);
    expect(r.units).toEqual([{ seat: 0, name: baseFactions[0]!.name, color: baseFactions[0]!.color, character: true, mechs: 2, workers: 1 }]);
    expect(r.structures).toEqual([{ seat: 0, color: baseFactions[0]!.color, structure: 'mill' }]);
    expect(r.resources).toEqual([
      { resource: 'oil', amount: 2 },
      { resource: 'food', amount: 1 },
    ]);
    expect(r.encounter).toBe(true);
  });

  it('is empty for a quiet hex, and nothing for a home base', () => {
    const game = { ...start(), encounterTokens: [] };
    const quiet = Object.values(baseBoard.hexes).find(
      (h) => h.terrain !== 'lake' && !game.players.some((p) => p.workers.includes(h.id) || p.character === h.id) && !game.resources[h.id],
    )!.id;
    expect(hexReport(game, quiet)).toMatchObject({ units: [], structures: [], resources: [], encounter: false });
    expect(hexReport(game, 'home')).toBeNull();
  });
});
