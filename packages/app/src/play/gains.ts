// What a player just gained, for the top bar to show it arriving: used after
// an encounter option (and each resource of your choice), like a recruit's
// one-time bonus.
import { RESOURCES, type GameState, type RecruitBonus, type Resource } from '@scythe/engine';

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
