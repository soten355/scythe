// Which ability rules a player has in play: their faction ability, plus the
// ability of each mech they've deployed. See AbilityRule in faction.ts.
import type { AbilityRule } from './faction';
import type { GameState } from './game';

export function rulesOf(state: GameState, seat: number): AbilityRule[] {
  const { faction } = state.setup.players[seat]!;
  const unlocked = state.players[seat]!.mechAbilities.map((i) => faction.mechAbilities[i]?.rule);
  return [faction.ability.rule, ...unlocked].filter((r): r is AbilityRule => !!r);
}

/** The player's rules of one kind (empty if they have none). */
export function rulesOfKind<K extends AbilityRule['kind']>(state: GameState, seat: number, kind: K): Extract<AbilityRule, { kind: K }>[] {
  return rulesOf(state, seat).filter((r): r is Extract<AbilityRule, { kind: K }> => r.kind === kind);
}

export const hasRule = (state: GameState, seat: number, kind: AbilityRule['kind']): boolean => rulesOfKind(state, seat, kind).length > 0;
