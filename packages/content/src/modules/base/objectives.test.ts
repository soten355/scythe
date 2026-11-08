import { validateObjectiveCard } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { baseObjectives } from './objectives';

describe('the objective deck that ships with the game', () => {
  it('has 23 cards, each one valid, with its own ID and name', () => {
    expect(baseObjectives).toHaveLength(23);
    for (const card of baseObjectives) expect(validateObjectiveCard(card), card.name).toEqual([]);
    expect(new Set(baseObjectives.map((c) => c.id)).size).toBe(23);
    expect(new Set(baseObjectives.map((c) => c.name)).size).toBe(23);
  });

  it('gives every card a story of its own', () => {
    for (const card of baseObjectives) expect(card.story?.trim(), card.name).toBeTruthy();
  });
});
