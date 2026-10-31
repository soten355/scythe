// Where the current player is in their turn, for the side panel and the mat.
// Choosing a section isn't binding: until you take your first action you can
// tap another section on the mat to switch.
import { legalActions, type Action, type GameState, type SectionIndex } from '@scythe/engine';

export type Phase = 'choose' | 'top' | 'bottom';

export function phase(state: GameState): Phase {
  const step = state.turn.step;
  return step === 'chooseSection' ? 'choose' : step === 'bottom' || step === 'end' ? 'bottom' : 'top';
}

/**
 * The states so far, and where the current turn began (or, mid-turn, where
 * play last passed to another seat, such as a defender in a fight). Picking a
 * section is the turn's first entry; if nothing has happened since, it can be
 * replaced.
 */
export function canSwitchSection(history: GameState[], turnStart: number): boolean {
  return history.length - 1 === turnStart + 1 && phase(history[turnStart]!) === 'choose' && phase(history[turnStart + 1]!) !== 'choose';
}

/** The sections the current player may pick now (to start, or to switch to). */
export function sectionChoices(history: GameState[], turnStart: number): Action[] {
  const now = history[history.length - 1]!;
  const from = phase(now) === 'choose' ? now : canSwitchSection(history, turnStart) ? history[turnStart]! : null;
  return from ? legalActions(from, from.currentPlayer).filter((a) => a.type === 'chooseSection') : [];
}

/** The section the player can't pick this turn (the one they used last turn). */
export const previousSection = (history: GameState[], turnStart: number): SectionIndex | null =>
  history[turnStart]!.players[history[turnStart]!.currentPlayer]!.lastSection;
