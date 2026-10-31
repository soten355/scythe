// Combat: what happens when a move ends with your character or mechs on a
// hex with another player's units.
//
// Enemy workers alone don't fight: they go back to their home base and you
// lose 1 popularity for each. Where there are enemy characters or mechs, a
// fight follows once the whole move is over, one hex at a time in the order
// the attacker picks. In each fight the attacker, then the defender, secretly
// adds combat cards (one per character or mech they have there) and sets
// their power dial (0-7, up to the power they have). Highest total wins; ties
// go to the attacker. Both pay the power dialed and discard the cards played.
// Everything of the loser's on the hex goes home; if the attacker won, they
// lose 1 popularity per enemy worker sent home. The winner earns a combat
// star (two at most). A loser who showed any power draws a combat card.
import type { HexId } from './board';
import type { Action, CombatSide, Fight, GameState, Location, PlayerState, SectionIndex, TurnStep } from './game';
import { shuffle } from './rng';
import { MAX_POPULARITY, placeStar, updatePlayer } from './state';

type CombatStep = Extract<TurnStep, { step: 'combat' }>;

/** The combat card deck: 16 twos, 12 threes, 8 fours and 6 fives. */
export const COMBAT_DECK: number[] = [
  ...Array<number>(16).fill(2),
  ...Array<number>(12).fill(3),
  ...Array<number>(8).fill(4),
  ...Array<number>(6).fill(5),
];
export const MAX_DIAL = 7;
export const MAX_COMBAT_STARS = 2;

/** Draws `n` combat cards for a player, shuffling the discards into a new deck when it runs out. */
export function drawCombatCards(state: GameState, seat: number, n: number): GameState {
  let { combatDeck: deck, combatDiscard: discard, rng } = state;
  const drawn: number[] = [];
  for (let i = 0; i < n; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      [deck, rng] = shuffle(rng, discard);
      discard = [];
    }
    drawn.push(deck[0]!);
    deck = deck.slice(1);
  }
  const player = state.players[seat]!;
  return updatePlayer({ ...state, combatDeck: deck, combatDiscard: discard, rng }, seat, {
    combatCards: [...player.combatCards, ...drawn],
  });
}

/** Characters and mechs on a hex: the units that fight, each allowing one combat card. */
export function combatUnitsOn(player: PlayerState, hex: HexId): number {
  return (player.character === hex ? 1 : 0) + player.mechs.filter((m) => m === hex).length;
}

const hasUnitsOn = (player: PlayerState, hex: HexId) =>
  combatUnitsOn(player, hex) > 0 || player.workers.includes(hex);

/** Sends all of a player's units on a hex home. */
function retreat(state: GameState, seat: number, hex: HexId): GameState {
  const p = state.players[seat]!;
  const home = (at: Location): Location => (at === hex ? 'home' : at);
  return updatePlayer(state, seat, { character: home(p.character), mechs: p.mechs.map(home), workers: p.workers.map(home) });
}

const losePopularity = (state: GameState, seat: number, n: number): GameState =>
  updatePlayer(state, seat, { popularity: Math.max(0, Math.min(MAX_POPULARITY, state.players[seat]!.popularity - n)) });

/**
 * Called when the current player's move is over: sends home enemy workers
 * the mover's characters and mechs landed on, then starts the fights, if any.
 */
export function afterMove(state: GameState, section: SectionIndex): GameState {
  const seat = state.currentPlayer;
  const me = state.players[seat]!;
  const fights: HexId[] = [];
  let next = state;
  const myHexes = [...new Set([me.character, ...me.mechs])].filter((h): h is HexId => h !== 'home');
  for (const hex of myHexes) {
    const enemy = state.players.findIndex((p, i) => i !== seat && hasUnitsOn(p, hex));
    if (enemy < 0) continue;
    if (combatUnitsOn(state.players[enemy]!, hex) > 0) {
      fights.push(hex);
    } else {
      const workers = state.players[enemy]!.workers.filter((w) => w === hex).length;
      next = losePopularity(retreat(next, enemy, hex), seat, workers);
    }
  }
  return nextFight(next, section, fights);
}

/** Starts the only fight left on its own; with several, the attacker picks; with none, on to the bottom row. */
function nextFight(state: GameState, section: SectionIndex, left: HexId[]): GameState {
  if (left.length === 0) return { ...state, turn: { step: 'bottom', section, paid: 0 } };
  if (left.length > 1) return { ...state, turn: { step: 'combat', section, left, fight: null } };
  return startFight(state, section, left, left[0]!);
}

