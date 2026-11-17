// What a player just gained, for the top bar to show it arriving: used after
// an encounter option (and each resource of your choice), like a recruit's
// one-time bonus.
import { recruitPayouts, RESOURCES, type GameState, type RecruitBonus, type Resource } from '@scythe/engine';

export type GainKind = RecruitBonus | 'worker' | Resource;

export interface Gain {
  kind: GainKind;
  amount: number;
}

/** Coins, power, popularity, combat cards, workers and resources (on any hex) that `seat` has more of in `after` than in `before`. */
export function gainsBetween(before: GameState, after: GameState, seat: number): Gain[] {
  const [p, q] = [before.players[seat]!, after.players[seat]!];
  const gains: Gain[] = [
    { kind: 'coins', amount: q.coins - p.coins },
    { kind: 'power', amount: q.power - p.power },
    { kind: 'popularity', amount: q.popularity - p.popularity },
    { kind: 'combatCard', amount: q.combatCards.length - p.combatCards.length },
    { kind: 'worker', amount: q.workers.length - p.workers.length },
  ];
  const total = (s: GameState, r: Resource) => Object.values(s.resources).reduce((n, pile) => n + (pile[r] ?? 0), 0);
  for (const r of RESOURCES) gains.push({ kind: r, amount: total(after, r) - total(before, r) });
  return gains.filter((g) => g.amount > 0);
}

/**
 * Goods newly put on the map between two states (one action apart): for each
 * resource, the hexes where there's more of it, when there's more of it on
 * the whole map (so goods only carried from hex to hex don't count); and
 * where `seat`'s new workers appeared, when they have more workers. Each is
 * shown being stacked and placed on its hex (produced, or gained from an
 * encounter or a Factory card).
 */
export function placedGoods(before: GameState, after: GameState, seat: number): { hex: string; what: Resource | 'worker'; amount: number }[] {
  const placed: { hex: string; what: Resource | 'worker'; amount: number }[] = [];
  const total = (s: GameState, r: Resource) => Object.values(s.resources).reduce((n, pile) => n + (pile[r] ?? 0), 0);
  for (const r of RESOURCES) {
    let left = total(after, r) - total(before, r);
    for (const [hex, pile] of Object.entries(after.resources)) {
      const more = Math.min(left, (pile[r] ?? 0) - (before.resources[hex]?.[r] ?? 0));
      if (more <= 0) continue;
      placed.push({ hex, what: r, amount: more });
      left -= more;
    }
  }
  const [was, now] = [before.players[seat]!.workers, after.players[seat]!.workers];
  let left = now.length - was.length;
  for (const hex of new Set(now)) {
    const more = Math.min(left, now.filter((w) => w === hex).length - was.filter((w) => w === hex).length);
    if (more <= 0) continue;
    placed.push({ hex: String(hex), what: 'worker', amount: more });
    left -= more;
  }
  return placed;
}

/**
 * The ongoing recruit bonuses paid out along `states` (each step one action
 * after the last): whenever a bottom-row action is done, its player and their
 * neighbours with a recruit on that kind of action each gain 1 (engine:
 * `recruitPayouts`).
 */
export function recruitPayoutsIn(states: GameState[]): { seat: number; bonus: RecruitBonus }[] {
  return states.slice(1).flatMap((after, i) => {
    const before = states[i]!;
    // A bottom-row action pays out exactly as it's done: its step gives way to ending the turn.
    if (before.turn.step !== 'bottom' || after.turn.step !== 'end') return [];
    return recruitPayouts(before, before.currentPlayer, before.turn.section);
  });
}
