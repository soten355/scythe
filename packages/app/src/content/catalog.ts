// The built-in maps, factions and mats: what the new game screen offers
// before the player's own.
import { baseBoard, baseFactions, baseMats, sampleEncounters, sampleFactoryCards, sampleObjectives, sampleStructureBonuses } from '@scythe/content';
import type { Catalog } from '../menu/setup';

export const BUILT_IN: Catalog = {
  maps: [{ id: 'standard', name: 'Standard map', board: baseBoard }],
  factions: baseFactions,
  mats: baseMats,
  // Until the real deck is entered with the encounter card editor.
  encounters: sampleEncounters,
  // Until the real deck is entered with the Factory card editor.
  factory: sampleFactoryCards,
  // Until the real deck is entered with the objective card editor.
  objectives: sampleObjectives,
  // Until the real tiles are entered with the structure bonus tile editor.
  structureBonuses: sampleStructureBonuses,
};
