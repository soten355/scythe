import { describe, expect, it } from 'vitest';
import { baseBoard } from './board';
import { baseFactions } from './factions';

describe('base factions', () => {
  it('each sits on a different home base that exists on the board', () => {
    const homes = baseFactions.map((f) => f.homeBase);
    expect(new Set(homes).size).toBe(homes.length);
    for (const home of homes) expect(baseBoard.homeBasePositions[home]).toBeDefined();
  });

  it('has the confirmed starting power and combat cards', () => {
    const byId = Object.fromEntries(baseFactions.map((f) => [f.id, f]));
    expect(byId.nordic).toMatchObject({ homeBase: 'ne', power: 4, combatCards: 1 });
    expect(byId.rusviet).toMatchObject({ homeBase: 'e', power: 3, combatCards: 2 });
  });
});
