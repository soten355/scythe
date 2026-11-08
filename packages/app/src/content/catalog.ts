// The built-in maps, factions and mats: what the new game screen offers
// before the player's own.
import { baseBoard, baseFactions, baseMats, sampleEncounters, baseFactoryCards, baseObjectives, baseStructureBonuses } from '@scythe/content';
import type { Catalog } from '../menu/setup';

export const BUILT_IN: Catalog = {
  maps: [{ id: 'standard', name: 'Standard map', board: baseBoard }],
  factions: baseFactions,
  mats: baseMats,
  // Until the real deck is entered with the encounter card editor.
  encounters: sampleEncounters,
  // The full deck; a deck added from the Factory card editor takes its place.
  factory: baseFactoryCards,
  // The full deck; a deck added from the objective card editor takes its place.
  objectives: baseObjectives,
  // Until the real tiles are entered with the structure bonus tile editor.
  structureBonuses: baseStructureBonuses,
};
