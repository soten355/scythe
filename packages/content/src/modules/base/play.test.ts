import { activeSeat, applyAction, isGameOver, legalActions, newGame, nextInt, seedRng, validateObjectiveCard, validateStructureBonus, score } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { baseBoard } from './board';
import { baseFactions } from './factions';
import { baseMats } from './mats';
import { sampleEncounters } from './encounters';
import { sampleFactoryCards } from './factory';
import { sampleObjectives } from './objectives';
import { sampleStructureBonuses } from './structure-bonuses';

describe('a game with the base content', () => {
  const setup = (seed: number) => ({
    seed,
    board: baseBoard,
    players: [
      { faction: baseFactions[0]!, mat: baseMats[0]! },
      { faction: baseFactions[1]!, mat: baseMats[1]! },
    ],
  });

  it('starts each faction with workers beside its home base', () => {
    const state = newGame(setup(1));
    expect(state.players[0]!.workers).toEqual(baseBoard.homeBases.ne);
    expect(state.players[1]!.workers).toEqual(baseBoard.homeBases.e);
  });

  it('plays random legal actions on the real board without errors', () => {
    for (let seed = 0; seed < 10; seed++) {
      let state = newGame(setup(seed));
      let rng = seedRng(seed);
      for (let step = 0; step < 300; step++) {
        const options = legalActions(state, state.currentPlayer);
        expect(options.length).toBeGreaterThan(0);
        let pick: number;
        [pick, rng] = nextInt(rng, options.length);
        state = applyAction(state, options[pick]!);
      }
    }
  });

  it('plays random legal games with encounters, the Factory, objectives and all five factions, keeping every count in bounds', () => {
    let encounters = 0;
    let factoryUsed = 0; // Factory cards taken or used
    let objectives = 0;
    for (let seed = 0; seed < 20; seed++) {
      let state = newGame({
        seed,
        board: baseBoard,
        encounters: sampleEncounters,
        factory: sampleFactoryCards,
        objectives: sampleObjectives,
        structureBonuses: sampleStructureBonuses,
        players: baseFactions.map((faction, i) => ({ faction, mat: baseMats[i]! })),
      });
      expect(state.encounterTokens).toHaveLength(11);
      let rng = seedRng(seed);
      for (let step = 0; step < 1500 && !isGameOver(state); step++) {
        const options = legalActions(state, activeSeat(state));
        expect(options.length).toBeGreaterThan(0);
        let pick: number;
        [pick, rng] = nextInt(rng, options.length);
        const tokens = state.encounterTokens.length;
        state = applyAction(state, options[pick]!);
        if (state.encounterTokens.length < tokens) encounters++;
        if (options[pick]!.type === 'takeFactoryCard' || options[pick]!.type === 'factoryUse') factoryUsed++;
        if (options[pick]!.type === 'completeObjective') objectives++;
        for (const p of state.players) {
          expect(Math.min(p.coins, p.power, p.popularity)).toBeGreaterThanOrEqual(0);
          expect(p.workers.length).toBeLessThanOrEqual(8);
        }
        expect(state.encounterDeck.length + state.encounterDiscard.length).toBeLessThanOrEqual(sampleEncounters.length);
        // Every Factory card is in the deck or with one player.
        const held = state.players.flatMap((p) => (p.factoryCard ? [p.factoryCard] : []));
        expect([...state.factoryDeck, ...held].sort()).toEqual(sampleFactoryCards.map((c) => c.id).sort());
        // Objective cards are all dealt or in the deck; one objective star each, except with Dominate.
        expect([...state.objectiveDeck, ...state.players.flatMap((p) => p.objectives)].sort()).toEqual(sampleObjectives.map((c) => c.id).sort());
        state.players.forEach((p, seat) => {
          const limit = baseFactions[seat]!.ability.rule?.kind === 'unlimitedCombatStars' ? 2 : 1;
          expect(p.stars.filter((s) => s === 'objective').length).toBeLessThanOrEqual(limit);
          for (const id of p.objectivesDone ?? []) expect(p.objectives).toContain(id);
        });
      }
      // A tile was drawn, and every final score adds up.
      expect(state.structureBonus).toBeDefined();
      for (const s of score(state)) expect(s.total).toBe(s.coins + s.stars.coins + s.territories.coins + s.resources.coins + s.structureBonus.coins);
    }
    expect(encounters).toBeGreaterThan(0);
    expect(factoryUsed).toBeGreaterThan(0);
    expect(objectives).toBeGreaterThan(0);
  }, 30_000);
});

describe('the sample encounter deck', () => {
  it('has a unique ID and three options for every card', () => {
    expect(new Set(sampleEncounters.map((c) => c.id)).size).toBe(sampleEncounters.length);
    for (const c of sampleEncounters) expect(c.options, c.id).toHaveLength(3);
  });
});

describe('the sample objective deck', () => {
  it('has a unique ID for every card, and every card is complete', () => {
    expect(new Set(sampleObjectives.map((c) => c.id)).size).toBe(sampleObjectives.length);
    for (const c of sampleObjectives) expect(validateObjectiveCard(c), c.id).toEqual([]);
  });
});

describe('the sample structure bonus tiles', () => {
  it('has a unique ID for every tile, and every tile is complete', () => {
    expect(new Set(sampleStructureBonuses.map((t) => t.id)).size).toBe(sampleStructureBonuses.length);
    for (const t of sampleStructureBonuses) expect(validateStructureBonus(t), t.id).toEqual([]);
  });
});
