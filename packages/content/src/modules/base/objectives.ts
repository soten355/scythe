import type { ObjectiveCard } from '@scythe/engine';

// The objective deck that ships with the game: 23 cards, each a list of
// conditions that must all hold at once. The conditions follow the physical
// deck; the names and stories are this game's own (see CLAUDE.md: our own
// wording, never the published card text). The game words each card's
// conditions itself (play/objective-text.ts); the story is just its flavour.

export const baseObjectives: ObjectiveCard[] = [
  { id: 'objective-1', name: 'Frostbound Holdings', story: 'Plant your flag where the snow never melts.', endOfTurn: true, checks: [{ kind: 'territories', terrain: 'tundra', atLeast: 3 }] },
  { id: 'objective-2', name: 'Shoulder to Shoulder', story: 'Spend little, work hard, and the people will love you for it.', checks: [{ kind: 'stat', stat: 'coins', atMost: 2 }, { kind: 'progress', what: 'workers', atLeast: 4 }, { kind: 'stat', stat: 'popularity', atLeast: 7 }] },
  { id: 'objective-3', name: 'Steel Before Sweat', story: 'Trust the machines and the Factory\'s secrets, not the crowd.', checks: [{ kind: 'progress', what: 'factoryCards', atLeast: 1 }, { kind: 'progress', what: 'mechs', atLeast: 1 }, { kind: 'progress', what: 'workers', atMost: 3 }] },
  { id: 'objective-4', name: 'A Lesson at the Border', story: 'March in strong and send their labourers running.', checks: [{ kind: 'stat', stat: 'power', atLeast: 7 }, { kind: 'thisTurn', what: 'workersSentHome', atLeast: 1 }] },
  { id: 'objective-5', name: 'Leap Ahead', story: 'Skip the slow improvements: the Factory has something better.', checks: [{ kind: 'progress', what: 'factoryCards', atLeast: 1 }, { kind: 'progress', what: 'upgrades', atMost: 0 }] },
  { id: 'objective-6', name: 'Overflowing Coffers', story: 'Count it twice before bed.', endOfTurn: true, checks: [{ kind: 'stat', stat: 'coins', atLeast: 20 }] },
  { id: 'objective-7', name: 'Lone Outpost', story: 'A leader, one machine, one loyal hand, and a well-stocked cellar.', endOfTurn: true, checks: [{ kind: 'oneTerritory', checks: [{ kind: 'units', unit: 'character', atLeast: 1 }, { kind: 'units', unit: 'mech', atLeast: 1, atMost: 1 }, { kind: 'units', unit: 'worker', atLeast: 1, atMost: 1 }, { kind: 'resources', atLeast: 5 }] }] },
  { id: 'objective-8', name: 'Timberlands', story: 'Whoever holds the woods builds the future.', endOfTurn: true, checks: [{ kind: 'territories', terrain: 'forest', atLeast: 3 }] },
  { id: 'objective-9', name: 'Even Ranks', story: 'A recruit for every pair of hands in the fields.', checks: [{ kind: 'same', what: ['workers', 'recruits'] }] },
  { id: 'objective-10', name: 'Stronghold', story: 'Gather everything you have in one place and dare them to come.', checks: [{ kind: 'oneTerritory', checks: [{ kind: 'tokens', atLeast: 6 }] }] },
  { id: 'objective-11', name: 'The Gentle Hand', story: 'Lay down your arms; the crowds will carry you.', checks: [{ kind: 'stat', stat: 'power', atMost: 0 }, { kind: 'stat', stat: 'popularity', atLeast: 13 }, { kind: 'progress', what: 'workers', atLeast: 5 }] },
  { id: 'objective-12', name: 'Fields of Plenty', story: 'Golden rows as far as the eye can see.', endOfTurn: true, checks: [{ kind: 'territories', terrain: 'farm', atLeast: 3 }] },
  { id: 'objective-13', name: 'Winter Stores', story: 'One granary, filled with a little of everything and a lot in all.', endOfTurn: true, checks: [{ kind: 'oneTerritory', checks: [{ kind: 'resources', atLeast: 9 }, { kind: 'eachResource', resources: ['oil', 'metal', 'wood', 'food'], atLeast: 1 }] }] },
  { id: 'objective-14', name: 'Cornered Market', story: 'Own so much of one good that everyone must come to you.', endOfTurn: true, checks: [{ kind: 'resources', oneKind: true, atLeast: 9 }] },
  { id: 'objective-15', name: 'A Little of Everything', story: 'Never put all your eggs in one basket.', endOfTurn: true, checks: [{ kind: 'progress', what: 'upgrades', atLeast: 1 }, { kind: 'progress', what: 'mechs', atLeast: 1 }, { kind: 'progress', what: 'structures', atLeast: 1 }, { kind: 'progress', what: 'recruits', atLeast: 1 }, { kind: 'eachResource', resources: ['oil', 'metal', 'wood', 'food'], atLeast: 1 }] },
  { id: 'objective-16', name: 'Seasoned Commander', story: 'Blooded in battle, with plenty of tricks still up your sleeve.', checks: [{ kind: 'stat', stat: 'combatCards', atLeast: 8 }, { kind: 'progress', what: 'fightsWon', atLeast: 1 }] },
  { id: 'objective-17', name: 'High Passes', story: 'Hold the peaks and you watch every road.', endOfTurn: true, checks: [{ kind: 'territories', terrain: 'mountain', atLeast: 3 }] },
  { id: 'objective-18', name: 'Master of the Factory', story: 'Stand at the heart of the land, stronger than anyone.', endOfTurn: true, checks: [{ kind: 'territories', terrain: 'factory', atLeast: 1 }, { kind: 'highest', stat: 'power' }] },
  { id: 'objective-19', name: 'Down Below', story: 'The old tunnels are yours to command.', endOfTurn: true, checks: [{ kind: 'territories', tunnel: true, atLeast: 3 }] },
  { id: 'objective-20', name: 'Lakeside Ring', story: 'Close a ring around the water.', endOfTurn: true, checks: [{ kind: 'around', terrain: 'lake', atLeast: 5 }] },
  { id: 'objective-21', name: 'Hamlets', story: 'Many small towns make a nation.', endOfTurn: true, checks: [{ kind: 'territories', terrain: 'village', atLeast: 3 }] },
  { id: 'objective-22', name: 'Ring Around the Factory', story: 'Hem in the Factory without ever setting foot inside.', endOfTurn: true, checks: [{ kind: 'progress', what: 'factoryCards', atMost: 0 }, { kind: 'around', terrain: 'factory', atLeast: 2 }] },
  { id: 'objective-23', name: 'Roots in the Soil', story: 'Build to stay, and leave the war machines at home.', checks: [{ kind: 'progress', what: 'structures', atLeast: 3 }, { kind: 'stat', stat: 'popularity', atLeast: 7 }, { kind: 'progress', what: 'mechs', atMost: 0 }] },
];

