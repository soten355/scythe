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
