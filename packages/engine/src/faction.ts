// Factions as data, mirroring the faction mat: home base, starting power and
// combat cards, stars, faction ability, four mech abilities and the recruit
// one-time bonuses. Each ability can carry a rule (below), which is what the
// engine plays; the name and description are only for showing.
import type { HomeBaseId, Terrain } from './board';
import type { RecruitBonus } from './mat';

export interface Ability {
  name: string;
  /** In our own words, never the published text. */
  description: string;
  /** What the ability does in the rules. Without one, it's only text. */
  rule?: AbilityRule;
}

/**
 * The rules an ability can have, as data so factions can share them. Mech
 * abilities count once that mech is deployed, and the movement ones work
 * for the character as well as the mechs.
 */
export type AbilityRule =
  /** Cross rivers: workers anywhere, or the character and mechs onto these terrains only. */
  | { kind: 'crossRivers'; units: 'workers' }
  | { kind: 'crossRivers'; units: 'characterAndMechs'; onto: Terrain[] }
  /** The character and mechs may move onto and off lakes, and may retreat onto a lake next to a lost fight. */
  | { kind: 'lakes'; retreat: boolean }
  /** The character and mechs may move this many extra hexes each move. */
  | { kind: 'speed'; extra: number }
  /** The character and mechs may move between villages you control and the Factory as if they were next to each other. */
  | { kind: 'villagesToFactory' }
  /** Before a fight's dials, you may pay this much power to make the other side lose some. */
  | { kind: 'drainPower'; pay: number; loss: number }
  /** In a fight where you have a worker, you may play one more combat card. */
  | { kind: 'extraCardWithWorker' }
  /** You may pick the same player mat section as on your last turn. */
  | { kind: 'repeatSection' };

export interface Faction {
  id: string;
  name: string;
  /** Display color, e.g. "#3366cc". */
  color: string;
  /** Which home base on the board this faction starts at. */
  homeBase: HomeBaseId;
  power: number;
  combatCards: number;
  stars: number;
  ability: Ability;
  /** Unlocked one at a time as mechs are deployed. */
  mechAbilities: [Ability, Ability, Ability, Ability];
  /** Gained once when a recruit is placed on that space. */
  recruitBonuses: { bonus: RecruitBonus; amount: number }[];
}

export const MAX_POWER = 16;

const wholeNumber = (n: number) => Number.isInteger(n) && n >= 0;

/** Returns a list of problems in plain language; empty means the faction is usable. */
export function validateFaction(f: Faction): string[] {
  const problems: string[] = [];
  if (!f.name.trim()) problems.push('name is missing');
  if (!f.id.trim()) problems.push('ID is missing');
  if (!f.homeBase) problems.push('home base is missing');
  if (!wholeNumber(f.power) || f.power > MAX_POWER) problems.push(`starting power must be between 0 and ${MAX_POWER}`);
  if (!wholeNumber(f.combatCards)) problems.push('starting combat cards must be a whole number of 0 or more');
  if (!wholeNumber(f.stars)) problems.push('stars must be a whole number of 0 or more');
  f.recruitBonuses.forEach((r, i) => {
    if (!wholeNumber(r.amount)) problems.push(`recruit bonus ${i + 1} amount must be a whole number of 0 or more`);
  });
  return problems;
}
