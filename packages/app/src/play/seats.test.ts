import { describe, expect, it } from 'vitest';
import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import { newGame, nextSeat } from '@scythe/engine';
import { botName, inTurnOrder, isBot, needsPass, people } from './seats';

describe('who plays each seat', () => {
  it('a seat is a bot only if the game says so (older games: everyone is a person)', () => {
    expect(isBot([null, 'easy'], 1)).toBe(true);
    expect(isBot([null, 'easy'], 0)).toBe(false);
    expect(isBot(undefined, 1)).toBe(false);
    expect(people([null, 'easy', null], 3)).toEqual([0, 2]);
    expect(people(undefined, 2)).toEqual([0, 1]);
  });

  it('the board is hidden to pass the device only between different people', () => {
    // Pass-and-play: every change of person, and when a game opens.
    expect(needsPass(undefined, 2, 0, 1)).toBe(true);
    expect(needsPass(undefined, 2, null, 0)).toBe(true);
    expect(needsPass(undefined, 2, 1, 1)).toBe(false);
    // Never to a bot.
    expect(needsPass([null, 'hard'], 2, 0, 1)).toBe(false);
    // Solo: never (only one person has the device).
    expect(needsPass([null, 'hard'], 2, null, 0)).toBe(false);
    expect(needsPass(['hard', null, 'easy'], 3, null, 1)).toBe(false);
    // Two people and a bot: back to the other person after the bot's turn.
    expect(needsPass([null, 'medium', null], 3, 0, 2)).toBe(true);
    expect(needsPass([null, 'medium', null], 3, 0, 0)).toBe(false);
  });

  it('bots are named by their level', () => {
    expect(botName('hard')).toBe('Hard bot');
  });

  it('lists the seats in turn order: whoever goes first, then on round the table', () => {
    const mats = [...baseMats].sort((a, b) => b.turnOrder - a.turnOrder);
    const game = newGame({ seed: 3, board: baseBoard, turnOrder: 'map', players: baseFactions.slice(0, 4).map((faction, i) => ({ faction, mat: mats[i]! })) });
    const order = inTurnOrder(game);
    expect(order).toHaveLength(4);
    expect(new Set(order).size).toBe(4);
    // The first player (the lowest mat) leads, and each next seat is who plays after.
    expect(order[0]).toBe(game.currentPlayer);
    for (let i = 1; i < 4; i++) expect(order[i]).toBe(nextSeat(game, order[i - 1]!));
    // It stays the same as play goes round.
    expect(inTurnOrder({ ...game, currentPlayer: order[2]! })).toEqual(order);
  });
});
