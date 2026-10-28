import { describe, expect, it } from 'vitest';
import { BOTTOM_COST_RESOURCE, matUpgradeCubes, validateMat, type PlayerMat } from './mat';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

const mat: PlayerMat = {
  id: 'test',
  name: 'Test mat',
  turnOrder: 1,
  popularity: 2,
  coins: 4,
  sections: [
    {
      top: { action: 'trade', cost: 1, resources: 2, popularity: { base: 1, upgraded: 2 } },
      bottom: { action: 'upgrade', cost: 3, upgradeSpaces: 2, coins: 1, recruitBonus: 'power' },
    },
    {
      top: { action: 'bolster', cost: 1, power: { base: 2, upgraded: 3 }, combatCards: { base: 1, upgraded: 2 } },
      bottom: { action: 'deploy', cost: 3, upgradeSpaces: 1, coins: 0, recruitBonus: 'coins' },
    },
    {
      top: { action: 'move', units: { base: 2, upgraded: 3 }, coins: { base: 1, upgraded: 2 } },
      bottom: { action: 'build', cost: 3, upgradeSpaces: 2, coins: 2, recruitBonus: 'popularity' },
    },
    {
      top: { action: 'produce', hexes: { base: 2, upgraded: 3 } },
      bottom: { action: 'enlist', cost: 4, upgradeSpaces: 1, coins: 3, recruitBonus: 'combatCard' },
    },
  ],
};

describe('player mats', () => {
  it('accepts a well-formed mat', () => {
    expect(validateMat(mat)).toEqual([]);
  });

  it('counts upgrade cubes on the top row and spaces for them on the bottom row', () => {
    expect(matUpgradeCubes(mat)).toEqual({ top: 6, bottom: 6 });
  });

  it('fixes which resource each bottom-row action costs', () => {
    expect(BOTTOM_COST_RESOURCE).toEqual({ upgrade: 'oil', deploy: 'metal', build: 'wood', enlist: 'food' });
  });

  it('requires each top-row and bottom-row action exactly once', () => {
    const twoTrades = clone(mat);
    twoTrades.sections[1].top = clone(mat.sections[0].top);
    expect(validateMat(twoTrades)).toContainEqual(expect.stringMatching(/top row needs each of move, trade, produce, bolster once/));
    const twoBuilds = clone(mat);
    twoBuilds.sections[0].bottom = clone(mat.sections[2].bottom);
    expect(validateMat(twoBuilds)).toContainEqual(expect.stringMatching(/bottom row needs each of upgrade, deploy, build, enlist once/));
  });

  it('needs as many bottom-row upgrade spaces as top-row cubes', () => {
    const short = clone(mat);
    short.sections[0].bottom.upgradeSpaces = 1;
    expect(validateMat(short)).toContainEqual(expect.stringMatching(/6 upgrade cubes on the top row but 5 spaces/));
  });

  it('rejects costs that upgrades would push below zero, and negative or fractional numbers', () => {
    const bad = clone(mat);
    bad.sections[0].bottom.upgradeSpaces = 4;
    bad.sections[0].bottom.cost = 3;
    bad.coins = -1;
    bad.popularity = 1.5;
    const problems = validateMat(bad);
    expect(problems).toContainEqual(expect.stringMatching(/section 1 upgrade: 4 upgrade spaces but the cost is only 3/));
    expect(problems).toContainEqual(expect.stringMatching(/starting coins must be a whole number of 0 or more/));
    expect(problems).toContainEqual(expect.stringMatching(/starting popularity must be a whole number of 0 or more/));
  });

  it('rejects an upgraded value lower than the starting value', () => {
    const bad = clone(mat);
    bad.sections[3].top = { action: 'produce', hexes: { base: 3, upgraded: 2 } };
    expect(validateMat(bad)).toContainEqual(expect.stringMatching(/section 4 produce: hexes can't get worse when upgraded/));
  });
});
