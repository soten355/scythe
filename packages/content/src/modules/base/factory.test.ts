import { validateFactoryCard } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { baseFactoryCards } from './factory';

describe('the Factory deck that ships with the game', () => {
  it('has 12 cards, each one valid, with its own ID and name', () => {
    expect(baseFactoryCards).toHaveLength(12);
    for (const card of baseFactoryCards) expect(validateFactoryCard(card), card.name).toEqual([]);
    expect(new Set(baseFactoryCards.map((c) => c.id)).size).toBe(12);
    expect(new Set(baseFactoryCards.map((c) => c.name)).size).toBe(12);
  });
});
