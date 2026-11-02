// The background thread bots think in: it runs the bot host from
// @scythe/bots and answers each request the game sends (see client.ts).
import { botHost, type BotRequest } from '@scythe/bots';

const host = botHost();
const scope = self as unknown as { onmessage: ((e: MessageEvent<BotRequest>) => void) | null; postMessage: (message: unknown) => void };
scope.onmessage = async (e) => scope.postMessage(await host(e.data));
