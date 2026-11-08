// Objective card conditions in plain words: "at least 3 workers on farms".
import { hasRule, objectiveCard, objectiveMet, type GameState, type ObjectiveCard, type ObjectiveCheck, type ObjectiveEvent, type ObjectiveProgress, type ObjectiveStat, type ObjectiveUnit, type Terrain, type TerritoryCheck } from '@scythe/engine';

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
  factoryCards: ['Factory card', 'Factory cards'],
  fightsWon: ['fight won', 'fights won'],
};
const EVENT: Record<ObjectiveEvent, [string, string]> = {
  workersSentHome: ['enemy worker sent home this turn', 'enemy workers sent home this turn'],
};
/** "around the same lake", "next to the Factory": one hex of the terrain, its neighbours counted. */
const AROUND: Record<Terrain, string> = {
  farm: 'around the same farm',
  forest: 'around the same forest',
  mountain: 'around the same mountain',
  tundra: 'around the same tundra',
  village: 'around the same village',
  lake: 'around the same lake',
  factory: 'next to the Factory',
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

/** One part of a "one territory" condition: "your character", "exactly 1 mech", "at least 5 resources". */
function partText(part: TerritoryCheck): string {
  switch (part.kind) {
    case 'units':
      if (part.unit === 'character' && part.atLeast === 1 && part.atMost === undefined) return 'your character';
      return amount(part, UNIT[part.unit]);
    case 'structures':
      return amount(part, ['structure', 'structures']);
    case 'tokens':
      return `${amount(part, ['of your tokens', 'of your tokens'])} (character, mechs, workers, structures)`;
    case 'resources': {
      const what = part.resources?.length ? list(part.resources) : '';
      return amount(part, what ? [what, what] : ['resource', 'resources']);
    }
    case 'eachResource':
      return `at least ${part.atLeast} each of ${list(part.resources)}`;
  }
}

export function checkText(check: ObjectiveCheck): string {
  switch (check.kind) {
    case 'oneTerritory':
      return `one territory you control with ${list(check.checks.map(partText))}`;
    case 'around':
      return `${amount(check, ['territory', 'territories'])} ${AROUND[check.terrain]}`;
    case 'same':
      return `as many ${PROGRESS[check.what[0]][1]} as ${PROGRESS[check.what[1]][1]}`;
    case 'highest':
      return `the most ${STAT[check.stat][1]} of any player (ties count)`;
    case 'thisTurn':
      return amount(check, EVENT[check.what]);
    case 'stat':
      return amount(check, STAT[check.stat]);
    case 'resources': {
      const what = check.resources?.length ? list(check.resources) : '';
      if (check.oneKind) return `${amount(check, [`of one kind of ${what || 'resource'}`, `of one kind of ${what || 'resource'}`])} on territories you control`;
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
      if (check.tunnel) return amount(check, ['tunnel territory', 'tunnel territories']);
      return check.terrain ? amount(check, [`${check.terrain} territory`, `${check.terrain} territories`]) : `${amount(check, ['territory', 'territories'])} (the Factory counts as 3)`;
    case 'progress':
      // You hold one Factory card at most: "a Factory card" or "no Factory card".
      if (check.what === 'factoryCards') return check.atMost === 0 ? 'no Factory card' : 'a Factory card';
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
