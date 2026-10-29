// Data helpers for the faction editor.
import type { Faction } from '@scythe/engine';

export function newFaction(id: string, homeBase: string): Faction {
  const blank = () => ({ name: '', description: '' });
  return {
    id,
    name: 'New faction',
    color: '#888888',
    homeBase,
    power: 0,
    combatCards: 0,
    stars: 6,
    ability: blank(),
    mechAbilities: [blank(), blank(), blank(), blank()],
    recruitBonuses: [
      { bonus: 'power', amount: 2 },
      { bonus: 'coins', amount: 2 },
      { bonus: 'popularity', amount: 2 },
      { bonus: 'combatCard', amount: 2 },
    ],
  };
}

/** Home bases claimed by more than one faction (factions in one game need different ones). */
export function homeBaseClashes(factions: Faction[]): string[] {
  const counts = new Map<string, number>();
  for (const f of factions) counts.set(f.homeBase, (counts.get(f.homeBase) ?? 0) + 1);
  return [...counts].filter(([, n]) => n > 1).map(([home]) => `${home.toUpperCase()} is used by more than one faction`);
}

export function formatFactions(factions: Faction[]): string {
  return JSON.stringify(factions, null, 2);
}
