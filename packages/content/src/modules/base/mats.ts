import type { PlayerMat } from '@scythe/engine';

// Base game player mats. Entered by the owner in the mat editor (mats.html
// in the app) from the physical mats; paste its export here.
export const baseMats: PlayerMat[] = [
  {
    id: 'mat-1',
    name: 'Industrial',
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
  },
  {
    id: 'mat-2',
    name: 'Engineering',
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
  },
  {
    id: 'mat-3',
    name: 'Patriotic',
    turnOrder: 3,
    popularity: 2,
    coins: 6,
    objectiveCards: 2,
    sections: [
      {
        top: { action: 'move', units: { base: 2, upgraded: 3 }, coins: { base: 1, upgraded: 2 }, structure: 'mine' },
        bottom: { action: 'upgrade', cost: 2, upgradeSpaces: 0, coins: 1, recruitBonus: 'power' },
      },
      {
        top: { action: 'bolster', cost: 1, power: { base: 2, upgraded: 3 }, combatCards: { base: 1, upgraded: 2 }, structure: 'monument' },
        bottom: { action: 'deploy', cost: 4, upgradeSpaces: 3, coins: 3, recruitBonus: 'coins' },
      },
      {
        top: { action: 'trade', cost: 1, resources: 2, popularity: { base: 1, upgraded: 2 }, structure: 'armory' },
        bottom: { action: 'build', cost: 4, upgradeSpaces: 2, coins: 0, recruitBonus: 'popularity' },
      },
      {
        top: { action: 'produce', hexes: { base: 2, upgraded: 3 }, structure: 'mill' },
        bottom: { action: 'enlist', cost: 3, upgradeSpaces: 1, coins: 2, recruitBonus: 'combatCard' },
      },
    ],
  },
  {
    id: 'mat-4',
    name: 'Mechanical',
    turnOrder: 4,
    popularity: 3,
    coins: 6,
    objectiveCards: 2,
    sections: [
      {
        top: { action: 'trade', cost: 1, resources: 2, popularity: { base: 1, upgraded: 2 }, structure: 'armory' },
        bottom: { action: 'upgrade', cost: 3, upgradeSpaces: 1, coins: 0, recruitBonus: 'power' },
      },
      {
        top: { action: 'bolster', cost: 1, power: { base: 2, upgraded: 3 }, combatCards: { base: 1, upgraded: 2 }, structure: 'monument' },
        bottom: { action: 'deploy', cost: 3, upgradeSpaces: 2, coins: 2, recruitBonus: 'coins' },
      },
      {
        top: { action: 'move', units: { base: 2, upgraded: 3 }, coins: { base: 1, upgraded: 2 }, structure: 'mine' },
        bottom: { action: 'build', cost: 3, upgradeSpaces: 1, coins: 2, recruitBonus: 'popularity' },
      },
      {
        top: { action: 'produce', hexes: { base: 2, upgraded: 3 }, structure: 'mill' },
        bottom: { action: 'enlist', cost: 4, upgradeSpaces: 2, coins: 3, recruitBonus: 'combatCard' },
      },
    ],
  },
  {
    id: 'mat-5',
    name: 'Agricultural',
    turnOrder: 5,
    popularity: 4,
    coins: 7,
    objectiveCards: 2,
    sections: [
      {
        top: { action: 'move', units: { base: 2, upgraded: 3 }, coins: { base: 1, upgraded: 2 }, structure: 'mine' },
        bottom: { action: 'upgrade', cost: 2, upgradeSpaces: 0, coins: 1, recruitBonus: 'power' },
      },
      {
        top: { action: 'trade', cost: 1, resources: 2, popularity: { base: 1, upgraded: 2 }, structure: 'armory' },
        bottom: { action: 'deploy', cost: 4, upgradeSpaces: 2, coins: 0, recruitBonus: 'coins' },
      },
      {
        top: { action: 'produce', hexes: { base: 2, upgraded: 3 }, structure: 'mill' },
        bottom: { action: 'build', cost: 4, upgradeSpaces: 2, coins: 2, recruitBonus: 'popularity' },
      },
      {
        top: { action: 'bolster', cost: 1, power: { base: 2, upgraded: 3 }, combatCards: { base: 1, upgraded: 2 }, structure: 'monument' },
        bottom: { action: 'enlist', cost: 3, upgradeSpaces: 2, coins: 3, recruitBonus: 'combatCard' },
      },
    ],
  },
];
