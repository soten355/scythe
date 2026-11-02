// Bots in a background thread (a Web Worker), so the board never freezes
// while they think. The worker runs a host; the app talks to it through a
// client, which hands out seats that work like any other. Messages are
// plain data (the game state is JSON), so this runs the same over a real
// worker or, in tests, a direct call.
//
// Each bot is created in the worker the first time it's asked for a move
// and kept there (it remembers its plan and its randomness), by name.
import type { Action, GameState, Seat } from '@scythe/engine';
import { planningBot, type BotOptions } from './bot';

/** Bot options that can be sent to a worker: plain data (the bot there keeps its own clock). */
export type RemoteBotOptions = Omit<BotOptions, 'clock'>;

export type BotRequest =
  | { id: number; kind: 'choose'; bot: string; options: RemoteBotOptions; view: GameState; legal: Action[] }
  | { id: number; kind: 'dispose'; bot: string };

export type BotReply = { id: number; action: Action; ms: number } | { id: number; done: true } | { id: number; error: string };

/** The worker's side: answers requests, keeping each bot by name. */
export function botHost(clock: () => number = () => performance.now()): (request: BotRequest) => Promise<BotReply> {
  const bots = new Map<string, Seat>();
  return async (request) => {
    try {
      if (request.kind === 'dispose') {
        bots.delete(request.bot);
        return { id: request.id, done: true };
      }
      let bot = bots.get(request.bot);
      if (!bot) {
        bot = planningBot(request.options);
        bots.set(request.bot, bot);
      }
      const start = clock();
      const action = await bot.chooseAction(request.view, request.legal);
      return { id: request.id, action, ms: clock() - start };
    } catch (e) {
      return { id: request.id, error: e instanceof Error ? e.message : String(e) };
    }
  };
}

/** A seat played by a bot in the worker, and a way to let the worker forget it. */
export interface RemoteSeat extends Seat {
  dispose(): void;
  /** How long its last decision took, in milliseconds (thinking only, not messaging). */
  lastMs: number;
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** The app's side: sends requests to the worker and matches up the replies. */
export class BotClient {
  private next = 1;
  private waiting = new Map<number, { resolve: (r: BotReply) => void }>();

  constructor(private readonly post: (request: BotRequest) => void) {}

  /** Call with every message the worker sends back. */
  receive(reply: BotReply): void {
    const w = this.waiting.get(reply.id);
    if (!w) return;
    this.waiting.delete(reply.id);
    w.resolve(reply);
  }

  private ask(request: DistributiveOmit<BotRequest, 'id'>): Promise<BotReply> {
    const id = this.next++;
    return new Promise((resolve) => {
      this.waiting.set(id, { resolve });
      this.post({ ...request, id } as BotRequest);
    });
  }

  /** A seat for the bot called `name` (one per player), made with `options` in the worker. */
  seat(name: string, options: RemoteBotOptions = {}): RemoteSeat {
    const seat: RemoteSeat = {
      lastMs: 0,
      chooseAction: async (view, legal) => {
        const reply = await this.ask({ kind: 'choose', bot: name, options, view, legal });
        if ('error' in reply) throw new Error(`bot ${name}: ${reply.error}`);
        if (!('action' in reply)) throw new Error(`bot ${name}: no action`);
        seat.lastMs = reply.ms;
        return reply.action;
      },
      dispose: () => void this.ask({ kind: 'dispose', bot: name }),
    };
    return seat;
  }
}
