import type { EncounterCard } from '@scythe/engine';

// A SAMPLE encounter deck, made up for play-testing until the real cards are
// entered from the physical game (with the encounter card editor, still to
// come). The effects here are invented, not the published cards'; each card
// follows the usual pattern of a free option, one that costs coins and one
// that costs popularity.

export const sampleEncounters: EncounterCard[] = [
  {
    id: 'sample-01',
    name: 'The stranded cart',
    story: 'A farmer waves you down: one wheel of his cart is stuck in the mud.',
    options: [
      { text: 'Help push it out: he shares his lunch.', cost: {}, gain: { resources: { food: 2 } } },
      { text: 'Buy his spare tools.', cost: { coins: 2 }, gain: { actions: ['upgrade'] } },
      { text: 'Take the cart and leave him there.', cost: { popularity: 2 }, gain: { coins: 2, resources: { wood: 2, food: 2 } } },
    ],
  },
  {
    id: 'sample-02',
    name: 'Smoke over the ridge',
    story: 'A charcoal burner works alone in a clearing, half hidden by his own smoke.',
    options: [
      { text: 'Lend a hand with the kiln.', cost: {}, gain: { power: 2 } },
      { text: 'Hire him and his sons.', cost: { coins: 2 }, gain: { workers: 2 } },
      { text: 'Drive him off and keep the clearing.', cost: { popularity: 2 }, gain: { actions: ['build'] } },
    ],
  },
  {
    id: 'sample-03',
    name: 'An old soldier',
    story: 'A veteran on a bench outside the tavern still wears his medals.',
    options: [
      { text: 'Hear his stories.', cost: {}, gain: { popularity: 2 } },
      { text: 'Pay for his maps of the hills.', cost: { coins: 2 }, gain: { combatCards: 2, power: 1 } },
      { text: 'Press him back into service.', cost: { popularity: 2 }, gain: { actions: ['enlist'] } },
    ],
  },
  {
    id: 'sample-04',
    name: 'The abandoned workshop',
    story: 'Behind a fallen fence, a mech frame stands rusting under a tarpaulin.',
    options: [
      { text: 'Salvage what you can carry.', cost: {}, gain: { resources: { metal: 2 } } },
      { text: 'Pay a mechanic to look at it.', cost: { coins: 3 }, gain: { actions: ['deploy'] } },
      { text: 'Strip the whole place.', cost: { popularity: 3 }, gain: { resources: { metal: 3, oil: 2 } } },
    ],
  },
  {
    id: 'sample-05',
    name: 'Market day',
    story: 'Stalls line the square, and everyone is selling something.',
    options: [
      { text: 'Sell a little of what you carry.', cost: {}, gain: { coins: 3 } },
      { text: 'Buy whatever you need.', cost: { coins: 2 }, gain: { anyResources: 3 } },
      { text: 'Close the market and tax the traders.', cost: { popularity: 2 }, gain: { coins: 5 } },
    ],
  },
  {
    id: 'sample-06',
    name: 'Refugees on the road',
    story: 'A family with everything they own on their backs asks the way north.',
    options: [
      { text: 'Share your supplies.', cost: {}, gain: { popularity: 1, combatCards: 1 } },
      { text: 'Offer them work and a roof.', cost: { coins: 1 }, gain: { workers: 1, popularity: 1 } },
      { text: 'Take what they carry.', cost: { popularity: 3 }, gain: { coins: 2, anyResources: 2, power: 2 } },
    ],
  },
];
