import type { Faction } from '@scythe/engine';

// Base game factions, entered by the owner in the faction editor
// (factions.html in the app) from the physical faction mats. Ability text is
// the owner's own wording; Phase 2 turns each ability into rules.

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
    ability: { name: 'Swim', description: 'Your workers may move across rivers' },
    mechAbilities: [
      { name: 'Riverwalk', description: 'Move across rivers to forests and mountains' },
      { name: 'Seaworthy', description: 'Move to/from lakes and retreat onto adjacent lakes' },
      { name: 'Artillery', description: 'Before combat, you may pay 1 power to make your opponent lose 2 power' },
      { name: 'Speed', description: 'Move one more hex per movement' },
    ],
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
    ability: {
      name: 'Relentless',
      description: 'You may choose the same section on your Player Mat as the previous turn(s).',
    },
    mechAbilities: [
      { name: 'Riverwalk', description: 'Move across rivers to farms and villages' },
      { name: 'Township', description: 'Move between any village you control and the Factory' },
      { name: "People's Army", description: 'In combat where you have at least 1 worker, you may play 1 more combat card' },
      { name: 'Speed', description: 'Move one more hex per movement' },
    ],
    recruitBonuses: standardRecruitBonuses(),
  },
];
