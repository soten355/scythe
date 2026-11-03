// Bot speed check: plays a game between bots in the background thread, as
// the real game will, and shows how long they take to decide, on whatever
// device it's opened on (meant for the iPhone). Plain DOM, no framework.
import { activeSeat, applyAction, isGameOver, legalActions, newGame, playerView, type GameSetup } from '@scythe/engine';
import type { Level, RemoteSeat } from '@scythe/bots';
import '../shared/forms.css';
import { BUILT_IN } from '../content/catalog';
import { startBots } from '../bots/client';

const LIMIT = 2000;
const levels: Level[] = ['hard', 'hard', 'medium', 'medium'];
const root = document.getElementById('bot-check')!;

root.innerHTML = `
  <header>
    <a href="${import.meta.env.BASE_URL}#workshop">← Workshop</a>
    <h1 style="margin:0;font-size:1.2em">Bot speed check</h1>
  </header>
  <section class="details" style="flex-direction:column;align-items:flex-start;max-width:46em">
    <p style="margin:0">Plays a 4-player game between bots (two Hard, two Medium) thinking in the background, as they will in a real game, and times every decision on this device. A decision should take at most ${LIMIT / 1000} seconds: near that, a bot stops and plays the best it has found.</p>
    <label>Rounds <select id="rounds"><option value="6">6</option><option value="12" selected>12</option><option value="999">the whole game</option></select></label>
    <div style="display:flex;gap:8px"><button id="start" class="primary">Start</button><button id="stop" disabled>Stop</button></div>
    <p id="status" style="margin:0"></p>
    <table id="results" style="border-collapse:collapse"></table>
    <p style="margin:0;opacity:.6;font-size:.85em">${navigator.userAgent}</p>
  </section>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let running = false;

$('stop').onclick = () => (running = false);
$('start').onclick = () => void run(Number($<HTMLSelectElement>('rounds').value));

async function run(rounds: number) {
  running = true;
  $<HTMLButtonElement>('start').disabled = true;
  $<HTMLButtonElement>('stop').disabled = false;
  const setup: GameSetup = {
    seed: Math.floor(Math.random() * 1e9),
    board: BUILT_IN.maps[0]!.board,
    players: levels.map((_l, i) => ({ faction: BUILT_IN.factions[i]!, mat: BUILT_IN.mats[i]! })),
    encounters: BUILT_IN.encounters,
    factory: BUILT_IN.factory,
    objectives: BUILT_IN.objectives,
    structureBonuses: BUILT_IN.structureBonuses,
  };
  const { client, stop } = startBots();
  const seats: RemoteSeat[] = levels.map((level, i) => client.seat(`check-${i}`, { level, seed: i + 1, timeLimit: LIMIT }));
  const times: Record<Level, { think: number[]; wait: number[] }> = { easy: { think: [], wait: [] }, medium: { think: [], wait: [] }, hard: { think: [], wait: [] } };
  let state = newGame(setup);
  try {
    while (running && !isGameOver(state) && state.turnsTaken < rounds * levels.length) {
      const seat = activeSeat(state);
      const start = performance.now();
      const action = await seats[seat]!.chooseAction(playerView(state, seat), legalActions(state, seat));
      times[levels[seat]!].wait.push(performance.now() - start);
      times[levels[seat]!].think.push(seats[seat]!.lastMs);
      state = applyAction(state, action);
      show(state.turnsTaken, rounds, times);
    }
    $('status').textContent = isGameOver(state) ? 'Done: the game ended.' : running ? 'Done.' : 'Stopped.';
  } catch (e) {
    $('status').textContent = `Something went wrong: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    stop();
    running = false;
    $<HTMLButtonElement>('start').disabled = false;
    $<HTMLButtonElement>('stop').disabled = true;
  }
}

function show(turns: number, rounds: number, times: Record<Level, { think: number[]; wait: number[] }>) {
  const round = Math.floor(turns / levels.length) + 1;
  $('status').textContent = `Round ${Math.min(round, rounds)}${rounds < 999 ? ` of ${rounds}` : ''}…`;
  const s = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
  const cell = (x: string, head = false) => `<${head ? 'th' : 'td'} style="padding:4px 10px;text-align:left">${x}</${head ? 'th' : 'td'}>`;
  const rows = (['medium', 'hard'] as Level[]).map((level) => {
    const { think, wait } = times[level];
    // Most decisions (the rest of a planned turn) are instant; the ones that matter are where it thought.
    const real = think.filter((ms) => ms > 5).sort((a, b) => a - b);
    const median = real[Math.floor(real.length / 2)] ?? 0;
    const slowest = Math.max(0, ...think);
    const slowestWait = Math.max(0, ...wait);
    const near = think.filter((ms) => ms > 0.85 * LIMIT).length;
    return `<tr>${[level === 'hard' ? 'Hard' : 'Medium', String(real.length), s(median), s(slowest), s(slowestWait), String(near)].map((x) => cell(x)).join('')}</tr>`;
  });
  $('results').innerHTML = `<tr>${['Level', 'Decisions', 'Typical', 'Slowest', 'Slowest wait', 'Near the limit'].map((x) => cell(x, true)).join('')}</tr>${rows.join('')}`;
}
