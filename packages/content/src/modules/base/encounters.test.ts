import { validateEncounterCard } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { baseEncounters } from './encounters';

describe('the encounter deck that ships with the game', () => {
  it('has 27 cards, each one valid, with its own ID and name', () => {
    expect(baseEncounters).toHaveLength(27);
    for (const card of baseEncounters) expect(validateEncounterCard(card), card.name).toEqual([]);
    expect(new Set(baseEncounters.map((c) => c.id)).size).toBe(27);
    expect(new Set(baseEncounters.map((c) => c.name)).size).toBe(27);
  });

  it('gives every card a story of its own', () => {
    for (const card of baseEncounters) expect(card.story.trim(), card.name).toBeTruthy();
  });

  it('has a free option, one paid in coins and one paid in popularity on every card', () => {
    for (const card of baseEncounters) {
      const [free, coins, popularity] = card.options;
      expect(free.cost, card.name).toEqual({});
      expect(Object.keys(coins.cost), card.name).toEqual(['coins']);
      expect(Object.keys(popularity.cost), card.name).toEqual(['popularity']);
    }
  });
});
