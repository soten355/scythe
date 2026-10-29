// A small board, two factions and two mats for engine tests, so the engine
// can be tested without depending on the content package.
//
//   row A:      home "a" (borders B1, B2)
//   row B:  B1 farm    B2 forest   B3 mountain  B4 tundra (tunnel)
//   row C:  C1 village C2 lake     C3 factory   C4 farm
//   row D:  D1 mountain (tunnel) D2 tundra  D3 village   D4 forest
//   row E:      home "b" (borders D2, D3)
// A river runs between B1 and C1.
import { buildBoard } from './board';
import type { Faction } from './faction';
import type { GameSetup } from './game';
import type { PlayerMat } from './mat';

export const testBoard = buildBoard({
  rows: [
    '--  @a  --  --',
    'Fa  Fo  Mo  TuT',
    'Vi  ~~  FF  Fa',
    'MoT Tu  Vi  Fo',
    '--  --  @b',
  ],
  rivers: ['B1|C1'],
  homeBases: { a: ['B1', 'B2'], b: ['D2', 'D3'] },
});

const ability = (name: string) => ({ name, description: '' });

const testFaction = (id: string, homeBase: string): Faction => ({
  id,
  name: id,
  color: '#888888',
  homeBase,
  power: 3,
  combatCards: 2,
  stars: 6,
  ability: ability('none'),
  mechAbilities: [ability('m1'), ability('m2'), ability('m3'), ability('m4')],
  recruitBonuses: [
    { bonus: 'power', amount: 2 },
    { bonus: 'coins', amount: 2 },
    { bonus: 'popularity', amount: 2 },
    { bonus: 'combatCard', amount: 2 },
  ],
});

/** Sections: 0 bolster/upgrade, 1 produce/deploy, 2 move/build, 3 trade/enlist. */
export const testMatA: PlayerMat = {
  id: 'mat-a',
  name: 'Mat A',
  turnOrder: 1,
  popularity: 2,
  coins: 4,
  objectiveCards: 2,
  sections: [
    {
      top: { action: 'bolster', cost: 1, power: { base: 2, upgraded: 3 }, combatCards: { base: 1, upgraded: 2 }, structure: 'monument' },
      bottom: { action: 'upgrade', cost: 3, upgradeSpaces: 1, coins: 3, recruitBonus: 'power' },
    },
    {
      top: { action: 'produce', hexes: { base: 2, upgraded: 3 }, structure: 'mill' },
      bottom: { action: 'deploy', cost: 3, upgradeSpaces: 2, coins: 2, recruitBonus: 'coins' },
    },
    {
      top: { action: 'move', units: { base: 2, upgraded: 3 }, coins: { base: 1, upgraded: 2 }, structure: 'mine' },
      bottom: { action: 'build', cost: 3, upgradeSpaces: 1, coins: 1, recruitBonus: 'popularity' },
    },
    {
      top: { action: 'trade', cost: 1, resources: 2, popularity: { base: 1, upgraded: 2 }, structure: 'armory' },
      bottom: { action: 'enlist', cost: 4, upgradeSpaces: 2, coins: 0, recruitBonus: 'combatCard' },
    },
  ],
};

/** Same actions as mat A in a different order: 0 produce/upgrade, 1 trade/deploy, 2 bolster/build, 3 move/enlist. */
export const testMatB: PlayerMat = {
  id: 'mat-b',
  name: 'Mat B',
  turnOrder: 2,
  popularity: 2,
  coins: 5,
  objectiveCards: 2,
  sections: [
    {
      top: { action: 'produce', hexes: { base: 2, upgraded: 3 }, structure: 'mill' },
      bottom: { action: 'upgrade', cost: 3, upgradeSpaces: 1, coins: 2, recruitBonus: 'power' },
    },
    {
      top: { action: 'trade', cost: 1, resources: 2, popularity: { base: 1, upgraded: 2 }, structure: 'armory' },
      bottom: { action: 'deploy', cost: 4, upgradeSpaces: 2, coins: 0, recruitBonus: 'coins' },
    },
    {
      top: { action: 'bolster', cost: 1, power: { base: 2, upgraded: 3 }, combatCards: { base: 1, upgraded: 2 }, structure: 'monument' },
      bottom: { action: 'build', cost: 3, upgradeSpaces: 2, coins: 3, recruitBonus: 'popularity' },
    },
    {
      top: { action: 'move', units: { base: 2, upgraded: 3 }, coins: { base: 1, upgraded: 2 }, structure: 'mine' },
      bottom: { action: 'enlist', cost: 3, upgradeSpaces: 1, coins: 1, recruitBonus: 'combatCard' },
    },
  ],
};

export const factionA = testFaction('fa', 'a');
export const factionB = testFaction('fb', 'b');

export const testSetup: GameSetup = {
  seed: 1,
  board: testBoard,
  players: [
    { faction: factionA, mat: testMatA },
    { faction: factionB, mat: testMatB },
  ],
};
