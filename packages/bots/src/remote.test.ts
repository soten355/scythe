import { baseBoard, baseFactions, baseMats, sampleEncounters, sampleFactoryCards, sampleObjectives, sampleStructureBonuses } from '@scythe/content';
import { newGame, playerView, legalActions, type GameSetup } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { planningBot } from './bot';
import { playMatch } from './match';
import { botHost, BotClient, type BotReply, type BotRequest } from './remote';

const setup: GameSetup = {
  seed: 3,
  board: baseBoard,
  players: baseFactions.slice(0, 2).map((faction, i) => ({ faction, mat: baseMats[i]! })),
  encounters: sampleEncounters,
  factory: sampleFactoryCards,
  objectives: sampleObjectives,
  structureBonuses: sampleStructureBonuses,
};

/** A client wired to a host as a worker would be: every message copied, as posting a message copies it. */
function channel(): BotClient {
  const host = botHost();
  const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  const client: BotClient = new BotClient((request: BotRequest) => {
    void host(copy(request)).then((reply: BotReply) => client.receive(copy(reply)));
  });
  return client;
}

describe('bots in a worker', () => {
  it('play the same game as bots on the main thread', async () => {
    const client = channel();
    const remote = await playMatch(setup, [client.seat('a', { level: 'easy', seed: 1 }), client.seat('b', { level: 'easy', seed: 2 })]);
    const local = await playMatch(setup, [planningBot({ level: 'easy', seed: 1 }), planningBot({ level: 'easy', seed: 2 })]);
    expect(remote.finished).toBe(true);
    expect(remote.log).toEqual(local.log);
  }, 120_000);

  it('report how long each decision took', async () => {
    const seat = channel().seat('a', { level: 'easy' });
    const state = newGame(setup);
    const s = state.currentPlayer;
    await seat.chooseAction(playerView(state, s), legalActions(state, s));
    expect(seat.lastMs).toBeGreaterThanOrEqual(0);
  });

  it("pass a bot's error back to the game", async () => {
    const seat = channel().seat('a');
    // Not a game state at all.
    await expect(seat.chooseAction({} as never, [{ type: 'endTurn' }, { type: 'skipTop' }])).rejects.toThrow(/bot a/);
  });

  it('forget a bot when asked, starting it afresh next time', async () => {
    const host = botHost();
    const reply = await host({ id: 1, kind: 'dispose', bot: 'a' });
    expect(reply).toEqual({ id: 1, done: true });
  });
});
