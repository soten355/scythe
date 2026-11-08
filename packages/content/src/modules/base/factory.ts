import type { FactoryCard } from '@scythe/engine';

// The Factory deck that ships with the game: 12 cards, each a top part (pay
// this to gain that) and a bottom part (a move). The effects follow the
// physical deck as the owner entered them; the names are this game's own:
// new technology the factions find inside the Factory.

export const baseFactoryCards: FactoryCard[] = [
  { id: 'factory-1', name: 'Steam Harvester', cost: { coins: 1, power: 1 }, gain: { produce: 2 }, move: { units: 1, hexes: 2 } },
  { id: 'factory-2', name: 'Telegraph Network', cost: { coins: 2 }, gain: { power: 1, actions: ['enlist'] }, move: { units: 1, hexes: 2 } },
  { id: 'factory-3', name: 'Laser Projector', cost: { power: 1 }, gain: { popularity: 2 }, move: { units: 1, hexes: 2 } },
  { id: 'factory-4', name: 'Hydraulic Press', cost: { popularity: 1 }, gain: { oneOf: true, actions: ['deploy', 'build'] }, move: { units: 1, hexes: 2 } },
  { id: 'factory-5', name: 'Calculating Engine', cost: { popularity: 1 }, gain: { oneOf: true, actions: ['upgrade', 'enlist'] }, move: { units: 1, hexes: 2 } },
  { id: 'factory-6', name: 'Ballistics Patent', cost: { combatCards: 1 }, gain: { coins: 3 }, move: { units: 1, hexes: 2 } },
  { id: 'factory-7', name: 'Electric Lighting', cost: { coins: 2 }, gain: { popularity: 1, actions: ['upgrade'] }, move: { units: 1, hexes: 2 } },
  { id: 'factory-8', name: 'Wireless Broadcast', cost: { combatCards: 1 }, gain: { popularity: 2 }, move: { units: 1, hexes: 2 } },
  { id: 'factory-9', name: 'Clockwork Servos', cost: { coins: 2 }, gain: { power: 1, actions: ['deploy'] }, move: { units: 1, hexes: 2 } },
  { id: 'factory-10', name: 'Steam Crane', cost: { coins: 2 }, gain: { popularity: 1, actions: ['build'] }, move: { units: 1, hexes: 2 } },
  { id: 'factory-11', name: 'Pneumatic Freight', cost: { combatCards: 1 }, gain: { anyResources: 3 }, move: { units: 1, hexes: 2 } },
  { id: 'factory-12', name: 'Minting Press', cost: { power: 1 }, gain: { coins: 3 }, move: { units: 1, hexes: 2 } },
];

// A small made-up deck, kept for tests that were written against it.

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
