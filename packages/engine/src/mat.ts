// Player mats as data. Starting power and combat cards come from the faction
// mat, not here. The Produce action's extra cost (as workers grow) is the
// same on every mat, so it is a rule rather than mat data.
//
// A mat has four sections; each pairs one top-row action
// with one bottom-row action. Upgrading moves a cube from a top-row value
// (improving it from `base` to `upgraded`) onto a bottom-row upgrade space
// (lowering that action's cost by one).

export type TopActionType = 'move' | 'trade' | 'produce' | 'bolster';
export type BottomActionType = 'upgrade' | 'deploy' | 'build' | 'enlist';
export type Resource = 'oil' | 'metal' | 'wood' | 'food';
export type RecruitBonus = 'power' | 'coins' | 'popularity' | 'combatCard';

export const TOP_ACTIONS: TopActionType[] = ['move', 'trade', 'produce', 'bolster'];
export const BOTTOM_ACTIONS: BottomActionType[] = ['upgrade', 'deploy', 'build', 'enlist'];
export const RECRUIT_BONUSES: RecruitBonus[] = ['power', 'coins', 'popularity', 'combatCard'];

/** The resource each bottom-row action costs (a rule, not mat data). */
export const BOTTOM_COST_RESOURCE: Record<BottomActionType, Resource> = {
  upgrade: 'oil',
  deploy: 'metal',
  build: 'wood',
  enlist: 'food',
};

/** A top-row value; if `upgraded` is higher, an upgrade cube sits on it. */
export interface Upgradeable {
  base: number;
  upgraded: number;
}

export type TopAction =
  | { action: 'move'; units: Upgradeable; coins: Upgradeable }
  | { action: 'trade'; cost: number; resources: number; popularity: Upgradeable }
  | { action: 'produce'; hexes: Upgradeable }
  | { action: 'bolster'; cost: number; power: Upgradeable; combatCards: Upgradeable };

export interface BottomAction {
  action: BottomActionType;
  /** Cost with no upgrades. */
  cost: number;
  /** How many upgrade cubes can be placed here, each lowering the cost by 1. */
  upgradeSpaces: number;
  /** Coins gained when taking the action. */
  coins: number;
  /** Ongoing bonus once a recruit is enlisted from this section. */
  recruitBonus: RecruitBonus;
}

export interface MatSection {
  top: TopAction;
  bottom: BottomAction;
}

export interface PlayerMat {
  id: string;
  name: string;
  /** Lower goes first. */
  turnOrder: number;
  popularity: number;
  coins: number;
  /** Objective cards drawn at setup. */
  objectiveCards: number;
  sections: [MatSection, MatSection, MatSection, MatSection];
}

const upgradeables = (top: TopAction): [string, Upgradeable][] =>
  Object.entries(top).filter((e): e is [string, Upgradeable] => typeof e[1] === 'object');

export function matUpgradeCubes(mat: PlayerMat): { top: number; bottom: number } {
  let top = 0;
  let bottom = 0;
  for (const { top: t, bottom: b } of mat.sections) {
    for (const [, u] of upgradeables(t)) top += u.upgraded - u.base;
    bottom += b.upgradeSpaces;
  }
  return { top, bottom };
}

const wholeNumber = (n: number) => Number.isInteger(n) && n >= 0;

/** Returns a list of problems in plain language; empty means the mat is usable. */
export function validateMat(mat: PlayerMat): string[] {
  const problems: string[] = [];
  const check = (n: number, what: string) => {
    if (!wholeNumber(n)) problems.push(`${what} must be a whole number of 0 or more`);
  };
  check(mat.popularity, 'starting popularity');
  check(mat.coins, 'starting coins');
  check(mat.objectiveCards, 'objective cards');

  const tops = mat.sections.map((s) => s.top.action);
  if (TOP_ACTIONS.some((a) => tops.filter((t) => t === a).length !== 1)) {
    problems.push(`top row needs each of ${TOP_ACTIONS.join(', ')} once`);
  }
  const bottoms = mat.sections.map((s) => s.bottom.action);
  if (BOTTOM_ACTIONS.some((a) => bottoms.filter((b) => b === a).length !== 1)) {
    problems.push(`bottom row needs each of ${BOTTOM_ACTIONS.join(', ')} once`);
  }

  mat.sections.forEach(({ top, bottom }, i) => {
    const t = `section ${i + 1} ${top.action}`;
    for (const [field, value] of Object.entries(top)) {
      if (typeof value === 'number') check(value, `${t} ${field}`);
    }
    for (const [field, u] of upgradeables(top)) {
      check(u.base, `${t} ${field}`);
      check(u.upgraded, `${t} upgraded ${field}`);
      if (u.upgraded < u.base) problems.push(`${t}: ${field} can't get worse when upgraded`);
    }
    const b = `section ${i + 1} ${bottom.action}`;
    check(bottom.cost, `${b} cost`);
    check(bottom.upgradeSpaces, `${b} upgrade spaces`);
    check(bottom.coins, `${b} coins`);
    if (bottom.upgradeSpaces > bottom.cost) {
      problems.push(`${b}: ${bottom.upgradeSpaces} upgrade spaces but the cost is only ${bottom.cost}`);
    }
  });

  const cubes = matUpgradeCubes(mat);
  if (cubes.top !== cubes.bottom) {
    problems.push(`${cubes.top} upgrade cubes on the top row but ${cubes.bottom} spaces for them on the bottom row`);
  }
  return problems;
}
