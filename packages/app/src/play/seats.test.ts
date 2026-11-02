import { describe, expect, it } from 'vitest';
import { botName, isBot, needsPass, people } from './seats';

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
});
