// Bot seats: they play the real game, each with its faction's personality.
// Each bot implements the seat interface chooseAction(view, legalActions) ->
// Promise<Action> and runs in a Web Worker. So far: the turn planner, which
// lists the whole turns a bot can choose between.
export { planTurns, stateKey, type PlanOptions, type PlanResult, type PlanStop, type TurnPlan } from './planner';
