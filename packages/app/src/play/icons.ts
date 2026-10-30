// The symbols drawn on board hexes and in the side panel. Swap any of them here:
//   { text: '🌾' }                    any emoji, Unicode symbol or short text
//   { image: 'icons/food.png' }       an image (a transparent .png or .svg) put in
//                                     packages/app/public/icons/
// Leave a terrain out to draw nothing on it.
import type { RecruitBonus, Resource, Terrain } from '@scythe/engine';

export type Icon = { text: string } | { image: string };

/** Each resource, and workers (what villages make). */
export const RESOURCE_ICONS: Record<Resource | 'worker', Icon> = {
  food: { text: '🌾' },
  wood: { text: '🪵' },
  metal: { image: 'icons/metal.svg' }, // no ingot emoji exists
  oil: { text: '🛢️' },
  worker: { text: '👤' },
};

/** In the middle of each hex: what the terrain produces (or what it is). */
export const TERRAIN_ICONS: Partial<Record<Terrain, Icon>> = {
  farm: RESOURCE_ICONS.food,
  forest: RESOURCE_ICONS.wood,
  mountain: RESOURCE_ICONS.metal,
  tundra: RESOURCE_ICONS.oil,
  village: RESOURCE_ICONS.worker,
  factory: { text: '🏭' },
  lake: { text: '💧' },
};

/** At the top of tunnel hexes. */
export const TUNNEL_ICON: Icon = { text: '⛏️' };

/** At the bottom of hexes with an encounter token. */
export const ENCOUNTER_ICON: Icon = { text: '⭐' };

/** Power, coins, popularity and combat cards (recruit bonuses, and more later). */
export const BONUS_ICONS: Record<RecruitBonus, Icon> = {
  power: { text: '⚡' },
  coins: { text: '🪙' },
  popularity: { text: '❤️' },
  combatCard: { text: '🃏' },
};
