// Data helpers for the objective card editor.
import { RESOURCES, validateObjectiveCard, type ObjectiveCard, type ObjectiveCheck, type Resource, type TerritoryCheck } from '@scythe/engine';

export type CheckKind = ObjectiveCheck['kind'];
export type PartKind = TerritoryCheck['kind'];

/** A fresh part of a one-territory condition, its amounts blank. */
export function newPart(kind: PartKind): TerritoryCheck {
  switch (kind) {
    case 'units':
      return { kind, unit: 'worker' };
    case 'resources':
      return { kind, resources: [] };
    case 'eachResource':
      return { kind, resources: [] } as unknown as TerritoryCheck;
    case 'structures':
    case 'tokens':
      return { kind };
  }
}

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
    case 'around':
      return { kind, terrain: 'lake' };
    case 'oneTerritory':
      return { kind, checks: [newPart('units')] };
    case 'same':
      return { kind, what: ['workers', 'recruits'] };
    case 'highest':
      return { kind, stat: 'power' };
    case 'thisTurn':
      return { kind, what: 'workersSentHome' };
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

/** Changes the parts of condition `i`, a one-territory condition. */
const withParts = (card: ObjectiveCard, i: number, change: (parts: TerritoryCheck[]) => TerritoryCheck[]): ObjectiveCard =>
  withChecks(card, card.checks.map((c, j) => (j === i && c.kind === 'oneTerritory' ? { ...c, checks: change(c.checks) } : c)));

export const addPart = (card: ObjectiveCard, i: number): ObjectiveCard => withParts(card, i, (parts) => [...parts, newPart('units')]);

/** Removes a part (but never the last one). */
export const removePart = (card: ObjectiveCard, i: number, part: number): ObjectiveCard =>
  withParts(card, i, (parts) => (parts.length < 2 ? parts : parts.filter((_, k) => k !== part)));

/** Changes what a part counts, starting it afresh. */
export const setPartKind = (card: ObjectiveCard, i: number, part: number, kind: PartKind): ObjectiveCard =>
  withParts(card, i, (parts) => parts.map((p, k) => (k === part ? newPart(kind) : p)));

/** A resource kind on or off, keeping the usual order. */
function toggled<T extends { kind: string; resources?: Resource[] }>(c: T, resource: Resource, on: boolean): T {
  if (c.kind !== 'resources' && c.kind !== 'eachResource') return c;
  const kinds = new Set(c.resources ?? []);
  if (on) kinds.add(resource);
  else kinds.delete(resource);
  return { ...c, resources: RESOURCES.filter((r) => kinds.has(r)) };
}

/** Turns a kind of resource on or off for a resource condition (or, given `part`, a part of a one-territory condition). */
export function toggleResource(card: ObjectiveCard, i: number, resource: Resource, on: boolean, part?: number): ObjectiveCard {
  if (part !== undefined) return withParts(card, i, (parts) => parts.map((p, k) => (k === part ? toggled(p, resource, on) : p)));
  return withChecks(card, card.checks.map((c, j) => (j === i ? toggled(c as { kind: string; resources?: Resource[] }, resource, on) as ObjectiveCheck : c)));
}

const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A condition (or a part of one) as stored: blank amounts, unticked boxes and empty lists left out. */
function cleanCheck<T extends { kind: string }>(c: T): T {
  const out = Object.fromEntries(
    Object.entries(c)
      .filter(([key, v]) => {
        if (key === 'atLeast' || key === 'atMost') return isAmount(v);
        if (key === 'terrain') return typeof v === 'string' && v !== '';
        if (key === 'resources') return c.kind === 'eachResource' || (Array.isArray(v) && v.length > 0);
        if (key === 'tunnel' || key === 'oneKind') return (v as unknown) === true;
        return v !== undefined && v !== null;
      })
      .map(([key, v]) => [key, key === 'checks' && Array.isArray(v) ? v.map(cleanCheck) : v]),
  );
  return out as T;
}

/** A card as it's stored and played: blank amounts and an empty story left out, text trimmed. */
export function cleanCard(card: ObjectiveCard): ObjectiveCard {
  const checks = card.checks.map(cleanCheck);
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
