// Data helpers for the encounter card editor.
import { RESOURCES, validateEncounterCard, type BottomActionType, type EncounterCard, type EncounterOption } from '@scythe/engine';

const blankOption = (): EncounterOption => ({ text: '', cost: {}, gain: { resources: {}, actions: [] } });

export function newCard(id: string): EncounterCard {
  return { id, name: 'New card', story: '', options: [blankOption(), blankOption(), blankOption()] };
}

/** The first "card-N" ID no card has yet. */
export function nextId(cards: EncounterCard[]): string {
  let n = cards.length + 1;
  while (cards.some((c) => c.id === `card-${n}`)) n++;
  return `card-${n}`;
}

/** A card with every part the form edits present (resources, actions), so a field can be set by its path. */
export function editable(card: EncounterCard): EncounterCard {
  const copy = JSON.parse(JSON.stringify(card)) as EncounterCard;
  for (const o of copy.options) {
    o.cost ??= {};
    o.gain ??= {};
    o.gain.resources ??= {};
    o.gain.actions ??= [];
  }
  return copy;
}

const ACTION_ORDER: BottomActionType[] = ['upgrade', 'deploy', 'build', 'enlist'];

/** Turns a free action on or off for one option, keeping the usual order. */
export function toggleAction(card: EncounterCard, option: number, action: BottomActionType, on: boolean): EncounterCard {
  const next = editable(card);
  const gain = next.options[option]!.gain;
  const actions = new Set(gain.actions);
  if (on) actions.add(action);
  else actions.delete(action);
  gain.actions = ACTION_ORDER.filter((a) => actions.has(a));
  return next;
}

/** A card as it's stored and played: blank and zero amounts left out, text trimmed. */
export function cleanCard(card: EncounterCard): EncounterCard {
  const keep = <T extends object>(obj: T): T => Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v !== 0)) as T;
  const options = card.options.map((o) => {
    const { resources = {}, actions = [], ...counts } = o.gain;
    const res = keep(resources);
    const gain = { ...keep(counts), ...(RESOURCES.some((r) => res[r]) && { resources: res }), ...(actions.length && { actions: [...actions] }) };
    return { text: o.text.trim(), cost: keep(o.cost), gain };
  }) as EncounterCard['options'];
  return { id: card.id.trim(), name: card.name.trim(), story: card.story.trim(), options, ...(card.picture && { picture: card.picture }), ...(card.show && { show: card.show }) };
}

/** Problems with the whole deck, each naming its card; empty when it's ready. */
export function deckProblems(cards: EncounterCard[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    const card = cleanCard(c);
    const name = card.name || card.id || 'A card';
    for (const p of validateEncounterCard(card)) problems.push(`${name}: ${p}`);
    if (card.id && seen.has(card.id)) problems.push(`${name}: another card has the ID ${card.id}`);
    seen.add(card.id);
  }
  return problems;
}

export function formatCards(cards: EncounterCard[]): string {
  return JSON.stringify(cards.map(cleanCard), null, 2);
}
