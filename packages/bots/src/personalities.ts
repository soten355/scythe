// Faction personalities: how each faction's bot leans. A personality tilts
// the position score's weights (it still plays to win; this is a bias, not
// a script) and sets how bold it is in fights.
//
// Scythe rewards building up far more than fighting, so even the boldest
// stays well short of reckless: boldness only shifts how hard it expects
// the other side to fight back.
//
// Keyed by the factions' neutral IDs. A faction with no personality here
// (your own, from the faction editor) plays with the balanced one.
import { DEFAULT_WEIGHTS, type Weights } from './score';

export interface Personality {
  id: string;
  /** What it leans toward, in a line, for the new game screen and play-testing. */
  summary: string;
  /** Changes to the default weights. */
  weights: Partial<Weights>;
  /** How bold it is in fights, 0-1: 0 fights only when sure to win, 1 takes its chances. */
  boldness: number;
}

export const BALANCED: Personality = { id: 'balanced', summary: 'No particular leaning: whatever scores best', weights: {}, boldness: 0.4 };

export const PERSONALITIES: Record<string, Personality> = {
  nordic: {
    id: 'nordic',
    summary: 'Spreads out: many workers, lots of territory, fights only when clearly ahead',
    weights: { territory: 2, worker: 2.2, produces: 2.5, rivalry: 0.4 },
    boldness: 0.2,
  },
  rusviet: {
    id: 'rusviet',
    summary: 'Tempo: a fast economy, mechs and upgrades early, and a push to the Factory',
    weights: { upgrade: 3.5, mech: 3.8, factoryPull: 1.5, factoryCard: 6, encounterPull: 0.2 },
    boldness: 0.45,
  },
  polonia: {
    id: 'polonia',
    summary: 'Encounters and popularity: hunts encounter tokens, avoids fights, aims for a high popularity tier',
    weights: { encounterPull: 1, popularity: 0.9, factoryPull: 0.2, rivalry: 0.4 },
    boldness: 0.15,
  },
  crimea: {
    id: 'crimea',
    summary: 'Pressure: combat cards and power, taking territory, keeping the others down',
    weights: { combatCard: 1.2, power: 0.45, territory: 0.7, rivalry: 0.7 },
    boldness: 0.55,
  },
  saxony: {
    id: 'saxony',
    summary: 'Stars by any route: objectives and fights, as many as it can',
    weights: { nearStar: 5, objectiveReady: 6, closestStar: 12 },
    boldness: 0.5,
  },
};

/** The personality for a faction (the balanced one if it has none). */
export const personalityFor = (factionId: string): Personality => PERSONALITIES[factionId] ?? BALANCED;

/** The full weights a personality plays with. */
export const weightsOf = (personality: Personality): Weights => ({ ...DEFAULT_WEIGHTS, ...personality.weights });
