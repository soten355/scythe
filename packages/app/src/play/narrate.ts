// A bot's turn told in a few plain lines ("Chose Produce / Upgrade", "Moved
// the character to A4", "Now: +2 metal, −1 coin"), for watching it play and
// looking back at what the bots did since your last turn. Also how long each
// of its moves stays on screen.
import { activeSeat, applyAction, RESOURCES, type Action, type GameState, type StarKind } from '@scythe/engine';
import { combatSummary, label } from './prompt';
import { isBot, type Bots } from './seats';

/** One player's turn: steps[start] to steps[end - 1], from history[start] to history[end]. */
export interface Turn {
  seat: number;
  start: number;
  end: number;
}

/** The game's turns so far, in order (the last may be under way). history has one more state than there are steps. */
export function turnsOf(history: GameState[]): Turn[] {
  const turns: Turn[] = [];
  for (let i = 0; i < history.length - 1; i++) {
    const s = history[i]!;
    const last = turns[turns.length - 1];
    if (last && history[last.start]!.turnsTaken === s.turnsTaken) last.end = i + 1;
    else turns.push({ seat: s.currentPlayer, start: i, end: i + 1 });
  }
  return turns;
}

const STAR_NAMES: Record<StarKind, string> = {
  upgrades: 'all six upgrades', mechs: 'all four mechs', structures: 'all four structures', recruits: 'all four recruits',
  workers: 'all eight workers', popularity: 'top popularity', power: 'top power', combat: 'winning a fight', objective: 'an objective',
};
const UNIT_NAMES = { character: 'the character', mech: 'a mech', worker: 'a worker' } as const;
/** Moves that each say something by themselves. */
const TOLD = new Set<Action['type']>(['bolster', 'gainCoins', 'tradePopularity', 'upgrade', 'enlist', 'takeFactoryCard', 'factoryUse']);

/** What `turn`'s player did, in order: the section, moves, production, the rest, fights, stars, and what changed for them. */
export function tellTurn(history: GameState[], steps: Action[][], turn: Turn): string[] {
  const { seat } = turn;
  const chose: string[] = [];
  const told: string[] = [];
  const fights: string[] = [];
  const moved = new Map<string, { unit: string; to: string }>();
  const produced: string[] = [];
  const traded: string[] = [];
  for (let i = turn.start; i < turn.end; i++) {
    let s = history[i]!;
    for (const a of steps[i]!) {
      // One action a step (as bots play): the state it led to is already in the history.
      const next = steps[i]!.length === 1 ? history[i + 1]! : applyAction(s, a);
      if (activeSeat(s) === seat) {
        if (a.type === 'chooseSection') chose.push(`Chose ${label(s, a)}`);
        else if (a.type === 'moveUnit') {
          const key = a.unit.kind === 'character' ? 'character' : `${a.unit.kind}${a.unit.index}`;
          moved.set(key, { unit: UNIT_NAMES[a.unit.kind], to: a.to === 'home' ? 'home' : a.to });
        } else if (a.type === 'produce') produced.push(a.hex);
        else if (a.type === 'tradeResource') traded.push(a.resource);
        else if (a.type === 'deploy') told.push(`Deployed a mech on ${a.hex} (${label(s, a).replace(/^Mech: /, '')})`);
        else if (a.type === 'build') told.push(`Built the ${a.structure} on ${a.hex}`);
        else if (a.type === 'encounterOption') told.push(`Had an encounter (option ${a.option + 1})`);
        else if (a.type === 'factoryChoose') told.push(`Took ${label(s, a).toLowerCase()} from its Factory card`);
        else if (a.type === 'factoryResource' && s.turn.step === 'factoryResources') told.push(`Put 1 ${a.resource} on ${s.turn.hex}`);
        else if (a.type === 'completeObjective') told.push(label(s, a).replace(/^★ Complete objective/, 'Completed the objective'));
        else if (TOLD.has(a.type)) told.push(label(s, a));
      }
      if (next.lastCombat && next.lastCombat !== s.lastCombat) {
        const r = next.lastCombat;
        const total = (x: typeof r.attacker) => x.power + x.cards.reduce((n, c) => n + c, 0);
        fights.push(`⚔ ${combatSummary(next, r).title} (${total(r.attacker)} to ${total(r.defender)})`);
      }
      s = next;
    }
  }
  const lines = [...chose];
  if (moved.size) {
    // "the character to A4, 2 workers to B5"
    const groups = new Map<string, number>();
    for (const m of moved.values()) groups.set(`${m.unit}|${m.to}`, (groups.get(`${m.unit}|${m.to}`) ?? 0) + 1);
    const parts = [...groups].map(([k, n]) => {
      const [unit, to] = k.split('|') as [string, string];
      const who = n > 1 ? `${n} ${unit.replace(/^an? /, '')}s` : unit;
      return `${who} to ${to}`;
    });
    lines.push(`Moved ${parts.join(', ')}`);
  }
  if (produced.length) lines.push(`Produced on ${produced.join(', ')}`);
  if (traded.length) lines.push(`Traded for ${traded.map((r) => `1 ${r}`).join(', ')}`);
  lines.push(...told, ...fights);
  const [first, last] = [history[turn.start]!, history[turn.end]!];
  // Stars placed this turn, the player's own and anyone else's (a defender who won a fight).
  last.players.forEach((p, who) => {
    const name = who === seat ? '' : `${last.setup.players[who]!.faction.name}: `;
    for (const kind of p.stars.slice(first.players[who]!.stars.length)) lines.push(`★ ${name}Star for ${STAR_NAMES[kind]}`);
  });
  const changes = changesBetween(first, last, seat);
  if (changes.length) lines.push(`Now: ${changes.join(', ')}`);
  return lines;
}

