import type { ObjectiveCard } from '@scythe/engine';

// A SAMPLE objective deck, made up for play-testing until the real cards are
// entered from the physical game (with the objective card editor). The conditions and names here are
// invented, not the published cards'. Each card is a list of conditions that
// must all hold at once.

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
