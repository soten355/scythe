// Simulation runner (Node). For now: plays random legal turns with the real
// board, Nordic + Rusviet on the Industrial + Engineering mats, and prints
// them, as a quick look at the actions.
import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import { activeSeat, applyAction, ENGINE_VERSION, legalActions, newGame, nextInt, type Action } from '@scythe/engine';

const turns = 12;
let state = newGame({
  seed: 1,
  board: baseBoard,
  players: [
    { faction: baseFactions[0]!, mat: baseMats[0]! },
    { faction: baseFactions[1]!, mat: baseMats[1]! },
  ],
});
let rng = state.rng;

const describe = (a: Action): string => {
  switch (a.type) {
    case 'chooseSection': return `section ${a.section + 1}`;
    case 'moveUnit': return `moves ${a.unit.kind} to ${a.to}`;
    case 'tradeResource': return `trades for ${a.resource} on ${a.hex}`;
    case 'produce': return `produces on ${a.hex}`;
    case 'bolster': return `bolsters ${a.gain}`;
    case 'pay': return `pays from ${a.hex}`;
    case 'upgrade': return `upgrades section ${a.top.section + 1} ${a.top.field}`;
    case 'deploy': return `deploys a mech on ${a.hex}`;
    case 'build': return `builds a ${a.structure} on ${a.hex}`;
    case 'enlist': return `enlists for ${a.bonus}`;
    case 'fight': return `fights on ${a.hex}`;
    case 'combatCard': return `card ${a.value}`;
    case 'combatPower': return `dials ${a.power}`;
    default: return a.type;
  }
};

console.log(`engine ${ENGINE_VERSION}: ${turns} random turns\n`);
while (state.turnsTaken < turns) {
  const seat = state.currentPlayer;
  const steps: string[] = [];
  do {
    // Usually the player whose turn it is; in a fight, the defender chooses too.
    const actor = activeSeat(state);
    const options = legalActions(state, actor);
    let pick: number;
    [pick, rng] = nextInt(rng, options.length);
    const action = options[pick]!;
    steps.push(actor === seat ? describe(action) : `(player ${actor + 1} ${describe(action)})`);
    const before = state.lastCombat;
    state = applyAction(state, action);
    if (state.lastCombat !== before) steps.push(`player ${state.lastCombat!.winner + 1} wins on ${state.lastCombat!.hex}`);
  } while (state.currentPlayer === seat);
  const p = state.players[seat]!;
  console.log(`turn ${state.turnsTaken}: player ${seat + 1} → ${steps.join(', ')}`);
  console.log(`   coins ${p.coins}, power ${p.power}, popularity ${p.popularity}, workers ${p.workers.length}`);
}
