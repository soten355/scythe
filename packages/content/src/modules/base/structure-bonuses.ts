import type { StructureBonusTile } from '@scythe/engine';

// SAMPLE structure bonus tiles, made up for play-testing until the real ones
// are entered from the physical game (with the structure bonus tile editor). The names and payouts here are
// invented, not the published tiles'. One is drawn for each game.

const steps = (...pays: [number, number][]) => pays.map(([atLeast, coins]) => ({ atLeast, coins }));

export const sampleStructureBonuses: StructureBonusTile[] = [
  { id: 'sample-s01', name: 'Underground access', count: { kind: 'adjacent', feature: 'tunnel' }, pays: steps([1, 2], [2, 4], [4, 7], [6, 9]) },
  { id: 'sample-s02', name: 'Waterfront', count: { kind: 'adjacent', feature: 'lake' }, pays: steps([1, 2], [3, 5], [5, 8]) },
  { id: 'sample-s03', name: 'Crossroads of rumour', count: { kind: 'adjacent', feature: 'encounter' }, pays: steps([1, 2], [3, 4], [5, 7]) },
  { id: 'sample-s04', name: 'Built on the old tunnels', count: { kind: 'on', tunnel: true }, pays: steps([1, 3], [2, 6], [3, 8]) },
  { id: 'sample-s05', name: 'Fields and frost', count: { kind: 'on', terrains: ['farm', 'tundra'] }, pays: steps([1, 2], [2, 4], [3, 6], [4, 8]) },
  { id: 'sample-s06', name: 'Long road', count: { kind: 'inRow' }, pays: steps([2, 2], [3, 5], [4, 8]) },
];
