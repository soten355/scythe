// What the fight screen shows: the attacker on the left, the defender on the
// right, each with the units they brought and what they can fight with. What
// a side has chosen stays hidden; only whether they've locked in shows.
import { maxCombatCards, type GameState, type HexId } from '@scythe/engine';

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
