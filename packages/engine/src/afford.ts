// What a player is short of to take each half of a mat section: coins for
// Bolster and Trade, Produce's power/popularity/coins, and the bottom-row
// resources on hexes they control. Empty lists mean it can be paid.
import type { GameState, SectionIndex } from './game';
import type { Resource } from './mat';
import { bottomCost, controlledHexes } from './state';
import { produceCost } from './top-actions';

export interface Need {
  what: 'coins' | 'power' | 'popularity' | Resource;
  amount: number;
}

export function shortfall(state: GameState, seat: number, section: SectionIndex): { top: Need[]; bottom: Need[] } {
  const player = state.players[seat]!;
  const { mat } = state.setup.players[seat]!;
  const { top } = mat.sections[section];
  const short = (what: Need['what'], cost: number, have: number): Need[] => (have < cost ? [{ what, amount: cost - have }] : []);

  let topNeeds: Need[] = [];
  if (top.action === 'bolster' || top.action === 'trade') topNeeds = short('coins', top.cost, player.coins);
  if (top.action === 'produce') {
    const cost = produceCost(player);
    topNeeds = [...short('power', cost.power, player.power), ...short('popularity', cost.popularity, player.popularity), ...short('coins', cost.coins, player.coins)];
  }

  const cost = bottomCost(player, mat, section);
  const have = [...controlledHexes(state, seat)].reduce((n, hex) => n + (state.resources[hex]?.[cost.resource] ?? 0), 0);
  return { top: topNeeds, bottom: short(cost.resource, cost.amount, have) };
}
