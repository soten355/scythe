// Data helpers for the player mat editor. Mats are edited as plain
// PlayerMat objects; every helper returns a new mat.
import type { BottomAction, BottomActionType, PlayerMat, TopAction, TopActionType } from '@scythe/engine';
import { setPath } from '../shared/editor-utils';

/** Standard top-row values and building bonus, used when a section switches action type. */
export function defaultTop(action: TopActionType): TopAction {
  switch (action) {
    case 'move':
      return { action, units: { base: 2, upgraded: 3 }, coins: { base: 1, upgraded: 2 }, structure: 'mine' };
    case 'trade':
      return { action, cost: 1, resources: 2, popularity: { base: 1, upgraded: 2 }, structure: 'armory' };
    case 'produce':
      return { action, hexes: { base: 2, upgraded: 3 }, structure: 'mill' };
    case 'bolster':
      return { action, cost: 1, power: { base: 2, upgraded: 3 }, combatCards: { base: 1, upgraded: 2 }, structure: 'monument' };
  }
}

const DEFAULT_BOTTOM: Record<BottomActionType, BottomAction> = {
  upgrade: { action: 'upgrade', cost: 3, upgradeSpaces: 2, coins: 1, recruitBonus: 'power' },
  deploy: { action: 'deploy', cost: 3, upgradeSpaces: 1, coins: 0, recruitBonus: 'coins' },
  build: { action: 'build', cost: 3, upgradeSpaces: 2, coins: 2, recruitBonus: 'popularity' },
  enlist: { action: 'enlist', cost: 4, upgradeSpaces: 1, coins: 3, recruitBonus: 'combatCard' },
};

export function newMat(id: string): PlayerMat {
  const pairs: [TopActionType, BottomActionType][] = [
    ['trade', 'upgrade'],
    ['bolster', 'deploy'],
    ['move', 'build'],
    ['produce', 'enlist'],
  ];
  const [a, b, c, d] = pairs.map(([top, bottom]) => ({ top: defaultTop(top), bottom: { ...DEFAULT_BOTTOM[bottom] } }));
  return { id, name: 'New mat', turnOrder: 1, popularity: 2, coins: 4, objectiveCards: 2, sections: [a!, b!, c!, d!] };
}

const clone = (mat: PlayerMat): PlayerMat => JSON.parse(JSON.stringify(mat)) as PlayerMat;

/** Puts `action` in a section's top row, swapping with the section that had it. */
export function setTopAction(mat: PlayerMat, section: number, action: TopActionType): PlayerMat {
  const next = clone(mat);
  const target = next.sections[section]!;
  const other = next.sections.find((s) => s.top.action === action);
  if (other) [other.top, target.top] = [target.top, other.top];
  else target.top = defaultTop(action);
  return next;
}

/** Puts `action` in a section's bottom row, swapping with the section that had it. */
export function setBottomAction(mat: PlayerMat, section: number, action: BottomActionType): PlayerMat {
  const next = clone(mat);
  const target = next.sections[section]!;
  const other = next.sections.find((s) => s.bottom.action === action);
  if (other) [other.bottom, target.bottom] = [target.bottom, other.bottom];
  else target.bottom = { ...DEFAULT_BOTTOM[action] };
  return next;
}

/** Sets a value by dotted path, e.g. "sections.0.top.units.base". */
export function setField(mat: PlayerMat, path: string, value: string | number): PlayerMat {
  return setPath(mat, path, value);
}

export function formatMats(mats: PlayerMat[]): string {
  return JSON.stringify(mats, null, 2);
}
