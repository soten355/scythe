// Data helpers for the Factory card editor.
import { RESOURCES, validateFactoryCard, type BottomActionType, type FactoryCard } from '@scythe/engine';

export function newCard(id: string): FactoryCard {
  return { id, name: 'New card', cost: { resources: {} }, gain: { actions: [] }, move: { units: 1, hexes: 1 } };
}

/** The first "factory-N" ID no card has yet. */
export function nextId(cards: FactoryCard[]): string {
  let n = cards.length + 1;
  while (cards.some((c) => c.id === `factory-${n}`)) n++;
  return `factory-${n}`;
}

/** A card with every part the form edits present (resources, actions), so a field can be set by its path. */
export function editable(card: FactoryCard): FactoryCard {
  const copy = JSON.parse(JSON.stringify(card)) as FactoryCard;
  copy.cost ??= {};
  copy.cost.resources ??= {};
  copy.gain ??= {};
  copy.gain.actions ??= [];
  copy.move ??= { units: 1, hexes: 1 };
  return copy;
}

const ACTION_ORDER: BottomActionType[] = ['upgrade', 'deploy', 'build', 'enlist'];

/** Turns a free action on or off, keeping the usual order. */
export function toggleAction(card: FactoryCard, action: BottomActionType, on: boolean): FactoryCard {
  const next = editable(card);
  const actions = new Set(next.gain.actions);
  if (on) actions.add(action);
  else actions.delete(action);
  next.gain.actions = ACTION_ORDER.filter((a) => actions.has(a));
  return next;
}

/** A card as it's stored and played: blank and zero amounts left out, text trimmed. */
export function cleanCard(card: FactoryCard): FactoryCard {
  const keep = <T extends object>(obj: T): T => Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v !== 0)) as T;
  const { resources = {}, ...costCounts } = card.cost;
  const res = keep(resources);
  const { actions = [], ...gainCounts } = card.gain;
  return {
    id: card.id.trim(),
    name: card.name.trim(),
    cost: { ...keep(costCounts), ...(RESOURCES.some((r) => res[r]) && { resources: res }) },
    gain: { ...keep(gainCounts), ...(actions.length && { actions: [...actions] }) },
    // A blank move stays as it is, for the check to point out.
    move: { units: card.move.units, hexes: card.move.hexes },
  };
}

/** Problems with the whole deck, each naming its card; empty when it's ready. */
export function deckProblems(cards: FactoryCard[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    const card = cleanCard(c);
    const name = card.name || card.id || 'A card';
    for (const p of validateFactoryCard(card)) problems.push(`${name}: ${p}`);
    if (card.id && seen.has(card.id)) problems.push(`${name}: another card has the ID ${card.id}`);
    seen.add(card.id);
  }
  return problems;
}

export function formatCards(cards: FactoryCard[]): string {
  return JSON.stringify(cards.map(cleanCard), null, 2);
}
