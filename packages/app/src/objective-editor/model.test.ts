import { sampleObjectives } from '@scythe/content';
import { validateObjectiveCard } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { setPath } from '../shared/editor-utils';
import { addCheck, addPart, cleanCard, deckProblems, editable, newCard, nextId, removeCheck, removePart, setKind, setPartKind, toggleResource } from './model';

describe('the objective card editor: the conditions for the full deck', () => {
  it('starts each new kind of condition with its choices made and its amounts blank', () => {
    const card = newCard('c');
    expect(setKind(card, 0, 'around').checks[0]).toEqual({ kind: 'around', terrain: 'lake' });
    expect(setKind(card, 0, 'same').checks[0]).toEqual({ kind: 'same', what: ['workers', 'recruits'] });
    expect(setKind(card, 0, 'highest').checks[0]).toEqual({ kind: 'highest', stat: 'power' });
    expect(setKind(card, 0, 'thisTurn').checks[0]).toEqual({ kind: 'thisTurn', what: 'workersSentHome' });
    expect(setKind(card, 0, 'oneTerritory').checks[0]).toEqual({ kind: 'oneTerritory', checks: [{ kind: 'units', unit: 'worker' }] });
    // Comparing or ranking needs no amounts, so it's ready at once.
    expect(validateObjectiveCard(cleanCard(setKind(card, 0, 'same')))).toEqual([]);
    expect(validateObjectiveCard(cleanCard(setKind(card, 0, 'highest')))).toEqual([]);
  });

  it('adds, removes and changes the parts of a one-territory condition', () => {
    let card = setKind(newCard('c'), 0, 'oneTerritory');
    card = addPart(card, 0);
    card = setPartKind(card, 0, 1, 'resources');
    expect(card.checks[0]).toEqual({ kind: 'oneTerritory', checks: [{ kind: 'units', unit: 'worker' }, { kind: 'resources', resources: [] }] });
    card = toggleResource(card, 0, 'oil', true, 1);
    expect(card.checks[0]).toMatchObject({ checks: [{}, { resources: ['oil'] }] });
    card = setPath(card, 'checks.0.checks.0.atLeast', 1);
    card = setPath(card, 'checks.0.checks.1.atLeast', 5);
    card = setPath(card, 'checks.0.checks.1.atMost', null);
    expect(cleanCard(card).checks[0]).toEqual({ kind: 'oneTerritory', checks: [{ kind: 'units', unit: 'worker', atLeast: 1 }, { kind: 'resources', resources: ['oil'], atLeast: 5 }] });
    expect(validateObjectiveCard(cleanCard(card))).toEqual([]);
    expect(removePart(card, 0, 0).checks[0]).toMatchObject({ checks: [{ kind: 'resources' }] });
    // The last part can't be removed.
    expect(removePart(removePart(card, 0, 0), 0, 0).checks[0]).toMatchObject({ checks: [{ kind: 'resources' }] });
  });

  it('leaves out ticks that are off when it stores a card', () => {
    const card = { ...newCard('c'), checks: [{ kind: 'territories', tunnel: false, atLeast: 3 }, { kind: 'resources', oneKind: false, resources: [], atLeast: 9 }] } as never;
    expect(cleanCard(card).checks).toEqual([{ kind: 'territories', atLeast: 3 }, { kind: 'resources', atLeast: 9 }]);
  });
});

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
