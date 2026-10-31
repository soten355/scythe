import type { Faction } from '@scythe/engine';

// Base game factions, entered by the owner in the faction editor
// (factions.html in the app) from the physical faction mats. Ability text is
// the owner's own wording; each ability's `rule` is what the engine plays.

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
    ability: { name: 'Swim', description: 'Your workers may move across rivers', rule: { kind: 'crossRivers', units: 'workers' } },
    mechAbilities: [
      {
        name: 'Riverwalk',
        description: 'Move across rivers to forests and mountains',
        rule: { kind: 'crossRivers', units: 'characterAndMechs', onto: ['forest', 'mountain'] },
      },
      { name: 'Seaworthy', description: 'Move to/from lakes and retreat onto adjacent lakes', rule: { kind: 'lakes', retreat: true } },
      {
        name: 'Artillery',
        description: 'Before combat, you may pay 1 power to make your opponent lose 2 power',
        rule: { kind: 'drainPower', pay: 1, loss: 2 },
      },
      { name: 'Speed', description: 'Move one more hex per movement', rule: { kind: 'speed', extra: 1 } },
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
      rule: { kind: 'repeatSection' },
    },
    mechAbilities: [
      {
        name: 'Riverwalk',
        description: 'Move across rivers to farms and villages',
        rule: { kind: 'crossRivers', units: 'characterAndMechs', onto: ['farm', 'village'] },
      },
      { name: 'Township', description: 'Move between any village you control and the Factory', rule: { kind: 'villagesToFactory' } },
      {
        name: "People's Army",
        description: 'In combat where you have at least 1 worker, you may play 1 more combat card',
        rule: { kind: 'extraCardWithWorker' },
      },
      { name: 'Speed', description: 'Move one more hex per movement', rule: { kind: 'speed', extra: 1 } },
    ],
    recruitBonuses: standardRecruitBonuses(),
  },
];
