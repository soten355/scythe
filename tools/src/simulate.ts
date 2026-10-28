// Simulation / balance runner (Node). Placeholder until the engine can play
// games; for now it just proves the workspace wiring works.
import { ENGINE_VERSION, nextInt, seedRng } from '@scythe/engine';

const [roll] = nextInt(seedRng(1), 6);
console.log(`engine ${ENGINE_VERSION} loaded; sample roll with seed 1: ${roll}`);
