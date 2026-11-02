import { sampleObjectives } from '@scythe/content';
import { validateObjectiveCard } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { setPath } from '../shared/editor-utils';
import { addCheck, cleanCard, deckProblems, editable, newCard, nextId, removeCheck, setKind, toggleResource } from './model';

describe('the objective card editor', () => {
  it('starts a card with one condition to fill in', () => {
    const card = newCard('objective-1');
    expect(card.checks).toHaveLength(1);
    expect(validateObjectiveCard(cleanCard(card))).toEqual(['condition 1 needs an "at least" or "at most"']);
  });

  it('numbers new cards after the ones there', () => {
    expect(nextId([])).toBe('objective-1');
    expect(nextId([newCard('objective-1'), newCard('objective-3')])).toBe('objective-4');
  });

  it('adds, removes and changes the kind of conditions', () => {
    let card = addCheck(newCard('c'));
    expect(card.checks).toHaveLength(2);
    card = setKind(card, 1, 'units');
    expect(card.checks[1]).toEqual({ kind: 'units', unit: 'worker' });
    card = setKind(card, 1, 'eachResource');
    expect(card.checks[1]).toEqual({ kind: 'eachResource', resources: [] });
    expect(removeCheck(card, 0).checks).toEqual([{ kind: 'eachResource', resources: [] }]);
    // The last condition can't be removed.
    expect(removeCheck(removeCheck(card, 0), 0).checks).toHaveLength(1);
  });

  it('turns kinds of resources on and off, in the usual order', () => {
    let card = setKind(newCard('c'), 0, 'resources');
    card = toggleResource(card, 0, 'food', true);
    card = toggleResource(card, 0, 'oil', true);
    expect(card.checks[0]).toMatchObject({ resources: ['oil', 'food'] });
    expect(toggleResource(card, 0, 'oil', false).checks[0]).toMatchObject({ resources: ['food'] });
  });

  it('stores cards without blank amounts, an empty story or an unticked end-of-turn box', () => {
    let card = setPath(newCard(' c '), 'name', ' Hoard ');
    card = setPath(card, 'checks.0.atLeast', 5);
    card = setPath(card, 'checks.0.atMost', null);
    card = setPath(card, 'endOfTurn', false);
    expect(cleanCard(card)).toEqual({ id: 'c', name: 'Hoard', checks: [{ kind: 'stat', stat: 'coins', atLeast: 5 }] });
    // "At most 0" is kept: it means none.
    expect(cleanCard(setPath(card, 'checks.0.atMost', 0)).checks[0]).toMatchObject({ atMost: 0 });
    // A stored card comes back the same.
    for (const c of sampleObjectives) expect(cleanCard(editable(c))).toEqual(c);
  });

  it('lists the deck’s problems by card, including a repeated ID', () => {
    const fine = sampleObjectives[0]!;
    expect(deckProblems([fine])).toEqual([]);
    expect(deckProblems([fine, { ...fine, name: 'Copy' }])).toEqual([`Copy: another card has the ID ${fine.id}`]);
  });
});
