// Factions as data. Phase 1 needs only where a faction starts and its
// starting power and combat cards (both from the faction mat). Faction
// abilities and mechs arrive in Phase 2 as rule hooks.
import type { HomeBaseId } from './board';

export interface Faction {
  id: string;
  name: string;
  /** Which home base on the board this faction starts at. */
  homeBase: HomeBaseId;
  power: number;
  combatCards: number;
}