/** "+2 power", "−1 coin": what `seat` has more or less of (resources counted on every hex). */
function changesBetween(before: GameState, after: GameState, seat: number): string[] {
  const [p, q] = [before.players[seat]!, after.players[seat]!];
  const total = (s: GameState, r: (typeof RESOURCES)[number]) => Object.values(s.resources).reduce((n, pile) => n + (pile[r] ?? 0), 0);
  const counts: [string, string, number][] = [
    ['coin', 'coins', q.coins - p.coins],
    ['power', 'power', q.power - p.power],
    ['popularity', 'popularity', q.popularity - p.popularity],
    ['combat card', 'combat cards', q.combatCards.length - p.combatCards.length],
    ['worker', 'workers', q.workers.length - p.workers.length],
    ...RESOURCES.map((r): [string, string, number] => [r, r, total(after, r) - total(before, r)]),
  ];
  return counts.filter(([, , n]) => n !== 0).map(([one, many, n]) => `${n > 0 ? '+' : '−'}${Math.abs(n)} ${Math.abs(n) === 1 ? one : many}`);
}

/** The bots' turns since a person last finished one (oldest first), told; the last may be under way. Looks back from the end only as far as it needs. */
export function botTurnsSince(history: GameState[], steps: Action[][], bots: Bots): { seat: number; lines: string[] }[] {
  const out: { seat: number; lines: string[] }[] = [];
  const now = history[steps.length]!;
  let end = steps.length;
  while (end > 0) {
    // The turn holding step end - 1.
    const key = history[end - 1]!.turnsTaken;
    let start = end - 1;
    while (start > 0 && history[start - 1]!.turnsTaken === key) start--;
    const turn = { seat: history[start]!.currentPlayer, start, end };
    const underWay = end === steps.length && now.turnsTaken === key;
    if (isBot(bots, turn.seat)) out.push({ seat: turn.seat, lines: tellTurn(history, steps, turn) });
    else if (!underWay) break;
    end = start;
  }
  return out.reverse();
}

/** Moves to stop on while a bot plays ('watch'), and small steps to hurry through ('quick'). */
export function paceOf(action: Action): 'watch' | 'quick' {
  switch (action.type) {
    case 'chooseSection':
    case 'moveUnit':
    case 'produce':
    case 'bolster':
    case 'gainCoins':
    case 'tradePopularity':
    case 'upgrade':
    case 'deploy':
    case 'build':
    case 'enlist':
    case 'takeFactoryCard':
    case 'completeObjective':
    case 'encounterOption':
    case 'fight':
    case 'retreat':
      return 'watch';
    default:
      return 'quick';
  }
}
