// Playing whole games between seats, for simulations and tests: each seat
// is shown only its own view, and every action it picks is checked by the
// engine (an illegal one throws).
import { activeSeat, applyAction, isGameOver, legalActions, newGame, nextInt, playerView, seedRng, type Action, type GameSetup, type GameState, type Seat } from '@scythe/engine';

/** A seat that picks any legal action at random (seeded, so games repeat). */
export function randomSeat(seed: number): Seat {
  let rng = seedRng(seed);
  return {
    async chooseAction(_view, legal) {
      let pick: number;
      [pick, rng] = nextInt(rng, legal.length);
      return legal[pick]!;
    },
  };
}

export interface MatchResult {
  state: GameState;
  log: Action[];
  /** Whether the game reached its end (false: it hit maxActions first). */
  finished: boolean;
}

export async function playMatch(setup: GameSetup, seats: Seat[], options: { maxActions?: number } = {}): Promise<MatchResult> {
  if (seats.length !== setup.players.length) throw new Error(`${setup.players.length} players need ${setup.players.length} seats, not ${seats.length}`);
  const maxActions = options.maxActions ?? 40_000;
  let state = newGame(setup);
  const log: Action[] = [];
  while (!isGameOver(state) && log.length < maxActions) {
    const seat = activeSeat(state);
    const legal = legalActions(state, seat);
    if (legal.length === 0) throw new Error(`seat ${seat} has nothing to do at action ${log.length}`);
    const action = await seats[seat]!.chooseAction(playerView(state, seat), legal);
    state = applyAction(state, action);
    log.push(action);
  }
  return { state, log, finished: isGameOver(state) };
}