function startFight(state: GameState, section: SectionIndex, left: HexId[], hex: HexId): GameState {
  const attacker = state.currentPlayer;
  const defender = state.players.findIndex((p, i) => i !== attacker && combatUnitsOn(p, hex) > 0);
  const side = (seat: number): CombatSide => ({ seat, cards: [], power: null });
  const fight: Fight = { hex, attacker: side(attacker), defender: side(defender) };
  return settle({ ...state, turn: { step: 'combat', section, left, fight } });
}

/** The side whose turn it is to choose in a fight. */
const choosing = (fight: Fight): 'attacker' | 'defender' => (fight.attacker.power === null ? 'attacker' : 'defender');

/** The seat that must act during combat: whichever side is choosing, or the attacker (the current player) picking a fight. */
export const combatSeat = (state: GameState, turn: CombatStep): number =>
  turn.fight ? turn.fight[choosing(turn.fight)].seat : state.currentPlayer;

export function combatActions(state: GameState, turn: CombatStep): Action[] {
  const fight = turn.fight;
  if (!fight) return turn.left.map((hex) => ({ type: 'fight', hex }));
  return sideOptions(state, fight, fight[choosing(fight)]);
}

function sideOptions(state: GameState, fight: Fight, side: CombatSide): Action[] {
  const player = state.players[side.seat]!;
  const actions: Action[] = [];
  if (side.cards.length < combatUnitsOn(player, fight.hex)) {
    const left = [...player.combatCards];
    for (const c of side.cards) left.splice(left.indexOf(c), 1);
    for (const value of [...new Set(left)].sort((a, b) => b - a)) actions.push({ type: 'combatCard', value });
  }
  for (let power = 0; power <= Math.min(MAX_DIAL, player.power); power++) actions.push({ type: 'combatPower', power });
  return actions;
}

export function applyCombat(state: GameState, turn: CombatStep, action: Action): GameState {
  if (action.type === 'fight') return startFight(state, turn.section, turn.left, action.hex);
  const fight = turn.fight!;
  const who = choosing(fight);
  const side = fight[who];
  const changed: CombatSide =
    action.type === 'combatCard'
      ? { ...side, cards: [...side.cards, action.value] }
      : action.type === 'combatPower'
        ? { ...side, power: action.power }
        : side;
  return settle({ ...state, turn: { ...turn, fight: { ...fight, [who]: changed } } });
}

/** Locks in a side with nothing to choose (no power, no cards), and resolves the fight once both sides have chosen. */
function settle(state: GameState): GameState {
  const turn = state.turn as CombatStep;
  const fight = turn.fight!;
  if (fight.defender.power !== null) return resolve(state, turn, fight);
  const who = choosing(fight);
  const options = sideOptions(state, fight, fight[who]);
  if (options.length === 1 && options[0]!.type === 'combatPower') {
    return settle({ ...state, turn: { ...turn, fight: { ...fight, [who]: { ...fight[who], power: 0 } } } });
  }
  return state;
}

/** What each side showed in a finished fight, and who won. */
export interface CombatResult {
  hex: HexId;
  attacker: { seat: number; power: number; cards: number[] };
  defender: { seat: number; power: number; cards: number[] };
  winner: number;
}

function resolve(state: GameState, turn: CombatStep, fight: Fight): GameState {
  const shown = (s: CombatSide) => ({ seat: s.seat, power: s.power!, cards: s.cards });
  const result: CombatResult = { hex: fight.hex, attacker: shown(fight.attacker), defender: shown(fight.defender), winner: -1 };
  const total = (s: CombatResult['attacker']) => s.power + s.cards.reduce((a, b) => a + b, 0);
  const attackerWins = total(result.attacker) >= total(result.defender);
  result.winner = attackerWins ? fight.attacker.seat : fight.defender.seat;
  const loser = attackerWins ? result.defender : result.attacker;

  let next = state;
  // Both pay their power and discard the cards they played.
  for (const s of [result.attacker, result.defender]) {
    const p = next.players[s.seat]!;
    const hand = [...p.combatCards];
    for (const c of s.cards) hand.splice(hand.indexOf(c), 1);
    next = updatePlayer(next, s.seat, { power: p.power - s.power, combatCards: hand });
    next = { ...next, combatDiscard: [...next.combatDiscard, ...s.cards] };
  }
  if (attackerWins) {
    const workers = next.players[loser.seat]!.workers.filter((w) => w === fight.hex).length;
    next = losePopularity(next, result.winner, workers);
  }
  next = retreat(next, loser.seat, fight.hex);
  if (total(loser) > 0) next = drawCombatCards(next, loser.seat, 1);
  const combatStars = next.players[result.winner]!.stars.filter((s) => s === 'combat').length;
  if (combatStars < MAX_COMBAT_STARS) next = placeStar(next, result.winner, 'combat');

  next = { ...next, lastCombat: result };
  return nextFight(next, turn.section, turn.left.filter((h) => h !== fight.hex));
}
