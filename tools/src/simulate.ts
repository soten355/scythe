// Simulation runner (Node): plays whole games between planning bots and
// random players on the real board, with the base factions and mats (and the
// sample decks), and reports who wins.
//
//   npm run sim -- --games 10 --players 5 --bots 1 --width 8
//
// --bots is how many seats are bots (the first ones; the rest play at random).
// Factions and mats rotate between games, so each seat gets a mix.
import { baseBoard, baseFactions, baseMats, sampleEncounters, sampleFactoryCards, sampleObjectives, sampleStructureBonuses } from '@scythe/content';
import { ENGINE_VERSION, standings, type GameSetup, type Seat } from '@scythe/engine';
import { planningBot, playMatch, randomSeat } from '@scythe/bots';

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};
const games = arg('games', 10);
const players = arg('players', 5);
const bots = arg('bots', 1);
const width = arg('width', 8);

const setup = (game: number): GameSetup => ({
  seed: 1000 + game,
  board: baseBoard,
  turnOrder: 'map',
  players: Array.from({ length: players }, (_, i) => ({ faction: baseFactions[(i + game) % 5]!, mat: baseMats[(i + 2 * game) % 5]! })),
  encounters: sampleEncounters,
  factory: sampleFactoryCards,
  objectives: sampleObjectives,
  structureBonuses: sampleStructureBonuses,
});

/** Times each decision, to report how long a bot thinks. */
function timed(seat: Seat, times: number[]): Seat {
  return {
    async chooseAction(view, legal) {
      const start = performance.now();
      const action = await seat.chooseAction(view, legal);
      times.push(performance.now() - start);
      return action;
    },
  };
}

console.log(`engine ${ENGINE_VERSION}: ${games} games, ${players} players, ${bots} bot${bots === 1 ? '' : 's'} (width ${width}), the rest random\n`);
let botWins = 0;
let turns = 0;
const times: number[] = [];
for (let game = 0; game < games; game++) {
  const s = setup(game);
  const seats = s.players.map((_p, i) => (i < bots ? timed(planningBot({ width }), times) : randomSeat(game * 10 + i)));
  const { state, finished } = await playMatch(s, seats);
  const ranked = standings(state);
  const winner = ranked[0]!.seat;
  if (winner < bots) botWins++;
  turns += state.turnsTaken / players;
  const line = ranked
    .map((r) => `${r.seat < bots ? 'bot' : 'random'} ${s.players[r.seat]!.faction.id} ${r.total} (${state.players[r.seat]!.stars.length}★)`)
    .join(', ');
  console.log(`game ${game + 1}${finished ? '' : ' (unfinished)'}: ${line}; ${Math.round(state.turnsTaken / players)} turns each`);
}
times.sort((a, b) => a - b);
const pct = (p: number) => Math.round(times[Math.min(times.length - 1, Math.floor(p * times.length))] ?? 0);
console.log(`\nbots won ${botWins} of ${games}; ${Math.round(turns / games)} turns each on average`);
if (times.length) console.log(`bot thinking: median ${pct(0.5)} ms, 99th percentile ${pct(0.99)} ms, slowest ${Math.round(times.at(-1)!)} ms (this machine)`);
