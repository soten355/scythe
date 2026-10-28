// Content modules register factions, player mats, cards and mech abilities
// as data (plus rule hooks for unique behavior). Engine code only sees
// neutral IDs; display names, art and flavor text live in a content pack.

export interface ContentModule {
  /** Neutral ID, e.g. "base" or "invaders-from-afar". */
  id: string;
  /** Module IDs this one builds on. */
  requires: string[];
}

export { baseModule } from './modules/base';
export { invadersFromAfarModule } from './modules/invaders-from-afar';
export { baseBoard } from './modules/base/board';
