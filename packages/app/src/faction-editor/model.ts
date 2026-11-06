// Data helpers for the faction editor.
import type { Faction } from '@scythe/engine';
import type { SkinWords } from '../skins/skin';
import { setAbilityWord, setFactionWord } from '../skins/words';

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

const sameName = (a: Faction, b: Faction) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
const sameStart = (a: Faction, b: Faction) => a.homeBase === b.homeBase && a.power === b.power && a.combatCards === b.combatCards && a.stars === b.stars;

/**
 * The editor's saved list with every built-in faction in it, first and in their
 * usual order, then the player's own. The list is kept on the device and can be
 * older than the built-in factions, so it may lack one, or hold an old copy of
 * one under another ID (the same name and start): that copy takes the built-in
 * ID, and `strays` says so, for its pictures to follow. Any other faction stays
 * as the player's own.
 */
export function withBuiltIns(saved: Faction[], builtIns: Faction[]): { factions: Faction[]; strays: { from: string; to: string }[] } {
  const isBuiltIn = (f: Faction) => builtIns.some((b) => b.id === f.id);
  const strays: { from: string; to: string }[] = [];
  const taken = new Set<Faction>();
  const first = builtIns.map((b) => {
    const own = saved.find((f) => f.id === b.id);
    if (own) return own;
    const copy = saved.find((f) => !isBuiltIn(f) && !taken.has(f) && sameName(f, b) && sameStart(f, b));
    if (!copy) return b;
    taken.add(copy);
    strays.push({ from: copy.id, to: b.id });
    return { ...copy, id: b.id, name: b.name };
  });
  return { factions: [...first, ...saved.filter((f) => !isBuiltIn(f) && !taken.has(f))], strays };
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

/**
 * A built-in faction's name, colour and wording as changed in the editor's
 * copy of it (before those went to the skin), as the skin's words: each change
 * the skin doesn't already have a word for. Rules changed in the copy are left
 * out (a skin can't change them).
 */
export function wordsFromCopy(builtIn: Faction, copy: Faction, words: SkinWords): SkinWords {
  const has = words.factions[builtIn.id] ?? {};
  let next = words;
  if (copy.name.trim() && copy.name !== builtIn.name && !has.name) next = setFactionWord(next, builtIn.id, 'name', copy.name);
  if (copy.color !== builtIn.color && !has.color) next = setFactionWord(next, builtIn.id, 'color', copy.color);
  const abilities: ['ability' | number, Faction['ability'], Faction['ability'] | undefined][] = [
    ['ability', builtIn.ability, copy.ability],
    ...builtIn.mechAbilities.map((m, i): ['ability' | number, Faction['ability'], Faction['ability'] | undefined] => [i, m, copy.mechAbilities?.[i]]),
  ];
  for (const [which, original, edited] of abilities) {
    const said = which === 'ability' ? has.ability : has.mechAbilities?.[which];
    for (const key of ['name', 'description'] as const) {
      const v = edited?.[key];
      if (v && v.trim() && v !== original[key] && !said?.[key]) next = setAbilityWord(next, builtIn.id, which, key, v);
    }
  }
  return next;
}
