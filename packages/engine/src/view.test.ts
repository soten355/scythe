import { describe, expect, it } from 'vitest';
import { activeSeat, applyAction, isGameOver, legalActions, newGame, type GameState } from './game';
import { nextInt, seedRng } from './rng';
import { HIDDEN_CARD, HIDDEN_OBJECTIVE, playerView } from './view';
import type { ObjectiveCard } from './objectives';
import { testSetup } from './test-fixtures';

const objectives: ObjectiveCard[] = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6'].map((id, i) => ({ id, name: id, checks: [{ kind: 'stat', stat: 'coins', atLeast: 6 + i }] }));
const setup = { ...testSetup, objectives };

describe("a seat's view", () => {
  const start = newGame(setup);

  it("shows the other players' combat cards and objectives by number only", () => {
    const view = playerView(start, 0);
    expect(view.players[0]).toEqual(start.players[0]);
    expect(view.players[1]!.combatCards).toEqual(start.players[1]!.combatCards.map(() => HIDDEN_CARD));
    expect(view.players[1]!.objectives).toEqual(start.players[1]!.objectives.map(() => HIDDEN_OBJECTIVE));
  });

  it("shows the other players' completed objectives, which are revealed", () => {
    const id = start.players[1]!.objectives[0]!;
    const state: GameState = { ...start, players: start.players.map((p, i) => (i === 1 ? { ...p, objectivesDone: [id] } : p)) };
    expect(playerView(state, 0).players[1]!.objectives[0]).toBe(id);
  });

  it('hides the order of the decks and the random seed', () => {
    const view = playerView(start, 0);
    expect(view.rng).not.toBe(start.rng);
    expect(view.combatDeck).toHaveLength(start.combatDeck.length);
    expect(view.combatDeck).not.toEqual(start.combatDeck);
    expect([...view.objectiveDeck].sort()).toEqual([...start.objectiveDeck].sort());
    expect(view.objectiveDeck).toEqual([...view.objectiveDeck].sort());
  });

  it("hides the other side's cards and dial in a fight", () => {
    const fighting: GameState = {
      ...start,
      turn: {
        step: 'combat',
        section: 2,
        left: [],
        fight: { hex: 'B3', before: [], attacker: { seat: 0, cards: [5], power: 4 }, defender: { seat: 1, cards: [], power: null } },
      },
    };
    const view = playerView(fighting, 1);
    expect(view.turn).toMatchObject({ fight: { attacker: { seat: 0, cards: [HIDDEN_CARD], power: 0 }, defender: { seat: 1, cards: [], power: null } } });
    expect(playerView(fighting, 0).turn).toEqual(fighting.turn);
  });

  it('never changes what the seat itself may do (fuzz: random games)', () => {
    for (const seed of [1, 2, 3, 4]) {
      let state = newGame({ ...setup, seed });
      let rng = seedRng(seed);
      for (let i = 0; i < 1500 && !isGameOver(state); i++) {
        const seat = activeSeat(state);
        const options = legalActions(state, seat);
        expect(legalActions(playerView(state, seat), seat)).toEqual(options);
        let pick: number;
        [pick, rng] = nextInt(rng, options.length);
        state = applyAction(state, options[pick]!);
      }
    }
  });
});
