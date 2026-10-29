// Factions as data, mirroring the faction mat: home base, starting power and
// combat cards, stars, faction ability, four mech abilities and the recruit
// one-time bonuses. Abilities are text for now; Phase 2 attaches rule hooks.
import type { HomeBaseId } from './board';
import type { RecruitBonus } from './mat';

export interface Ability {
  name: string;
  /** In our own words, never the published text. */
  description: string;
}

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
