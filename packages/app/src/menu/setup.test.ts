import { describe, expect, it } from 'vitest';
import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import type { Faction, PlayerMat } from '@scythe/engine';
import { playOrder } from '@scythe/engine';
import { BUILT_IN } from '../content/catalog';
import { botsOf, defaultChoice, fitChoice, maxPlayers, MIN_PLAYERS, problems, setBot, setFaction, setMat, setPlayerCount, shuffleSeats, toSetup, turnOrderNames, type Catalog } from './setup';

const [nordic, rusviet] = baseFactions as [Faction, Faction];
const [mat1, mat2] = baseMats as [PlayerMat, PlayerMat];
/** Two factions and two mats (whatever else gets entered later). */
const catalog: Catalog = { maps: [{ id: 'standard', name: 'Standard', board: baseBoard }], factions: [nordic, rusviet], mats: [mat1, mat2] };
/** A bigger catalog, as if more factions and mats were entered. */
const more: Catalog = {
  ...catalog,
  factions: [nordic, rusviet, { ...nordic, id: 'third', name: 'Third', homeBase: 'se' }],
  mats: [mat1, mat2, { ...mat1, id: 'mat-3', name: 'Third mat', turnOrder: 3 }],
};

describe('the new game choices', () => {
  it('start with the default map and the first factions and mats, you against a Medium bot', () => {
    expect(defaultChoice(catalog)).toEqual({
      map: 'standard',
      players: [
        { faction: nordic.id, mat: mat1.id, bot: null },
        { faction: rusviet.id, mat: mat2.id, bot: 'medium' },
      ],
    });
    expect(problems(defaultChoice(catalog), catalog)).toEqual([]);
  });

  it('allow as many players as there are factions and mats, up to 7', () => {
    expect(MIN_PLAYERS).toBe(2);
    expect(maxPlayers(catalog)).toBe(2);
    expect(maxPlayers(more)).toBe(3);
  });

  it('add seats with unused factions and mats, and drop them from the end', () => {
    const three = setPlayerCount(defaultChoice(more), 3, more);
    expect(three.players[2]).toEqual({ faction: 'third', mat: 'mat-3', bot: 'medium' });
    expect(setPlayerCount(three, 2, more).players).toEqual(defaultChoice(more).players);
    // Not past what's available.
    expect(setPlayerCount(defaultChoice(catalog), 3, catalog).players).toHaveLength(2);
  });

  it('swap factions or mats when one already taken is picked', () => {
    const c = setFaction(defaultChoice(catalog), 0, rusviet.id);
    expect(c.players.map((p) => p.faction)).toEqual([rusviet.id, nordic.id]);
    const m = setMat(defaultChoice(catalog), 1, mat1.id);
    expect(m.players.map((p) => p.mat)).toEqual([mat2.id, mat1.id]);
  });

  it('shuffle factions and mats with the given random numbers', () => {
    const c = shuffleSeats(defaultChoice(catalog), catalog, () => 0);
    expect(c.players.map((p) => p.faction).sort()).toEqual([nordic.id, rusviet.id].sort());
    expect(problems(c, catalog)).toEqual([]);
  });

  it('any seat can be played by a person or a bot of any level, kept through shuffles and swaps', () => {
    let c = setBot(defaultChoice(more), 1, 'hard');
    c = setPlayerCount(c, 3, more);
    c = setBot(setBot(c, 0, 'easy'), 2, null);
    expect(botsOf(c)).toEqual(['easy', 'hard', null]);
    expect(botsOf(shuffleSeats(c, more, () => 0))).toEqual(['easy', 'hard', null]);
    expect(botsOf(setFaction(c, 0, 'third'))).toEqual(['easy', 'hard', null]);
    // Every seat a bot is allowed: a game to watch.
    expect(problems(setBot(c, 2, 'medium'), more)).toEqual([]);
  });

  it('point out what stops a game from starting', () => {
    const same = { map: 'standard', players: [{ faction: nordic.id, mat: mat1.id, bot: null }, { faction: nordic.id, mat: mat1.id, bot: null }] };
    expect(problems(same, catalog)).toEqual(['Two seats have Nordic.', 'Two seats have the Industrial mat.']);
    const sharedHome = { ...more, factions: [nordic, rusviet, { ...nordic, id: 'third', name: 'Third' }] };
    const c = setPlayerCount(defaultChoice(sharedHome), 3, sharedHome);
    expect(problems(c, sharedHome)).toEqual(['Nordic and Third start from the same home base.']);
  });

  it('turn into the engine setup', () => {
    const setup = toSetup(defaultChoice(catalog), catalog, 42);
    expect(setup.seed).toBe(42);
    expect(setup.board).toBe(baseBoard);
    expect(setup.players.map((p) => [p.faction.id, p.mat.id])).toEqual([
      [nordic.id, mat1.id],
      [rusviet.id, mat2.id],
    ]);
  });

  it('new games play clockwise around the map from the lowest mat, whatever order the seats are listed in', () => {
    // Listed Nordic, Rusviet, Polonia, Crimea, Saxony; on the map: Nordic north-east, Rusviet east, Crimea south, Saxony south-west, Polonia west.
    const five = { map: BUILT_IN.maps[0]!.id, players: BUILT_IN.factions.map((f, i) => ({ faction: f.id, mat: BUILT_IN.mats[i]!.id, bot: null })) };
    const setup = toSetup(five, BUILT_IN, 1);
    expect(setup.turnOrder).toBe('map');
    const names = playOrder(setup).map((i) => setup.players[i]!.faction.name);
    const n = names.indexOf('Nordic');
    expect([...names.slice(n), ...names.slice(0, n)]).toEqual(['Nordic', 'Rusviet', 'Crimea', 'Saxony', 'Polonia']);
    expect(turnOrderNames(five, BUILT_IN)).toEqual(['Nordic', 'Rusviet', 'Crimea', 'Saxony', 'Polonia']);
    // The lowest mat starts: give Saxony mat 1 (swapping with Nordic).
    const saxonyFirst = setMat(five, 4, BUILT_IN.mats[0]!.id);
    expect(turnOrderNames(saxonyFirst, BUILT_IN)).toEqual(['Saxony', 'Polonia', 'Nordic', 'Rusviet', 'Crimea']);
  });

  it('picks that are no longer offered (removed from the library) are swapped for unused ones', () => {
    const extra = { ...baseFactions[0]!, id: 'extra', name: 'Extra' };
    const bigger: Catalog = { ...catalog, factions: [...catalog.factions, extra], maps: [...catalog.maps, { id: 'm2', name: 'M2', board: baseBoard }] };
    const choice = { map: 'm2', players: [{ faction: 'extra', mat: catalog.mats[0]!.id, bot: null }, { faction: catalog.factions[0]!.id, mat: catalog.mats[1]!.id, bot: 'hard' as const }] };
    expect(fitChoice(choice, bigger)).toBe(choice);
    const fitted = fitChoice(choice, catalog);
    expect(fitted.map).toBe(catalog.maps[0]!.id);
    expect(fitted.players.map((p) => p.faction)).toEqual([catalog.factions[1]!.id, catalog.factions[0]!.id]);
    expect(problems(fitted, catalog)).toEqual([]);
  });
});

