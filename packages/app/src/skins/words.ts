// Changing a skin's words one at a time (the skin words page): a blank word
// is taken out, so it keeps the original.
import type { AbilityWords, FactionWords, SkinWords } from './skin';

const said = (v: string) => v.trim();

function withFaction(words: SkinWords, id: string, f: FactionWords): SkinWords {
  const factions = { ...words.factions };
  const empty = !f.name && !f.color && !f.ability && !f.mechAbilities;
  if (empty) delete factions[id];
  else factions[id] = f;
  return { ...words, factions };
}

const tidy = (a: AbilityWords): AbilityWords | undefined => (a.name || a.description ? a : undefined);

/** A faction's new name or colour (blank: the original). */
export function setFactionWord(words: SkinWords, id: string, key: 'name' | 'color', value: string): SkinWords {
  const { [key]: _, ...rest } = words.factions[id] ?? {};
  const v = said(value);
  return withFaction(words, id, v ? { ...rest, [key]: v } : rest);
}

/** A new name or wording for a faction's ability, or one of its four mech abilities (by number). */
export function setAbilityWord(words: SkinWords, id: string, which: 'ability' | number, key: 'name' | 'description', value: string): SkinWords {
  const f = { ...(words.factions[id] ?? {}) };
  const v = said(value);
  const change = (a: AbilityWords | undefined): AbilityWords => {
    const { [key]: _, ...rest } = a ?? {};
    return v ? { ...rest, [key]: v } : rest;
  };
  if (which === 'ability') {
    const a = tidy(change(f.ability));
    if (a) f.ability = a;
    else delete f.ability;
  } else {
    const mechs = [0, 1, 2, 3].map((i) => f.mechAbilities?.[i] ?? {});
    mechs[which] = change(mechs[which]);
    if (mechs.some(tidy)) f.mechAbilities = mechs;
    else delete f.mechAbilities;
  }
  return withFaction(words, id, f);
}

/** A mat's or map's new name (blank: the original). */
export function setNameWord(words: SkinWords, kind: 'mats' | 'maps', id: string, value: string): SkinWords {
  const all = { ...words[kind] };
  const v = said(value);
  if (v) all[id] = { name: v };
  else delete all[id];
  return { ...words, [kind]: all };
}
