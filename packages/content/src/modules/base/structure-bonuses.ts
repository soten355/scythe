import type { StructureBonusTile } from '@scythe/engine';

// The base game's six structure bonus tiles (entered by the owner, Nov 5,
// 2026), built in: new games draw one of these unless the owner adds tiles of
// their own from the structure bonus tile editor. Names are the owner's.
// Tiles 1-4 are as the owner entered them (tile 2 counts structures ON
// tunnels, owner's correction); tile 6 counts farms and tundras together,
// mixed in any way.

const steps = (...pays: [number, number][]) => pays.map(([atLeast, coins]) => ({ atLeast, coins }));

export const baseStructureBonuses: StructureBonusTile[] = [
  { id: 'tile-1', name: 'Tunnels, Adjacent', count: { kind: 'adjacent', feature: 'tunnel' }, pays: steps([1, 2], [2, 4], [4, 6], [6, 9]) },
  { id: 'tile-2', name: 'Tunnels, On', count: { kind: 'on', tunnel: true }, pays: steps([1, 2], [2, 4], [3, 6]) },
  { id: 'tile-3', name: 'Lakes, Adjacent', count: { kind: 'adjacent', feature: 'lake' }, pays: steps([1, 2], [2, 4], [4, 6], [6, 9]) },
  { id: 'tile-4', name: 'Encounters, Adjacent', count: { kind: 'adjacent', feature: 'encounter' }, pays: steps([1, 2], [2, 4], [4, 6], [6, 9]) },
  { id: 'tile-5', name: 'Structures in a Row', count: { kind: 'inRow' }, pays: steps([1, 2], [2, 4], [3, 6], [4, 9]) },
  { id: 'tile-6', name: 'Farms and Tundras, On', count: { kind: 'on', terrains: ['farm', 'tundra'] }, pays: steps([1, 2], [2, 4], [3, 6], [4, 9]) },
];
