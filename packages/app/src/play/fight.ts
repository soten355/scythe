// What the fight screen shows: the attacker on the left, the defender on the
// right, each with the units they brought and what they can fight with. What
// a side has chosen stays hidden; only whether they've locked in shows.
import { maxCombatCards, type CombatResult, type GameState, type HexId } from '@scythe/engine';

export interface FightSide {
  seat: number;
  name: string;
  color: string;
  character: boolean;
  mechs: number;
  workers: number;
  /** Power they have to dial from, and cards in hand. */
  power: number;
  cards: number;
  maxCards: number;
  lockedIn: boolean;
}

export interface FightView {
  hex: HexId;
  terrain: string;
  attacker: FightSide;
  defender: FightSide;
}

/** The fight under way, or null when there isn't one (or a loser is picking where to retreat). */
export function fightSides(state: GameState): FightView | null {
  const turn = state.turn;
  if (turn.step !== 'combat' || !turn.fight || turn.retreat) return null;
  const { hex } = turn.fight;
  const side = (s: { seat: number; power: number | null }): FightSide => {
    const p = state.players[s.seat]!;
    const { faction } = state.setup.players[s.seat]!;
    return {
      seat: s.seat,
      name: faction.name,
      color: faction.color,
      character: p.character === hex,
      mechs: p.mechs.filter((m) => m === hex).length,
      workers: p.workers.filter((w) => w === hex).length,
      power: p.power,
      cards: p.combatCards.length,
      maxCards: maxCombatCards(state, s.seat, hex),
      lockedIn: s.power !== null,
    };
  };
  return {
    hex,
    terrain: state.setup.board.hexes[hex]?.terrain ?? '',
    attacker: side(turn.fight.attacker),
    defender: side(turn.fight.defender),
  };
}

/** One side of a finished fight: who fought, what they showed, and their total. */
export interface BattleSide extends Omit<FightSide, 'power' | 'cards' | 'maxCards' | 'lockedIn'> {
  power: number;
  cards: number[];
  total: number;
}

/** A finished fight, for the battle scene: the two sides clash and the winner is left standing. */
export interface Battle {
  hex: HexId;
  attacker: BattleSide;
  defender: BattleSide;
  winner: 'attacker' | 'defender';
}

/**
 * The battle to play out for a fight that just ended. `states` are the
 * moments around it, oldest first: the loser's units have gone home by the
 * end, so each side is drawn from the first moment it had units on the hex.
 */
export function battleOf(states: GameState[], result: CombatResult): Battle {
  const side = (shown: CombatResult['attacker']): BattleSide => {
    const units = (s: GameState) => {
      const p = s.players[shown.seat]!;
      return { character: p.character === result.hex, mechs: p.mechs.filter((m) => m === result.hex).length, workers: p.workers.filter((w) => w === result.hex).length };
    };
    const found = states.map(units).find((u) => u.character || u.mechs) ?? { character: false, mechs: 1, workers: 0 };
    const { faction } = states[0]!.setup.players[shown.seat]!;
    return { seat: shown.seat, name: faction.name, color: faction.color, ...found, power: shown.power, cards: shown.cards, total: shown.power + shown.cards.reduce((a, b) => a + b, 0) };
  };
  return {
    hex: result.hex,
    attacker: side(result.attacker),
    defender: side(result.defender),
    winner: result.winner === result.attacker.seat ? 'attacker' : 'defender',
  };
}
