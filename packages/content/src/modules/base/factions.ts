import type { Ability, Faction } from '@scythe/engine';

// Base game factions. Starting power and combat cards confirmed by the owner
// from the physical faction mats; abilities to be entered in the faction
// editor (factions.html in the app). More factions are added in Phase 2.

const blank = (): Ability => ({ name: '', description: '' });

const standardRecruitBonuses = (): Faction['recruitBonuses'] => [
  { bonus: 'power', amount: 2 },
  { bonus: 'coins', amount: 2 },
  { bonus: 'popularity', amount: 2 },
  { bonus: 'combatCard', amount: 2 },
];

export const baseFactions: Faction[] = [
  {
    id: 'nordic',
    name: 'Nordic',
    color: '#3d6fb6',
    homeBase: 'ne',
    power: 4,
    combatCards: 1,
    stars: 6,
    ability: blank(),
    mechAbilities: [blank(), blank(), blank(), blank()],
    recruitBonuses: standardRecruitBonuses(),
  },
  {
    id: 'rusviet',
    name: 'Rusviet',
    color: '#b83a32',
    homeBase: 'e',
    power: 3,
    combatCards: 2,
    stars: 6,
    ability: blank(),
    mechAbilities: [blank(), blank(), blank(), blank()],
    recruitBonuses: standardRecruitBonuses(),
  },
];
