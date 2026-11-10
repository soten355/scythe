import type { EncounterCard } from '@scythe/engine';

// The base game's encounter deck: 27 cards. The effects (costs and rewards)
// are as the owner entered them from the physical cards; the names, stories
// and option text are our own words. Each card has a free option, one that
// costs coins and one that costs popularity.

export const baseEncounters: EncounterCard[] = [
  {
    id: 'encounter-1',
    name: 'The harvest fair',
    story: 'Fiddles and lanterns: a farming village celebrates the last of the harvest.',
    options: [
      { text: 'Join the dancing and buy a round for the musicians.', cost: {}, gain: { coins: 2, popularity: 1 } },
      { text: 'Pay a signing bonus to the strongest young farmhands.', cost: { coins: 3 }, gain: { actions: ['enlist'] } },
      { text: 'Requisition the grain set aside for winter.', cost: { popularity: 2 }, gain: { resources: { food: 4 } } },
    ],
  },
  {
    id: 'encounter-2',
    name: 'The flooded mill',
    story: 'The river has burst its banks, and the mill wheel is jammed with debris.',
    options: [
      { text: 'Help clear the wheel; the miller pays you for your trouble.', cost: {}, gain: { coins: 2, popularity: 1 } },
      { text: 'Fund new sluice gates and drill your troops on the work.', cost: { coins: 2 }, gain: { power: 2, popularity: 2 } },
      { text: 'Claim the mill and everything stored in it.', cost: { popularity: 3 }, gain: { anyResources: 5 } },
    ],
  },
  {
    id: 'encounter-3',
    name: 'Orchard in bloom',
    story: 'An old woman tends a hillside orchard alone; her sons never came back from the war.',
    options: [
      { text: 'Help her prune the trees; she fills your packs with apples.', cost: {}, gain: { popularity: 1, resources: { food: 2 } } },
      { text: 'Pay a nephew to come home and work the orchard for you.', cost: { coins: 2 }, gain: { workers: 1, resources: { food: 3 } } },
      { text: 'Fell half the trees and raise a building in their place.', cost: { popularity: 2 }, gain: { actions: ['build'] } },
    ],
  },
  {
    id: 'encounter-4',
    name: 'The seeping well',
    story: 'Black oil bubbles up through a farmer’s drinking well.',
    options: [
      { text: 'Help him dig a new well, and keep the oil from the old one.', cost: {}, gain: { popularity: 1, resources: { oil: 2 } } },
      { text: 'Hire a crew to put up a derrick over the spring.', cost: { coins: 3 }, gain: { actions: ['build'] } },
      { text: 'Fence off the field and pump it dry.', cost: { popularity: 2 }, gain: { resources: { oil: 4 } } },
    ],
  },
  {
    id: 'encounter-5',
    name: 'The lamp-oil peddler',
    story: 'A peddler’s wagon rattles by, hung with lanterns and barrels of lamp oil.',
    options: [
      { text: 'Fix his loose axle; he thanks you with a barrel.', cost: {}, gain: { popularity: 1, resources: { oil: 2 } } },
      { text: 'Buy the fine tools he keeps under the seat.', cost: { coins: 2 }, gain: { actions: ['upgrade'] } },
      { text: 'Seize the wagon for the war effort.', cost: { popularity: 2 }, gain: { resources: { oil: 4 } } },
    ],
  },
  {
    id: 'encounter-6',
    name: 'The engine in the barn',
    story: 'A tinkerer swears the half-built walker in his barn will run with one more part.',
    options: [
      { text: 'Admire his work; he lets you drain the spare tank.', cost: {}, gain: { popularity: 1, resources: { oil: 2 } } },
      { text: 'Buy him the part and take the walker into service.', cost: { coins: 4 }, gain: { actions: ['deploy'] } },
      { text: 'Turn him out and sell off his workshop.', cost: { popularity: 2 }, gain: { anyResources: 2, coins: 2 } },
    ],
  },
  {
    id: 'encounter-7',
    name: 'A wedding in the village',
    story: 'Ribbons hang across the lane: two families are joined today.',
    options: [
      { text: 'Raise a toast and leave a gift of silver.', cost: {}, gain: { popularity: 1, coins: 2 } },
      { text: 'Pay the dowry; the groom’s brother joins you with a cart of goods.', cost: { coins: 2 }, gain: { workers: 1, anyResources: 2 } },
      { text: 'Take over the village green for your own building works.', cost: { popularity: 2 }, gain: { actions: ['build'] } },
    ],
  },
  {
    id: 'encounter-8',
    name: 'The quarry strike',
    story: 'Stonecutters have downed tools outside the quarry, demanding fair pay.',
    options: [
      { text: 'Hear them out; their grateful foreman passes the hat for you.', cost: {}, gain: { popularity: 1, coins: 2 } },
      { text: 'Pay their wages and buy up the ore they cut before the strike.', cost: { coins: 2 }, gain: { resources: { metal: 4 } } },
      { text: 'Break the strike and put the quarry to your own use.', cost: { popularity: 2 }, gain: { actions: ['build'] } },
    ],
  },
  {
    id: 'encounter-9',
    name: 'The woodcutters’ camp',
    story: 'Axes ring out among the pines, where a band of woodcutters has made camp.',
    options: [
      { text: 'Share their fire and swap tales of the front.', cost: {}, gain: { combatCards: 1, popularity: 1 } },
      { text: 'Buy their stack of seasoned timber.', cost: { coins: 2 }, gain: { resources: { wood: 4 } } },
      { text: 'Conscript the strongest of them.', cost: { popularity: 2 }, gain: { actions: ['enlist'] } },
    ],
  },
  {
    id: 'encounter-10',
    name: 'The deserter',
    story: 'A young soldier in a muddy uniform hides in a hayloft, shaking.',
    options: [
      { text: 'Give him dry clothes; he tells you what he saw on the other side.', cost: {}, gain: { combatCards: 1, popularity: 1 } },
      { text: 'Pay for his silence and the goods he stole on his way out.', cost: { coins: 2 }, gain: { anyResources: 3 } },
      { text: 'Hand him back to his officers, in exchange for their broken mech.', cost: { popularity: 3 }, gain: { actions: ['deploy'] } },
    ],
  },
  {
    id: 'encounter-11',
    name: 'The foundry fire',
    story: 'Smoke pours from a foundry roof, and the workers are running buckets from the river.',
    options: [
      { text: 'Join the bucket line; the owner gives you the ingots you saved.', cost: {}, gain: { popularity: 1, resources: { metal: 2 } } },
      { text: 'Pay the scorched workers to join your cause.', cost: { coins: 3 }, gain: { actions: ['enlist'] } },
      { text: 'Let it burn, then pick through the ruins.', cost: { popularity: 2 }, gain: { resources: { metal: 4 } } },
    ],
  },
  {
    id: 'encounter-12',
    name: 'The poet in the square',
    story: 'A crowd has gathered around a poet reciting verses about the war.',
    options: [
      { text: 'Listen closely; one verse hints at an enemy’s plans.', cost: {}, gain: { combatCards: 1, popularity: 1 } },
      { text: 'Pay for her to print her poems in your name.', cost: { coins: 2 }, gain: { popularity: 3 } },
      { text: 'Silence her and fine the crowd in firewood.', cost: { popularity: 2 }, gain: { resources: { wood: 4 } } },
    ],
  },
  {
    id: 'encounter-13',
    name: 'The proving ground',
    story: 'An old army range, its targets still standing in the long grass.',
    options: [
      { text: 'Drill your escort on the range, to the cheers of the locals.', cost: {}, gain: { power: 2, popularity: 1 } },
      { text: 'Hire the retired range master to train your troops.', cost: { coins: 2 }, gain: { power: 4 } },
      { text: 'Strip the armoury for parts and better gear.', cost: { popularity: 2 }, gain: { anyResources: 2, actions: ['upgrade'] } },
    ],
  },
  {
    id: 'encounter-14',
    name: 'The lost flock',
    story: 'A shepherd boy has lost half his flock in the fog.',
    options: [
      { text: 'Help round up the sheep; his family feeds you supper.', cost: {}, gain: { popularity: 1, resources: { food: 2 } } },
      { text: 'Pay the boy to work for you, wool and all.', cost: { coins: 2 }, gain: { workers: 1, anyResources: 2 } },
      { text: 'Pay him in promises and take him for a soldier.', cost: { popularity: 2 }, gain: { actions: ['enlist'] } },
    ],
  },
  {
    id: 'encounter-15',
    name: 'The ironmonger’s widow',
    story: 'A widow sits among her late husband’s anvils, unsure what to do next.',
    options: [
      { text: 'Help her sort the shop; she sends you off with a meal.', cost: {}, gain: { popularity: 1, resources: { food: 2 } } },
      { text: 'Buy the shop’s stock at a fair price.', cost: { coins: 2 }, gain: { anyResources: 3 } },
      { text: 'Take her apprentice and the iron, and leave her the empty shop.', cost: { popularity: 2 }, gain: { workers: 1, resources: { metal: 3 } } },
    ],
  },
  {
    id: 'encounter-16',
    name: 'The village elder',
    story: 'The elder of a farming village asks what you will do for her people.',
    options: [
      { text: 'Promise to keep the roads safe; she gives you a gift of coins.', cost: {}, gain: { coins: 2, popularity: 1 } },
      { text: 'Pay for the young men’s uniforms if they ride with you.', cost: { coins: 3 }, gain: { actions: ['enlist'] } },
      { text: 'Take her grandson and the village’s grain as a guarantee.', cost: { popularity: 2 }, gain: { workers: 1, resources: { food: 3 } } },
    ],
  },
  {
    id: 'encounter-17',
    name: 'The parade',
    story: 'A town is holding a parade for its returning soldiers.',
    options: [
      { text: 'March at the front of the parade.', cost: {}, gain: { power: 2, popularity: 1 } },
      { text: 'Pay for a feast for the veterans.', cost: { coins: 2 }, gain: { popularity: 3 } },
      { text: 'Turn the parade ground into a building site.', cost: { popularity: 2 }, gain: { actions: ['build'] } },
    ],
  },
  {
    id: 'encounter-18',
    name: 'The crashed walker',
    story: 'A mech lies on its side in a beet field, its pilot pinned beneath it.',
    options: [
      { text: 'Free the pilot; the farmer gives you a basket from the field.', cost: {}, gain: { popularity: 1, resources: { food: 2 } } },
      { text: 'Pay the farmers to haul it upright, and take it for yourself.', cost: { coins: 4 }, gain: { actions: ['deploy'] } },
      { text: 'Leave the pilot and strip the beets and the iron.', cost: { popularity: 2 }, gain: { resources: { food: 2, metal: 2 } } },
    ],
  },
  {
    id: 'encounter-19',
    name: 'The fencing master',
    story: 'An aging duellist offers lessons to anyone with a coin.',
    options: [
      { text: 'Spar with him in the yard; he shares a trick or two.', cost: {}, gain: { combatCards: 1, popularity: 1 } },
      { text: 'Pay for a full course of lessons.', cost: { coins: 2 }, gain: { power: 2, combatCards: 2 } },
      { text: 'Have him arrested and seize the mech he keeps in the stable.', cost: { popularity: 3 }, gain: { actions: ['deploy'] } },
    ],
  },
  {
    id: 'encounter-20',
    name: 'The bakery',
    story: 'The smell of fresh bread drifts from a little bakery at the crossroads.',
    options: [
      { text: 'Help the baker carry the sacks in; he pays you for the work.', cost: {}, gain: { coins: 2, popularity: 1 } },
      { text: 'Buy out the morning’s baking.', cost: { coins: 2 }, gain: { resources: { food: 4 } } },
      { text: 'Pull it down and build on the crossroads.', cost: { popularity: 2 }, gain: { actions: ['build'] } },
    ],
  },
  {
    id: 'encounter-21',
    name: 'The sawmill',
    story: 'A family sawmill turns out planks beside a fast stream.',
    options: [
      { text: 'Help stack the planks; the family packs you a lunch.', cost: {}, gain: { popularity: 1, resources: { food: 2 } } },
      { text: 'Buy up their surplus.', cost: { coins: 2 }, gain: { anyResources: 3 } },
      { text: 'Take the mill, its timber and the eldest son to run it.', cost: { popularity: 2 }, gain: { workers: 1, resources: { wood: 3 } } },
    ],
  },
  {
    id: 'encounter-22',
    name: 'The oil baron’s envoy',
    story: 'A man in a fine coat steps out of a motor car and offers you a deal.',
    options: [
      { text: 'Hear him out over a glass of brandy; he leaves a purse.', cost: {}, gain: { coins: 2, popularity: 1 } },
      { text: 'Buy a share of his barrels.', cost: { coins: 2 }, gain: { resources: { oil: 4 } } },
      { text: 'Take his bodyguards into your army.', cost: { popularity: 2 }, gain: { actions: ['enlist'] } },
    ],
  },
  {
    id: 'encounter-23',
    name: 'The traveling circus',
    story: 'Bright tents rise in a meadow: a circus has come to town.',
    options: [
      { text: 'Bring your troops to the show.', cost: {}, gain: { popularity: 2 } },
      { text: 'Buy goods from the circus traders.', cost: { coins: 2 }, gain: { anyResources: 3 } },
      { text: 'Seize the wagons and everything in them.', cost: { popularity: 3 }, gain: { anyResources: 5 } },
    ],
  },
  {
    id: 'encounter-24',
    name: 'The beekeeper',
    story: 'Hives stand in rows across a clover field, humming in the sun.',
    options: [
      { text: 'Help with the honey harvest; he shares his jars.', cost: {}, gain: { popularity: 1, resources: { food: 2 } } },
      { text: 'Pay for a builder to put up a shelter by the hives.', cost: { coins: 3 }, gain: { actions: ['build'] } },
      { text: 'Clear the hives and put his son to work cutting wood.', cost: { popularity: 2 }, gain: { workers: 1, resources: { wood: 3 } } },
    ],
  },
  {
    id: 'encounter-25',
    name: 'The armoured train',
    story: 'An armoured train sits abandoned on a siding, its crew long gone.',
    options: [
      { text: 'Help the villagers drag its guns away from their homes.', cost: {}, gain: { popularity: 2 } },
      { text: 'Pay engineers to build a mech from its plating.', cost: { coins: 4 }, gain: { actions: ['deploy'] } },
      { text: 'Turn its guns on the next village to drill your gunners.', cost: { popularity: 2 }, gain: { combatCards: 2, power: 3 } },
    ],
  },
  {
    id: 'encounter-26',
    name: 'The mechanic’s apprentice',
    story: 'A girl with oil on her face is trying to repair a broken mech alone.',
    options: [
      { text: 'Hand her the tools while she works; she shares her lunch.', cost: {}, gain: { popularity: 1, resources: { food: 2 } } },
      { text: 'Pay her to join you, and finish the mech together.', cost: { coins: 2 }, gain: { workers: 1, actions: ['deploy'] } },
      { text: 'Chase her off and finish the mech yourself.', cost: { popularity: 3 }, gain: { actions: ['deploy'] } },
    ],
  },
  {
    id: 'encounter-27',
    name: 'The salvage yard',
    story: 'Rusting mech parts lie in heaps behind a scrap merchant’s shed.',
    options: [
      { text: 'Help him sort his scrap; he pays you a little.', cost: {}, gain: { coins: 2, popularity: 1 } },
      { text: 'Buy the best of his scrap.', cost: { coins: 2 }, gain: { resources: { metal: 4 } } },
      { text: 'Seize the yard and build a walker from the wreckage.', cost: { popularity: 3 }, gain: { actions: ['deploy'] } },
    ],
  },
];

// A made-up deck from before the real cards were entered. Kept for tests
// that want a small deck.
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
