// Objective card conditions in plain words: "at least 3 workers on farms".
import { hasRule, objectiveCard, objectiveMet, type GameState, type ObjectiveCard, type ObjectiveCheck, type ObjectiveProgress, type ObjectiveStat, type ObjectiveUnit, type Terrain } from '@scythe/engine';

const STAT: Record<ObjectiveStat, [string, string]> = {
  power: ['power', 'power'],
  popularity: ['popularity', 'popularity'],
  coins: ['coin', 'coins'],
  combatCards: ['combat card', 'combat cards'],
};
const UNIT: Record<ObjectiveUnit, [string, string]> = {
  character: ['character', 'characters'],
  mech: ['mech', 'mechs'],
  worker: ['worker', 'workers'],
  any: ['unit', 'units'],
};
const PROGRESS: Record<ObjectiveProgress, [string, string]> = {
  upgrades: ['upgrade made', 'upgrades made'],
  mechs: ['mech deployed', 'mechs deployed'],
  structures: ['structure built', 'structures built'],
  recruits: ['recruit enlisted', 'recruits enlisted'],
  workers: ['worker', 'workers'],
};
const ON: Record<Terrain, string> = {
  farm: 'farms',
  forest: 'forests',
  mountain: 'mountains',
  tundra: 'tundras',
  village: 'villages',
  lake: 'lakes',
  factory: 'the Factory',
};

const list = (words: string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`);

/** "at least 3 coins", "no coins", "3 to 6 coins", "exactly 4 coins". */
function amount({ atLeast, atMost }: { atLeast?: number; atMost?: number }, [one, many]: [string, string]): string {
  const noun = (n: number) => (n === 1 ? one : many);
  if (atMost === 0) return `no ${many}`;
  if (atLeast !== undefined && atMost !== undefined) return atLeast === atMost ? `exactly ${atLeast} ${noun(atLeast)}` : `${atLeast} to ${atMost} ${many}`;
  if (atMost !== undefined) return `at most ${atMost} ${noun(atMost)}`;
  return `at least ${atLeast ?? 0} ${noun(atLeast ?? 0)}`;
}

export function checkText(check: ObjectiveCheck): string {
  switch (check.kind) {
    case 'stat':
      return amount(check, STAT[check.stat]);
    case 'resources': {
      const what = check.resources?.length ? list(check.resources) : '';
      return `${amount(check, what ? [what, what] : ['resource', 'resources'])} on territories you control`;
    }
    case 'eachResource':
      return `at least ${check.atLeast} each of ${list(check.resources)} on territories you control`;
    case 'units': {
      const where = check.terrain ? ` on ${ON[check.terrain]}` : ' on the map';
      if (check.unit === 'character' && check.atLeast === 1 && check.atMost === undefined) return `your character${where}`;
      return `${amount(check, UNIT[check.unit])}${where}`;
    }
    case 'territories':
      return check.terrain ? amount(check, [`${check.terrain} territory`, `${check.terrain} territories`]) : `${amount(check, ['territory', 'territories'])} (the Factory counts as 3)`;
    case 'progress':
      return amount(check, PROGRESS[check.what]);
  }
}

/** The whole card: "At least 14 coins and at least 7 popularity"; "At the end of your turn: …". */
export function objectiveText(card: ObjectiveCard): string {
  const all = list(card.checks.map(checkText));
  return card.endOfTurn ? `At the end of your turn: ${all}` : all.charAt(0).toUpperCase() + all.slice(1);
}

/** done: completed (a star placed); ready: its conditions hold now; notYet: they don't; closed: another was completed, so this one can't be. */
export type ObjectiveStatus = 'done' | 'ready' | 'notYet' | 'closed';

/** A player's objective cards, for them to look at. */
export function objectiveStatus(state: GameState, seat: number): { name: string; text: string; story?: string; status: ObjectiveStatus }[] {
  const player = state.players[seat]!;
  const done = player.objectivesDone ?? [];
  const limited = done.length > 0 && !hasRule(state, seat, 'unlimitedCombatStars');
  return player.objectives.map((id) => {
    const card = objectiveCard(state, id);
    const status: ObjectiveStatus = done.includes(id) ? 'done' : limited ? 'closed' : objectiveMet(state, seat, card) ? 'ready' : 'notYet';
    return { name: card.name, text: objectiveText(card), ...(card.story && { story: card.story }), status };
  });
}
