// Starts the bots' background thread (bot.worker.ts) and connects to it.
// Seats from the client work like any other seat; their thinking happens in
// the worker, so the board stays responsive.
import { BotClient, type BotReply } from '@scythe/bots';

export function startBots(): { client: BotClient; stop: () => void } {
  const worker = new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' });
  const client = new BotClient((request) => worker.postMessage(request));
  worker.onmessage = (e: MessageEvent<BotReply>) => client.receive(e.data);
  return { client, stop: () => worker.terminate() };
}
