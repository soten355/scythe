import { sampleEncounters } from '@scythe/content';
import { validateEncounterCard } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { setPath } from '../shared/editor-utils';
import { cleanCard, deckProblems, editable, newCard, nextId, toggleAction } from './model';

describe('the encounter card editor', () => {
  it('starts a card with three blank options', () => {
    const card = newCard('card-1');
    expect(card.options).toHaveLength(3);
    expect(validateEncounterCard(cleanCard(card))).toEqual(['option 1 has no text', 'option 2 has no text', 'option 3 has no text']);
  });

  it('numbers new cards after the ones there', () => {
    expect(nextId([])).toBe('card-1');
    expect(nextId([newCard('card-1'), newCard('card-3')])).toBe('card-4');
  });

  it('lets any amount be set by its path, even on a stored card', () => {
    let card = editable(sampleEncounters[2]!);
    card = setPath(card, 'options.0.gain.resources.oil', 2);
    card = setPath(card, 'options.1.cost.power', 1);
    expect(cleanCard(card).options[0].gain).toEqual({ popularity: 2, resources: { oil: 2 } });
    expect(cleanCard(card).options[1].cost).toEqual({ coins: 2, power: 1 });
  });

  it('turns free actions on and off, in the usual order', () => {
    let card = toggleAction(newCard('c'), 0, 'enlist', true);
    card = toggleAction(card, 0, 'upgrade', true);
    expect(card.options[0].gain.actions).toEqual(['upgrade', 'enlist']);
    expect(toggleAction(card, 0, 'upgrade', false).options[0].gain.actions).toEqual(['enlist']);
  });

  it('stores cards without blank or zero amounts', () => {
    let card = setPath(newCard(' c '), 'options.0.text', ' Help out. ');
    card = setPath(card, 'options.0.gain.coins', 0);
    card = setPath(card, 'options.0.gain.power', NaN);
    card = setPath(card, 'options.0.gain.resources.food', 0);
    expect(cleanCard(card).options[0]).toEqual({ text: 'Help out.', cost: {}, gain: {} });
    expect(cleanCard(card).id).toBe('c');
    // A stored card comes back the same.
    expect(cleanCard(editable(sampleEncounters[0]!))).toEqual(sampleEncounters[0]);
  });

  it('lists the deck’s problems by card, including a repeated ID', () => {
    const fine = sampleEncounters[0]!;
    expect(deckProblems([fine])).toEqual([]);
    expect(deckProblems([fine, { ...fine, name: 'Copy' }])).toEqual([`Copy: another card has the ID ${fine.id}`]);
    expect(deckProblems([{ ...newCard('x'), name: 'Blank' }])[0]).toBe('Blank: option 1 has no text');
  });
});
