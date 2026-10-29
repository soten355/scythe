import type { Faction } from '@scythe/engine';

// Base game factions. Starting values confirmed by the owner from the
// physical faction mats. More factions are added in Phase 2.
export const baseFactions: Faction[] = [
  { id: 'nordic', name: 'Nordic', homeBase: 'ne', power: 4, combatCards: 1 },
  { id: 'rusviet', name: 'Rusviet', homeBase: 'e', power: 3, combatCards: 2 },
];
