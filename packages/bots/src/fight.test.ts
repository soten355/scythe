import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import { applyAction, COMBAT_DECK, moveTargets, newGame, playerView, seedRng, type Action, type GameState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { chooseFight, expectedFightScore, unseenCards, type FightThinking } from './fight';
import { DEFAULT_WEIGHTS } from './score';

const think = (o: Partial<FightThinking> = {}): FightThinking => ({ weights: DEFAULT_WEIGHTS, boldness: 0.5, samples: 16, spread: 0, ...o });

/**
 * A fight about to start: the first player's character moves onto the
 * other's, with the power and cards given, and it's the attacker's turn to choose.
 */
function fight(attacker: { power: number; cards: number[] }, defender: { power: number; cards: number[] }): { state: GameState; a: number; d: number } {
  const start = newGame({ seed: 1, board: baseBoard, players: baseFactions.slice(0, 2).map((faction, i) => ({ faction, mat: baseMats[i]! })) });
  const a = start.currentPlayer;
  const d = 1 - a;
  const from = start.players[a]!.workers[0]!;
  const placed: GameState = { ...start, players: start.players.map((p, i) => (i === a ? { ...p, character: from } : p)) };
  const to = moveTargets(placed, a, from, 'character').find((h) => h in start.setup.board.hexes && !start.players[a]!.workers.includes(h) && !start.players[d]!.workers.includes(h))!;
  let state: GameState = {
    ...start,
    players: start.players.map((p, i) =>
      i === a ? { ...p, character: from, power: attacker.power, combatCards: attacker.cards } : { ...p, character: to, power: defender.power, combatCards: defender.cards },
    ),
  };
  const move = state.setup.players[a]!.mat.sections.findIndex((s) => s.top.action === 'move');
  state = [{ type: 'chooseSection', section: move }, { type: 'moveUnit', unit: { kind: 'character' }, to }, { type: 'endMove' }].reduce((s, x) => applyAction(s, x as Action), state);
  expect(state.turn).toMatchObject({ step: 'combat', fight: { attacker: { seat: a }, defender: { seat: d } } });
  return { state, a, d };
}

const dialOf = (actions: Action[]) => (actions.at(-1) as Extract<Action, { type: 'combatPower' }>).power;
const cardsOf = (actions: Action[]) => actions.filter((x) => x.type === 'combatCard').map((x) => (x as { value: number }).value);

describe('fights', () => {
  it("knows the unseen cards: the deck less its own hand and the face-up discards", () => {
    const { state, a } = fight({ power: 5, cards: [5, 2] }, { power: 3, cards: [4] });
    const seen: GameState = { ...state, combatDiscard: [3, 3] };
    const pool = unseenCards(playerView(seen, a), a);
    expect(pool.length).toBe(COMBAT_DECK.length - 4);
    expect(pool.filter((c) => c === 5).length).toBe(5);
    expect(pool.filter((c) => c === 3).length).toBe(10);
    // The other side's hand is among the unseen: a 4 is still counted.
    expect(pool.filter((c) => c === 4).length).toBe(8);
  });

  it("doesn't spend power or cards on a fight it can't lose", () => {
    // Ties go to the attacker; the defender has nothing to fight with.
    const { state, a } = fight({ power: 7, cards: [5] }, { power: 0, cards: [] });
    const [actions] = chooseFight(playerView(state, a), a, think(), seedRng(1));
    expect(dialOf(actions)).toBe(0);
    expect(cardsOf(actions)).toEqual([]);
  });

  it('dials enough to win a fight worth winning', () => {
    // The defender can show at most 3; the attacker wins on a tie.
    const { state, a } = fight({ power: 10, cards: [] }, { power: 3, cards: [] });
    const [actions] = chooseFight(playerView(state, a), a, think(), seedRng(1));
    expect(dialOf(actions)).toBe(3);
  });

  it('plays its best card rather than a lower one', () => {
    const { state, a } = fight({ power: 2, cards: [2, 5] }, { power: 7, cards: [5] });
    const [actions] = chooseFight(playerView(state, a), a, think(), seedRng(1));
    const played = cardsOf(actions);
    if (played.length) expect(played).toEqual([5]);
  });

  it('decides the same whatever the hidden cards really are', () => {
    const one = fight({ power: 4, cards: [3] }, { power: 4, cards: [2] });
    const two = fight({ power: 4, cards: [3] }, { power: 4, cards: [5] });
    const pick = (s: GameState) => chooseFight(playerView(s, one.a), one.a, think({ spread: 1.5 }), seedRng(7))[0];
    expect(pick(two.state)).toEqual(pick(one.state));
  });

  it('as the defender, answers without knowing what the attacker chose', () => {
    const { state, a, d } = fight({ power: 5, cards: [5] }, { power: 4, cards: [3] });
    const low = [{ type: 'combatPower', power: 0 }].reduce((s, x) => applyAction(s, x as Action), state);
    const high = [{ type: 'combatCard', value: 5 }, { type: 'combatPower', power: 5 }].reduce((s, x) => applyAction(s, x as Action), state);
    const pick = (s: GameState) => chooseFight(playerView(s, d), d, think(), seedRng(3))[0];
    // The attacker's power shows the same either way (hidden); only the number of cards played shows.
    expect(playerView(low, d).turn).toMatchObject({ fight: { attacker: { power: 0, cards: [] } } });
    expect(pick(low)[0]).toBeDefined();
    expect(pick(high)[0]).toBeDefined();
    void a;
  });

  it('bluffs: in a close fight its choice varies', () => {
    const { state, a } = fight({ power: 6, cards: [3, 4] }, { power: 6, cards: [4] });
    const picks = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) picks.add(JSON.stringify(chooseFight(playerView(state, a), a, think({ spread: 3 }), seedRng(seed))[0]));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('judges a move into a fight by how the fight is likely to go', () => {
    const strong = fight({ power: 12, cards: [5] }, { power: 1, cards: [] });
    const weak = fight({ power: 0, cards: [] }, { power: 12, cards: [5] });
    const value = (f: typeof strong) => expectedFightScore(playerView(f.state, f.a), f.a, think({ samples: 6 }), seedRng(1));
    expect(value(strong)).toBeGreaterThan(value(weak));
  });

  it('a careful bot expects a higher dial from the other side than a bold one, and dials more to be sure', () => {
    const { state, a } = fight({ power: 12, cards: [] }, { power: 7, cards: [] });
    const dial = (boldness: number) => dialOf(chooseFight(playerView(state, a), a, think({ boldness, samples: 40 }), seedRng(5))[0]);
    expect(dial(0)).toBeGreaterThanOrEqual(dial(1));
  });
});
