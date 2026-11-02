// Bot seats: they play the real game, each with its faction's personality.
// Each bot implements the seat interface chooseAction(view, legalActions) ->
// Promise<Action> and runs in a Web Worker. So far: the turn planner, which
// lists the whole turns a bot can choose between, and the position score
// that compares them.
export { planTurns, stateKey, type PlanOptions, type PlanResult, type PlanStop, type TurnPlan } from './planner';
export { DEFAULT_WEIGHTS, playerValue, positionScore, type Valuation, type Weights } from './score';
export { planningBot, type BotOptions } from './bot';
export { playMatch, randomSeat, type MatchResult } from './match';
export { BALANCED, PERSONALITIES, personalityFor, weightsOf, type Personality } from './personalities';
