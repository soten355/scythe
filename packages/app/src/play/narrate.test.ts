import { describe, expect, it } from 'vitest';
import { applyAction, newGame, type Action, type GameState } from '@scythe/engine';
import { planningBot, playMatch } from '@scythe/bots';
import { BUILT_IN } from '../content/catalog';
import { toSetup } from '../menu/setup';
import { botTurnsSince, paceOf, tellTurn, turnsOf } from './narrate';

// A two-player game between Easy bots, kept as one action per step, as the game screen keeps it.
const choice = { map: 'standard', players: [0, 1].map((i) => ({ faction: BUILT_IN.factions[i]!.id, mat: BUILT_IN.mats[i]!.id, bot: null })) };
const setup = toSetup(choice, BUILT_IN, 11);
const played = await playMatch(setup, [planningBot({ level: 'easy', seed: 1 }), planningBot({ level: 'easy', seed: 2 })], { maxActions: 1500 });
const steps: Action[][] = played.log.map((a) => [a]);
const history: GameState[] = [newGame(setup)];
for (const [a] of steps) history.push(applyAction(history[history.length - 1]!, a!));

describe("telling a bot's turn", () => {
  it('splits the game into turns, one per player in order', () => {
    const turns = turnsOf(history);
    expect(turns.length).toBeGreaterThan(20);
    expect(turns.slice(0, 4).map((t) => t.seat)).toEqual([0, 1, 0, 1]);
    // Every step is in exactly one turn.
    expect(turns.reduce((n, t) => n + t.end - t.start, 0)).toBe(steps.length);
  });

  it('says which section was chosen, what happened, and what it gained and spent', () => {
    const [first] = turnsOf(history);
    const lines = tellTurn(history, steps, first!);
    expect(lines[0]).toMatch(/^Chose /);
    expect(lines.every((l) => l.length > 0)).toBe(true);
    const all = turnsOf(history).flatMap((t) => tellTurn(history, steps, t));
    expect(all.some((l) => /^Moved /.test(l))).toBe(true);
    expect(all.some((l) => /^Produced on /.test(l))).toBe(true);
    expect(all.some((l) => /^Now: .*[+−]\d/.test(l))).toBe(true);
    // Every star placed is told.
    const stars = history[history.length - 1]!.players.reduce((n, p) => n + p.stars.length, 0);
    expect(all.filter((l) => l.startsWith('★')).length).toBe(stars);
  });

  it("collects the bots' turns since a person last ended theirs", () => {
    const bots = [null, 'easy' as const];
    const turns = turnsOf(history);
    // During the person's first turn: nothing yet.
    expect(botTurnsSince(history.slice(0, 2), steps.slice(0, 1), bots)).toEqual([]);
    // During the person's second turn: the bot's first turn.
    const second = turns[2]!;
    const now = botTurnsSince(history.slice(0, second.start + 2), steps.slice(0, second.start + 1), bots);
    expect(now.map((t) => t.seat)).toEqual([1]);
    expect(now[0]!.lines[0]).toMatch(/^Chose /);
    // During the bot's turn: its turn so far.
    const botTurn = turns[3]!;
    expect(botTurnsSince(history.slice(0, botTurn.start + 2), steps.slice(0, botTurn.start + 1), bots).map((t) => t.seat)).toEqual([1]);
    // No people: every turn is a bot's, all kept back to the start.
    expect(botTurnsSince(history.slice(0, second.start + 1), steps.slice(0, second.start), ['easy', 'easy']).map((t) => t.seat)).toEqual([0, 1]);
  });

  it('pauses on the moves worth watching, and hurries through the small steps', () => {
    expect(paceOf({ type: 'chooseSection', section: 0 })).toBe('watch');
    expect(paceOf({ type: 'moveUnit', unit: { kind: 'character' }, to: 'A1' })).toBe('watch');
    expect(paceOf({ type: 'pay', hex: 'A1' })).toBe('quick');
    expect(paceOf({ type: 'endTurn' })).toBe('quick');
  });
});
