import { describe, expect, it } from 'vitest';
import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import type { PlayerMat } from '@scythe/engine';
import { BUILT_IN } from '../content/catalog';
import { catalogWith, EMPTY_LIBRARY } from '../content/library';
import { CODEX_TABS, codexList, encounterFacts, factionFacts, factoryFacts, matFacts, objectiveFacts, tileFacts } from './codex';

const mat: PlayerMat = {
  id: 'm',
  name: 'Test',
  turnOrder: 3,
  popularity: 2,
  coins: 5,
  objectiveCards: 2,
  sections: [
    { top: { action: 'move', units: { base: 2, upgraded: 3 }, coins: { base: 1, upgraded: 1 }, structure: 'mine' }, bottom: { action: 'upgrade', cost: 3, upgradeSpaces: 2, coins: 1, recruitBonus: 'power' } },
    { top: { action: 'trade', cost: 1, resources: 2, popularity: { base: 1, upgraded: 2 }, structure: 'armory' }, bottom: { action: 'deploy', cost: 4, upgradeSpaces: 1, coins: 0, recruitBonus: 'coins' } },
    { top: { action: 'produce', hexes: { base: 2, upgraded: 3 }, structure: 'mill' }, bottom: { action: 'build', cost: 3, upgradeSpaces: 1, coins: 2, recruitBonus: 'popularity' } },
    { top: { action: 'bolster', cost: 1, power: { base: 2, upgraded: 3 }, combatCards: { base: 1, upgraded: 2 }, structure: 'monument' }, bottom: { action: 'enlist', cost: 3, upgradeSpaces: 2, coins: 3, recruitBonus: 'combatCard' } },
  ],
};

describe('the codex', () => {
  it('has a tab for factions, mats, and each deck and the tiles', () => {
    expect(CODEX_TABS.map((t) => t.kind)).toEqual(['factions', 'mats', 'encounters', 'factory', 'objectives', 'structureBonuses']);
  });

  it('lists what new games use, and says when a deck is the made-up sample', () => {
    const catalog = catalogWith(BUILT_IN, EMPTY_LIBRARY);
    const factions = codexList(catalog, BUILT_IN, 'factions');
    expect(factions.items.map((i) => i.name)).toEqual(baseFactions.map((f) => f.name));
    expect(factions.sample).toBe(false);
    expect(codexList(catalog, BUILT_IN, 'encounters').sample).toBe(true);
    // Your own deck, once added, replaces the sample.
    const mine = { ...BUILT_IN.encounters![0]!, id: 'mine-1', name: 'Mine' };
    const withMine = catalogWith(BUILT_IN, { ...EMPTY_LIBRARY, encounters: [mine] });
    expect(codexList(withMine, BUILT_IN, 'encounters')).toEqual({ items: [{ id: 'mine-1', name: 'Mine' }], sample: false });
    // Mats in turn order.
    expect(codexList(catalog, BUILT_IN, 'mats').items.map((i) => i.id)).toEqual([...baseMats].sort((a, b) => a.turnOrder - b.turnOrder).map((m) => m.id));
  });

  it("tells a faction's start, abilities and recruit bonuses, and the land by its home base", () => {
    const f = baseFactions[0]!;
    const facts = factionFacts(f, baseBoard);
    expect(facts.start).toEqual([`${f.power} power`, `${f.combatCards} combat card${f.combatCards === 1 ? '' : 's'}`, `${f.stars} stars to place`]);
    expect(facts.mechAbilities).toHaveLength(4);
    expect(facts.recruits).toHaveLength(4);
    const next = baseBoard.homeBases[f.homeBase]![0]!;
    expect(facts.terrain).toBe(baseBoard.hexes[next]!.terrain);
  });

  it("tells a mat's start and each section's two actions, with what upgrades improve", () => {
    const facts = matFacts(mat);
    expect(facts.title).toBe('Test');
    expect(facts.start).toEqual(['goes 3rd', '2 popularity', '5 coins', '2 objective cards']);
    expect(facts.sections[0]).toEqual({
      top: 'Move',
      topLines: ['2 units (3 upgraded)', '+1 coin'],
      structure: 'Mine',
      bottom: 'Upgrade',
      bottomLines: ['pay 3 oil (down to 1 with upgrades)', 'get 1 coin'],
      recruit: 'power',
    });
    expect(facts.sections[1]!.topLines).toEqual(['pay 1 coin', '2 resources, or 1 popularity (2 upgraded)']);
    expect(facts.sections[3]!.topLines).toEqual(['pay 1 coin', '2 power (3 upgraded), or 1 combat card (2 upgraded)']);
    expect(facts.sections[3]!.recruit).toBe('combat card');
  });

  it('tells encounter options, Factory cards, objectives and tiles in the words the game uses', () => {
    const card = BUILT_IN.encounters![0]!;
    expect(encounterFacts(card).options).toHaveLength(3);
    expect(encounterFacts(card).options[0]!.cost).toMatch(/^(Free|Pay|Lose)/);
    const factory = factoryFacts(BUILT_IN.factory![0]!);
    expect(factory.move).toMatch(/^Move \d+ unit/);
    expect(factory.top).toContain('→');
    const objective = objectiveFacts(BUILT_IN.objectives![0]!);
    expect(objective.text.length).toBeGreaterThan(0);
    const tile = tileFacts(BUILT_IN.structureBonuses![0]!);
    expect(tile.pays.length).toBeGreaterThan(0);
    expect(tile.pays[0]).toMatch(/^\d+\+ → \d+ coins?$/);
  });
});
