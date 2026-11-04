// Pure rules engine: no DOM, no clock, no unseeded randomness, no imports from app.
// Bump ENGINE_VERSION whenever rules change in a way that affects saved games.
export const ENGINE_VERSION = '0.0.0';

export * from './rng';
export * from './board';
export * from './game';
export * from './state';
export * from './scoring';
export { moveTargets, produceCost, RESOURCES, TERRAIN_PRODUCES, yieldOf as produceYield } from './top-actions';
export * from './mat';
export * from './faction';
export * from './afford';
export { COMBAT_DECK, MAX_DIAL, MAX_COMBAT_STARS, combatUnitsOn, maxCombatCards, type CombatResult } from './combat';
export { rulesOf, rulesOfKind, hasRule } from './abilities';
export { canPay as canPayEncounter, encounterCard, validateEncounterCard, optionLimit as encounterOptionLimit, type EncounterCard, type EncounterShow, type EncounterCost, type EncounterGain, type EncounterOption, type EncounterTask } from './encounters';
export { objectiveCard, objectiveMet, validateObjectiveCard, OBJECTIVE_PROGRESS, OBJECTIVE_STATS, OBJECTIVE_UNITS, type ObjectiveCard, type ObjectiveCheck, type ObjectiveProgress, type ObjectiveStat, type ObjectiveUnit } from './objectives';
export { structureBonusCoins, structureBonusCount, structureBonusTile, validateStructureBonus, STRUCTURE_FEATURES, type StructureBonusTile, type StructureCount, type StructureFeature } from './structure-bonus';
export { factoryCard, heldFactoryCard, validateFactoryCard, type FactoryCard, type FactoryCost, type FactoryGain } from './factory';
export { unitsToMove } from './top-actions';
export * from './view';