// A small made-up deck, kept for tests that were written against it.

export const sampleObjectives: ObjectiveCard[] = [
  { id: 'sample-o01', name: 'War chest', story: 'Hoard coins and keep the people on your side.', checks: [{ kind: 'stat', stat: 'coins', atLeast: 14 }, { kind: 'stat', stat: 'popularity', atLeast: 7 }] },
  { id: 'sample-o02', name: 'Bread basket', story: 'Workers tending three farms.', checks: [{ kind: 'units', unit: 'worker', terrain: 'farm', atLeast: 3 }] },
  { id: 'sample-o03', name: 'Timber and iron', story: 'Stockpile wood and metal.', checks: [{ kind: 'eachResource', resources: ['wood', 'metal'], atLeast: 3 }] },
  { id: 'sample-o04', name: 'Iron fist', story: 'A strong army and plenty of combat cards.', checks: [{ kind: 'stat', stat: 'power', atLeast: 10 }, { kind: 'stat', stat: 'combatCards', atLeast: 4 }] },
  { id: 'sample-o05', name: 'Peaceful folk', story: 'End your turn with no mechs at all and popularity high.', endOfTurn: true, checks: [{ kind: 'progress', what: 'mechs', atMost: 0 }, { kind: 'stat', stat: 'popularity', atLeast: 10 }] },
  { id: 'sample-o06', name: 'Mountain watch', story: 'Hold two mountains.', checks: [{ kind: 'territories', terrain: 'mountain', atLeast: 2 }] },
  { id: 'sample-o07', name: 'Far and wide', story: 'Control many territories.', checks: [{ kind: 'territories', atLeast: 10 }] },
  { id: 'sample-o08', name: 'Oil baron', story: 'Pile up oil.', checks: [{ kind: 'resources', resources: ['oil'], atLeast: 5 }] },
  { id: 'sample-o09', name: 'Builders', story: 'Two structures and two upgrades.', checks: [{ kind: 'progress', what: 'structures', atLeast: 2 }, { kind: 'progress', what: 'upgrades', atLeast: 2 }] },
  { id: 'sample-o10', name: 'At the Factory', story: 'End your turn with your character on the Factory.', endOfTurn: true, checks: [{ kind: 'units', unit: 'character', terrain: 'factory', atLeast: 1 }] },
];
