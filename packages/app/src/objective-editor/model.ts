// Data helpers for the objective card editor.
import { RESOURCES, validateObjectiveCard, type ObjectiveCard, type ObjectiveCheck, type Resource } from '@scythe/engine';

export type CheckKind = ObjectiveCheck['kind'];

/** A fresh condition of a kind, with its amounts left blank to fill in. */
export function newCheck(kind: CheckKind): ObjectiveCheck {
  switch (kind) {
    case 'stat':
      return { kind, stat: 'coins' };
    case 'resources':
      return { kind, resources: [] };
    case 'eachResource':
      // Its amount is left blank to fill in (the check catches it until then).
      return { kind, resources: [] } as unknown as ObjectiveCheck;
    case 'units':
      return { kind, unit: 'worker' };
    case 'territories':
      return { kind };
    case 'progress':
      return { kind, what: 'upgrades' };
  }
}

export function newCard(id: string): ObjectiveCard {
  return { id, name: 'New card', story: '', checks: [newCheck('stat')] };
}

/** The first "objective-N" ID no card has yet. */
export function nextId(cards: ObjectiveCard[]): string {
  let n = cards.length + 1;
  while (cards.some((c) => c.id === `objective-${n}`)) n++;
  return `objective-${n}`;
}

/** A copy to edit, with a story to type into. */
export function editable(card: ObjectiveCard): ObjectiveCard {
  const copy = JSON.parse(JSON.stringify(card)) as ObjectiveCard;
  copy.story ??= '';
  return copy;
}

const withChecks = (card: ObjectiveCard, checks: ObjectiveCheck[]): ObjectiveCard => ({ ...editable(card), checks });

export const addCheck = (card: ObjectiveCard): ObjectiveCard => withChecks(card, [...card.checks, newCheck('stat')]);

/** Removes a condition (but never the last one). */
export const removeCheck = (card: ObjectiveCard, i: number): ObjectiveCard =>
  card.checks.length < 2 ? card : withChecks(card, card.checks.filter((_, j) => j !== i));

/** Changes what a condition counts, starting it afresh. */
export const setKind = (card: ObjectiveCard, i: number, kind: CheckKind): ObjectiveCard =>
  withChecks(card, card.checks.map((c, j) => (j === i ? newCheck(kind) : c)));

/** Turns a kind of resource on or off for a resource condition, keeping the usual order. */
export function toggleResource(card: ObjectiveCard, i: number, resource: Resource, on: boolean): ObjectiveCard {
  return withChecks(
    card,
    card.checks.map((c, j) => {
      if (j !== i || (c.kind !== 'resources' && c.kind !== 'eachResource')) return c;
      const kinds = new Set(c.resources ?? []);
      if (on) kinds.add(resource);
      else kinds.delete(resource);
      return { ...c, resources: RESOURCES.filter((r) => kinds.has(r)) };
    }),
  );
}

const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A card as it's stored and played: blank amounts and an empty story left out, text trimmed. */
export function cleanCard(card: ObjectiveCard): ObjectiveCard {
  const checks = card.checks.map((c) => {
    const out = Object.fromEntries(
      Object.entries(c).filter(([key, v]) => {
        if (key === 'atLeast' || key === 'atMost') return isAmount(v);
        if (key === 'terrain') return typeof v === 'string' && v !== '';
        if (key === 'resources') return c.kind === 'eachResource' || (Array.isArray(v) && v.length > 0);
        return v !== undefined && v !== null;
      }),
    );
    return out as unknown as ObjectiveCheck;
  });
  const story = card.story?.trim();
  return { id: card.id.trim(), name: card.name.trim(), ...(story && { story }), ...(card.endOfTurn && { endOfTurn: true }), checks };
}

/** Problems with the whole deck, each naming its card; empty when it's ready. */
export function deckProblems(cards: ObjectiveCard[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    const card = cleanCard(c);
    const name = card.name || card.id || 'A card';
    for (const p of validateObjectiveCard(card)) problems.push(`${name}: ${p}`);
    if (card.id && seen.has(card.id)) problems.push(`${name}: another card has the ID ${card.id}`);
    seen.add(card.id);
  }
  return problems;
}

export function formatCards(cards: ObjectiveCard[]): string {
  return JSON.stringify(cards.map(cleanCard), null, 2);
}
