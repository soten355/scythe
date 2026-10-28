// Simulation runner (Node). For now: plays random legal turns and prints
// them, as a quick look at the turn structure.
import { applyAction, ENGINE_VERSION, legalActions, newGame, nextInt, type Action } from '@scythe/engine';

const players = 3;
const turns = 9;
let state = newGame({ seed: 1, players });
let rng = state.rng;

const describe = (a: Action) => {
  switch (a.type) {
    case 'chooseSection': return `section ${a.section + 1}`;
    case 'takeTop': return 'top action';
    case 'skipTop': return 'skips top';
    case 'takeBottom': return 'bottom action';
    case 'skipBottom': return 'skips bottom';
  }
};

console.log(`engine ${ENGINE_VERSION}: ${players} players, ${turns} random turns\n`);
while (state.turnsTaken < turns) {
  const seat = state.currentPlayer;
  const steps: string[] = [];
  do {
    const options = legalActions(state, seat);
    let pick: number;
    [pick, rng] = nextInt(rng, options.length);
    const action = options[pick]!;
    steps.push(describe(action));
    state = applyAction(state, action);
  } while (state.currentPlayer === seat);
  console.log(`turn ${state.turnsTaken}: player ${seat + 1} → ${steps.join(', ')}`);
}
