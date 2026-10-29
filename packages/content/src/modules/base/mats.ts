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
];
