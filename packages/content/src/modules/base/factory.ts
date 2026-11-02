import type { FactoryCard } from '@scythe/engine';

// A SAMPLE Factory deck, made up for play-testing until the real cards are
// entered from the physical game (with a Factory card editor, still to come).
// The effects and names here are invented, not the published cards'. Each
// has a top part (pay this to gain that) and a bottom part (a move).

export const sampleFactoryCards: FactoryCard[] = [
  { id: 'sample-f01', name: 'Spare boilers', cost: { power: 2 }, gain: { coins: 3 }, move: { units: 1, hexes: 2 } },
  { id: 'sample-f02', name: 'Night shift', cost: { popularity: 1 }, gain: { power: 3 }, move: { units: 2, hexes: 1 } },
  { id: 'sample-f03', name: 'Prototype plating', cost: { resources: { metal: 2 } }, gain: { power: 1, actions: ['deploy'] }, move: { units: 1, hexes: 2 } },
  { id: 'sample-f04', name: 'Field kitchens', cost: { resources: { food: 2 } }, gain: { popularity: 2, combatCards: 1 }, move: { units: 1, hexes: 2 } },
  { id: 'sample-f05', name: 'Timber frames', cost: { resources: { wood: 1 }, coins: 1 }, gain: { actions: ['build'] }, move: { units: 2, hexes: 1 } },
  { id: 'sample-f06', name: 'Fuel depot', cost: { resources: { oil: 2 } }, gain: { actions: ['upgrade'], coins: 1 }, move: { units: 1, hexes: 2 } },
  { id: 'sample-f07', name: 'Recruiting office', cost: { coins: 2 }, gain: { actions: ['enlist'] }, move: { units: 1, hexes: 1 } },
  { id: 'sample-f08', name: 'War room', cost: { power: 1, popularity: 1 }, gain: { combatCards: 2, coins: 2 }, move: { units: 2, hexes: 1 } },
];
