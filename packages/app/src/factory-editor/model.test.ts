import { sampleFactoryCards } from '@scythe/content';
import { validateFactoryCard } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { setPath } from '../shared/editor-utils';
import { cleanCard, deckProblems, editable, newCard, nextId, toggleAction } from './model';

describe('the Factory card editor', () => {
  it('starts a card that only needs a name and its effects', () => {
    const card = newCard('factory-1');
    expect(validateFactoryCard(cleanCard(card))).toEqual([]);
    expect(card.move).toEqual({ units: 1, hexes: 1 });
  });

  it('numbers new cards after the ones there', () => {
    expect(nextId([])).toBe('factory-1');
    expect(nextId([newCard('factory-1'), newCard('factory-3')])).toBe('factory-4');
  });

  it('lets any amount be set by its path, even on a stored card', () => {
    let card = editable(sampleFactoryCards[0]!);
    card = setPath(card, 'cost.resources.oil', 2);
    card = setPath(card, 'gain.popularity', 1);
    card = setPath(card, 'move.hexes', 3);
    expect(cleanCard(card)).toMatchObject({ cost: { power: 2, resources: { oil: 2 } }, gain: { coins: 3, popularity: 1 }, move: { units: 1, hexes: 3 } });
  });

  it('turns free actions on and off, in the usual order', () => {
    let card = toggleAction(newCard('c'), 'enlist', true);
    card = toggleAction(card, 'upgrade', true);
    expect(card.gain.actions).toEqual(['upgrade', 'enlist']);
    expect(toggleAction(card, 'upgrade', false).gain.actions).toEqual(['enlist']);
  });

  it('stores cards without blank or zero amounts, and a stored card comes back the same', () => {
    let card = setPath(newCard(' c '), 'name', ' Gears ');
    card = setPath(card, 'cost.coins', 0);
    card = setPath(card, 'gain.power', NaN);
    card = setPath(card, 'cost.resources.food', 0);
    expect(cleanCard(card)).toEqual({ id: 'c', name: 'Gears', cost: {}, gain: {}, move: { units: 1, hexes: 1 } });
    for (const c of sampleFactoryCards) expect(cleanCard(editable(c))).toEqual(c);
  });

  it('keeps a produce reward, and drops it when blank', () => {
    let card = setPath(newCard('c'), 'gain.produce', 2);
    expect(cleanCard(card).gain).toEqual({ produce: 2 });
    card = setPath(card, 'gain.produce', null);
    expect(cleanCard(card).gain).toEqual({});
  });

  it('keeps a blank move blank, so the check catches it', () => {
    const card = cleanCard(setPath(newCard('c'), 'move.units', null));
    expect(validateFactoryCard(card)).toEqual(['its move must be at least 1 unit, at least 1 hex']);
  });

  it('lists the deck’s problems by card, including a repeated ID', () => {
    const fine = sampleFactoryCards[0]!;
    expect(deckProblems([fine])).toEqual([]);
    expect(deckProblems([fine, { ...fine, name: 'Copy' }])).toEqual([`Copy: another card has the ID ${fine.id}`]);
    expect(deckProblems([{ ...newCard('x'), name: '' }])).toEqual(['x: name is missing']);
  });
});
