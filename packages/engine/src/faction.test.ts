import { describe, expect, it } from 'vitest';
import { validateFaction, type Faction } from './faction';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

const faction: Faction = {
  id: 'test',
  name: 'Test',
  color: '#3366cc',
  homeBase: 'ne',
  power: 4,
  combatCards: 1,
  stars: 6,
  ability: { name: 'Sturdy', description: 'Something special.' },
  mechAbilities: [
    { name: 'A', description: '' },
    { name: 'B', description: '' },
    { name: 'C', description: '' },
    { name: 'D', description: '' },
  ],
  recruitBonuses: [
    { bonus: 'power', amount: 2 },
    { bonus: 'coins', amount: 2 },
    { bonus: 'popularity', amount: 2 },
    { bonus: 'combatCard', amount: 2 },
  ],
};

describe('factions', () => {
  it('accepts a well-formed faction, even before ability text is written', () => {
    expect(validateFaction(faction)).toEqual([]);
    const blank = clone(faction);
    blank.ability = { name: '', description: '' };
    expect(validateFaction(blank)).toEqual([]);
  });

  it('keeps starting power on the power track (0-16)', () => {
    const bad = clone(faction);
    bad.power = 17;
    expect(validateFaction(bad)).toContainEqual(expect.stringMatching(/starting power must be between 0 and 16/));
  });

  it('rejects negative or fractional numbers', () => {
    const bad = clone(faction);
    bad.combatCards = -1;
    bad.stars = 5.5;
    bad.recruitBonuses[0]!.amount = -2;
    const problems = validateFaction(bad);
    expect(problems).toContainEqual(expect.stringMatching(/combat cards must be a whole number/));
    expect(problems).toContainEqual(expect.stringMatching(/stars must be a whole number/));
    expect(problems).toContainEqual(expect.stringMatching(/recruit bonus 1 amount must be a whole number/));
  });

  it('needs a name, an ID and a home base', () => {
    const bad = clone(faction);
    bad.name = ' ';
    bad.id = '';
    bad.homeBase = '';
    expect(validateFaction(bad)).toEqual(['name is missing', 'ID is missing', 'home base is missing']);
  });
});
