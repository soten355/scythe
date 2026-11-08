import { baseBoard, baseFactions, baseMats, sampleObjectives } from '@scythe/content';
import { newGame, type AbilityRule, type GameState, type ObjectiveCard } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { checkText, objectiveStatus, objectiveText } from './objective-text';

describe('objective conditions in words', () => {
  it('words each kind of condition', () => {
    expect(checkText({ kind: 'stat', stat: 'coins', atLeast: 14 })).toBe('at least 14 coins');
    expect(checkText({ kind: 'stat', stat: 'combatCards', atLeast: 1 })).toBe('at least 1 combat card');
    expect(checkText({ kind: 'stat', stat: 'power', atMost: 0 })).toBe('no power');
    expect(checkText({ kind: 'stat', stat: 'popularity', atLeast: 3, atMost: 6 })).toBe('3 to 6 popularity');
    expect(checkText({ kind: 'resources', resources: ['oil'], atLeast: 5 })).toBe('at least 5 oil on territories you control');
    expect(checkText({ kind: 'resources', atMost: 2 })).toBe('at most 2 resources on territories you control');
    expect(checkText({ kind: 'resources', resources: ['oil', 'wood'], atLeast: 4, atMost: 4 })).toBe('exactly 4 oil and wood on territories you control');
    expect(checkText({ kind: 'eachResource', resources: ['wood', 'metal'], atLeast: 3 })).toBe('at least 3 each of wood and metal on territories you control');
    expect(checkText({ kind: 'units', unit: 'worker', terrain: 'farm', atLeast: 3 })).toBe('at least 3 workers on farms');
    expect(checkText({ kind: 'units', unit: 'character', terrain: 'factory', atLeast: 1 })).toBe('your character on the Factory');
    expect(checkText({ kind: 'units', unit: 'mech', atMost: 0 })).toBe('no mechs on the map');
    expect(checkText({ kind: 'territories', atLeast: 10 })).toBe('at least 10 territories (the Factory counts as 3)');
    expect(checkText({ kind: 'territories', terrain: 'mountain', atLeast: 2 })).toBe('at least 2 mountain territories');
    expect(checkText({ kind: 'progress', what: 'structures', atLeast: 2 })).toBe('at least 2 structures built');
    expect(checkText({ kind: 'progress', what: 'mechs', atMost: 0 })).toBe('no mechs deployed');
  });

  it('words the conditions added for the full deck', () => {
    expect(checkText({ kind: 'progress', what: 'factoryCards', atLeast: 1 })).toBe('a Factory card');
    expect(checkText({ kind: 'progress', what: 'factoryCards', atMost: 0 })).toBe('no Factory card');
    expect(checkText({ kind: 'progress', what: 'fightsWon', atLeast: 1 })).toBe('at least 1 fight won');
    expect(checkText({ kind: 'territories', tunnel: true, atLeast: 3 })).toBe('at least 3 tunnel territories');
    expect(checkText({ kind: 'resources', oneKind: true, atLeast: 9 })).toBe('at least 9 of one kind of resource on territories you control');
    expect(checkText({ kind: 'around', terrain: 'lake', atLeast: 5 })).toBe('at least 5 territories around the same lake');
    expect(checkText({ kind: 'around', terrain: 'factory', atLeast: 2 })).toBe('at least 2 territories next to the Factory');
    expect(checkText({ kind: 'same', what: ['workers', 'recruits'] })).toBe('as many workers as recruits enlisted');
    expect(checkText({ kind: 'highest', stat: 'power' })).toBe('the most power of any player (ties count)');
    expect(checkText({ kind: 'thisTurn', what: 'workersSentHome', atLeast: 1 })).toBe('at least 1 enemy worker sent home this turn');
    expect(
      checkText({
        kind: 'oneTerritory',
        checks: [
          { kind: 'units', unit: 'character', atLeast: 1 },
          { kind: 'units', unit: 'mech', atLeast: 1, atMost: 1 },
          { kind: 'resources', atLeast: 5 },
        ],
      }),
    ).toBe('one territory you control with your character, exactly 1 mech and at least 5 resources');
    expect(checkText({ kind: 'oneTerritory', checks: [{ kind: 'tokens', atLeast: 6 }, { kind: 'eachResource', resources: ['oil', 'food'], atLeast: 1 }] })).toBe(
      'one territory you control with at least 6 of your tokens (character, mechs, workers, structures) and at least 1 each of oil and food',
    );
  });

  it('words a whole card, saying when it ends your turn', () => {
    const quiet: ObjectiveCard = { id: 'q', name: 'Quiet', endOfTurn: true, checks: [{ kind: 'stat', stat: 'power', atMost: 0 }, { kind: 'stat', stat: 'coins', atLeast: 5 }] };
    expect(objectiveText(quiet)).toBe('At the end of your turn: no power and at least 5 coins');
    expect(objectiveText(sampleObjectives[0]!)).toBe('At least 14 coins and at least 7 popularity');
  });
});

describe("a player's objective cards", () => {
  const cards: ObjectiveCard[] = [
    { id: 'a', name: 'Rich', checks: [{ kind: 'stat', stat: 'coins', atLeast: 5 }] },
    { id: 'b', name: 'Poor', checks: [{ kind: 'stat', stat: 'coins', atMost: 0 }] },
  ];
  const game = (p: Partial<GameState['players'][0]>, rule?: AbilityRule) => {
    const state = newGame({ seed: 1, board: baseBoard, objectives: cards, players: [0, 1].map((i) => ({ faction: { ...baseFactions[i]!, ...(rule && { ability: { ...baseFactions[i]!.ability, rule } }) }, mat: baseMats[i]! })) });
    return { ...state, players: state.players.map((x, i) => (i === 0 ? { ...x, objectives: ['a', 'b'], ...p } : x)) };
  };

  it('says which can be completed, which not yet, and which are done', () => {
    expect(objectiveStatus(game({ coins: 5 }), 0).map((o) => [o.name, o.status])).toEqual([['Rich', 'ready'], ['Poor', 'notYet']]);
    expect(objectiveStatus(game({ coins: 0, objectivesDone: ['a'] }), 0).map((o) => o.status)).toEqual(['done', 'closed']);
    expect(objectiveStatus(game({ coins: 0, objectivesDone: ['a'] }, { kind: 'unlimitedCombatStars' }), 0).map((o) => o.status)).toEqual(['done', 'ready']);
    expect(objectiveStatus(game({ coins: 5 }), 0)[0]!.text).toBe('At least 5 coins');
  });
});
