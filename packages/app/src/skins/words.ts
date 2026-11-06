// Changing a skin's words one at a time (the skin words page): a blank word
// is taken out, so it keeps the original.
import type { AbilityWords, FactionLore, FactionWords, SkinWords } from './skin';

const said = (v: string) => v.trim();

function withFaction(words: SkinWords, id: string, f: FactionWords): SkinWords {
  const factions = { ...words.factions };
  const empty = !f.name && !f.color && !f.ability && !f.mechAbilities && !f.lore;
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

/** One part of a faction's story: its character's name or bio, or its capital city, history or goals (blank: taken out). */
export function setLoreWord(words: SkinWords, id: string, key: keyof FactionLore, value: string): SkinWords {
  const { lore, ...rest } = words.factions[id] ?? {};
  const { [key]: _, ...others } = lore ?? {};
  const v = said(value);
  const next: FactionLore = v ? { ...others, [key]: v } : others;
  return withFaction(words, id, Object.keys(next).length ? { ...rest, lore: next } : rest);
}

/** A faction's story under another ID (a duplicate), or moved there (its ID changed). */
export function copyLore(words: SkinWords, from: string, to: string, { move = false } = {}): SkinWords {
  const lore = words.factions[from]?.lore;
  if (!lore) return words;
  const next = withFaction(words, to, { ...words.factions[to], lore });
  if (!move) return next;
  const { lore: _, ...rest } = next.factions[from]!;
  return withFaction(next, from, rest);
}

/** A mat's or map's new name (blank: the original). */
export function setNameWord(words: SkinWords, kind: 'mats' | 'maps', id: string, value: string): SkinWords {
  const all = { ...words[kind] };
  const v = said(value);
  if (v) all[id] = { name: v };
  else delete all[id];
  return { ...words, [kind]: all };
}
