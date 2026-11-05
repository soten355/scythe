// Structure bonus tiles in plain words: "Tunnels next to your structures", "1+: 2 coins · 3+: 5 coins".
import type { StructureBonusTile, StructureCount, Terrain } from '@scythe/engine';

const FEATURES = { tunnel: 'Tunnels', lake: 'Lakes', encounter: 'Encounter spots' } as const;
const PLACES: Record<Terrain, string> = {
  farm: 'farms',
  forest: 'forests',
  mountain: 'mountains',
  tundra: 'tundras',
  village: 'villages',
  lake: 'lakes',
  factory: 'the Factory',
};

export function countText(count: StructureCount): string {
  switch (count.kind) {
    case 'adjacent':
      return `${FEATURES[count.feature]} next to your structures`;
    case 'on': {
      const where = [...(count.tunnel ? ['tunnels'] : []), ...(count.terrains ?? []).map((t) => PLACES[t])];
      return `Your structures on ${where.join(' or ')}${count.tunnel ? " (a Mine doesn't make a tunnel)" : ''}`;
    }
    case 'inRow':
      return "Your longest straight row of structures (rivers don't break it)";
  }
}

export const paysText = (pays: StructureBonusTile['pays']): string => pays.map((s) => `${s.atLeast}+: ${s.coins} coin${s.coins === 1 ? '' : 's'}`).join(' · ');
