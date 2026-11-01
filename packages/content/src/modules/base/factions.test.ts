import { validateFaction } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { baseBoard } from './board';
import { baseFactions } from './factions';

describe('base factions', () => {
  it('each sits on a different home base that exists on the board', () => {
    const homes = baseFactions.map((f) => f.homeBase);
    expect(new Set(homes).size).toBe(homes.length);
    for (const home of homes) expect(baseBoard.homeBasePositions[home]).toBeDefined();
  });

  it('are all valid factions with unique IDs', () => {
    for (const f of baseFactions) expect(validateFaction(f), f.name).toEqual([]);
    expect(new Set(baseFactions.map((f) => f.id)).size).toBe(baseFactions.length);
  });

  it('has the confirmed starting power and combat cards', () => {
    const byId = Object.fromEntries(baseFactions.map((f) => [f.id, f]));
    expect(byId.nordic).toMatchObject({ homeBase: 'ne', power: 4, combatCards: 1 });
    expect(byId.rusviet).toMatchObject({ homeBase: 'e', power: 3, combatCards: 2 });
    expect(byId.polonia).toMatchObject({ homeBase: 'w', power: 2, combatCards: 3 });
    expect(byId.crimea).toMatchObject({ homeBase: 'nw', power: 5, combatCards: 0 });
    expect(byId.saxony).toMatchObject({ homeBase: 'sw', power: 1, combatCards: 4 });
  });

  it('has a named faction ability and four named mech abilities each', () => {
    for (const f of baseFactions) {
      expect(f.ability.name, f.name).not.toBe('');
      expect(f.mechAbilities.map((m) => m.name).filter(Boolean), f.name).toHaveLength(4);
    }
  });

  /** Abilities still waiting on a part of the rules that isn't built yet. */
  const WAITING = ['Meander', 'Coercion', 'Wayfare'];

  it('gives every ability a rule the engine plays (except those still waiting)', () => {
    for (const f of baseFactions) {
      for (const a of [f.ability, ...f.mechAbilities]) {
        if (WAITING.includes(a.name)) expect(a.rule, `${f.name}: ${a.name} has a rule now: take it off the waiting list`).toBeUndefined();
        else expect(a.rule, `${f.name}: ${a.name}`).toBeDefined();
      }
    }
  });
});
