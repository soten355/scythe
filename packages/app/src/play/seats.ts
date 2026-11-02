// Who plays each seat: a person or a bot. In a game with more than one
// person the device is passed between them, with the board hidden; bots
// never need it, and a solo player keeps it throughout.
import type { Level } from '@scythe/bots';

/** Each seat's bot level, or null for a person; none: everyone is a person. */
export type Bots = (Level | null)[] | undefined;

export const isBot = (bots: Bots, seat: number) => Boolean(bots?.[seat]);

/** The seats played by people. */
export const people = (bots: Bots, players: number) => Array.from({ length: players }, (_, i) => i).filter((i) => !isBot(bots, i));

/** Whether play reaching `to` needs the pass screen, `viewer` being the person who last had the device (null when the game opens). */
export const needsPass = (bots: Bots, players: number, viewer: number | null, to: number) =>
  !isBot(bots, to) && to !== viewer && people(bots, players).length > 1;

const LEVEL_NAMES: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const botName = (level: Level) => `${LEVEL_NAMES[level]} bot`;
