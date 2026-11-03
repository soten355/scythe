import { baseBoard, baseFactions, baseMats, sampleObjectives } from '@scythe/content';
import { newGame, standings, type GameState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { dossierOf } from './dossier';

const start = (): GameState =>
  newGame({
    seed: 4,
    board: baseBoard,
    objectives: sampleObjectives,
    players: [0, 1, 2].map((i) => ({ faction: baseFactions[i]!, mat: baseMats[i]! })),
  });

describe("a player's dossier", () => {
  it("shows their faction, mat and numbers as they are in the game", () => {
    const game = start();
    const d = dossierOf(game, 1, { secret: true });
    const p = game.players[1]!;
    expect(d).toMatchObject({ seat: 1, name: baseFactions[1]!.name, color: baseFactions[1]!.color, mat: baseMats[1]!.name });
    expect(d.stats).toMatchObject({ coins: p.coins, power: p.power, popularity: p.popularity, combatCards: p.combatCards.length });
    expect(d.units).toMatchObject({ character: 'Home base', mechs: 0, workers: p.workers.length });
  });

  it('says how they would score if the game ended now, and their place', () => {
    const game = start();
    const mine = standings(game).find((s) => s.seat === 2)!;
    const d = dossierOf(game, 2, { secret: true });
    expect(d.standing).toMatchObject({ total: mine.total, place: mine.place, of: 3 });
    expect(d.standing.lines.reduce((n, l) => n + l.coins, 0)).toBe(mine.total);
  });

  it('tracks every way to a star, marking the ones earned', () => {
    let game = start();
    game = { ...game, players: game.players.map((p, s) => (s === 0 ? { ...p, power: 16, stars: ['power'] } : p)) };
    const goals = dossierOf(game, 0, { secret: true }).goals;
    expect(goals.map((g) => g.kind)).toEqual(['upgrades', 'mechs', 'structures', 'recruits', 'workers', 'popularity', 'power', 'combat', 'objective']);
    expect(goals.find((g) => g.kind === 'power')).toMatchObject({ have: 16, need: 16, earned: 1 });
    expect(goals.find((g) => g.kind === 'workers')).toMatchObject({ have: game.players[0]!.workers.length, need: 8, earned: 0 });
    expect(goals.find((g) => g.kind === 'combat')).toMatchObject({ need: 2 });
  });

  it("keeps combat cards and objectives hidden unless they're the viewer's own", () => {
    const game = start();
    const hidden = dossierOf(game, 0, { secret: true });
    expect(hidden.stats.cardValues).toBeUndefined();
    expect(hidden.objectives).toEqual({ hidden: game.players[0]!.objectives.length, shown: [] });
    const own = dossierOf(game, 0, { secret: false });
    expect(own.stats.cardValues).toEqual([...game.players[0]!.combatCards].sort((a, b) => a - b));
    expect(own.objectives.hidden).toBe(0);
    expect(own.objectives.shown).toHaveLength(game.players[0]!.objectives.length);
  });

  it('shows completed objectives to everyone', () => {
    let game = start();
    const done = game.players[0]!.objectives[0]!;
    game = { ...game, players: game.players.map((p, s) => (s === 0 ? { ...p, objectivesDone: [done] } : p)) };
    const d = dossierOf(game, 0, { secret: true });
    expect(d.objectives.shown.map((o) => o.status)).toEqual(['done']);
    expect(d.objectives.hidden).toBe(game.players[0]!.objectives.length - 1);
  });

  it('lists abilities (mech ones unlocked as mechs are deployed), recruits and structures', () => {
    let game = start();
    game = { ...game, players: game.players.map((p, s) => (s === 0 ? { ...p, mechAbilities: [2], recruits: [1], recruitBonusesTaken: ['coins'], structures: { mill: 'A1' } } : p)) };
    const d = dossierOf(game, 0, { secret: true });
    expect(d.ability.name).toBe(baseFactions[0]!.ability.name);
    expect(d.mechAbilities.map((m) => m.unlocked)).toEqual([false, false, true, false]);
    expect(d.recruits.map((r) => r.placed)).toEqual([false, true, false, false]);
    expect(d.recruits[1]!.action).toBe(baseMats[0]!.sections[1].bottom.action);
    expect(d.oneTime.find((b) => b.bonus === 'coins')).toMatchObject({ taken: true });
    expect(d.structures).toEqual([
      { kind: 'mine', hex: null },
      { kind: 'mill', hex: 'A1' },
      { kind: 'armory', hex: null },
      { kind: 'monument', hex: null },
    ]);
  });
});
