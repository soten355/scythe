// A saved game: its setup plus every move made, grouped the way they were
// made (each group is one undo step). Replaying the moves rebuilds the game,
// so a save is small, and a file can't hold a position the rules don't allow.
import { applyAction, ENGINE_VERSION, isGameOver, newGame, type Action, type GameSetup, type GameState } from '@scythe/engine';

const FORMAT = 'scythe-save';
const FORMAT_VERSION = 1;

export interface SaveSummary {
  factions: { name: string; color: string }[];
  round: number;
}

export interface SavedGame {
  format: typeof FORMAT;
  formatVersion: number;
  id: string;
  /** The rules the moves were played under. */
  engineVersion: string;
  /** ISO dates. */
  created: string;
  updated: string;
  /**
   * The whole map, factions and mats, not just their ids, so a game made with
   * custom or edited ones opens on any device, and later changes to the
   * built-in content don't change a game already under way.
   */
  setup: GameSetup;
  /** Every move, in order; each inner list is applied as one step. */
  steps: Action[][];
  /** Step where undo stops (see Game.svelte). */
  turnStart: number;
  finished: boolean;
  /** For the saved games list, without replaying. */
  summary: SaveSummary;
}

const roundOf = (state: GameState) => Math.floor(state.turnsTaken / state.players.length) + 1;

function summarize(state: GameState): SaveSummary {
  return {
    factions: state.setup.players.map((p) => ({ name: p.faction.name, color: p.faction.color })),
    round: roundOf(state),
  };
}

export function createSave(setup: GameSetup, id: string, now: Date): SavedGame {
  const state = newGame(setup);
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    id,
    engineVersion: ENGINE_VERSION,
    created: now.toISOString(),
    updated: now.toISOString(),
    setup,
    steps: [],
    turnStart: 0,
    finished: false,
    summary: summarize(state),
  };
}

/** The save after more moves (or undos); `state` is where the steps lead. */
export function updateSave(save: SavedGame, steps: Action[][], turnStart: number, state: GameState, now: Date): SavedGame {
  return {
    ...save,
    engineVersion: ENGINE_VERSION,
    updated: now.toISOString(),
    steps,
    turnStart,
    finished: isGameOver(state),
    summary: summarize(state),
  };
}

/** Every state the game passed through, one per step. Throws, in plain words, if a move isn't legal. */
export function restore(save: SavedGame): { history: GameState[]; turnStart: number } {
  const history = [newGame(save.setup)];
  save.steps.forEach((step, i) => {
    let state = history[history.length - 1]!;
    try {
      for (const action of step) state = applyAction(state, action);
    } catch {
      const old = save.engineVersion !== ENGINE_VERSION ? ` It was saved with rules version ${save.engineVersion}; this app has version ${ENGINE_VERSION}, and the rules have changed since.` : '';
      throw new Error(`This save can't be replayed: move ${i + 1} isn't allowed by the rules.${old}`);
    }
    history.push(state);
  });
  return { history, turnStart: Math.max(0, Math.min(save.turnStart, history.length - 1)) };
}

export const saveFileText = (save: SavedGame) => JSON.stringify(save);

/** "scythe-nordic-rusviet-2026-11-01.scythe.json" */
export function fileName(save: SavedGame): string {
  const names = save.summary.factions.map((f) => f.name.toLowerCase().replace(/[^a-z0-9]+/g, '')).join('-');
  return `scythe-${names}-${save.updated.slice(0, 10)}.scythe.json`;
}

/** Reads a save file, checking it by replaying every move. Throws, in plain words, if it's not a good save. */
export function parseSaveFile(text: string): SavedGame {
  const notSave = new Error("This file isn't a Scythe save.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw notSave;
  }
  const save = data as SavedGame;
  if (
    !save ||
    typeof save !== 'object' ||
    save.format !== FORMAT ||
    typeof save.id !== 'string' ||
    typeof save.created !== 'string' ||
    typeof save.updated !== 'string' ||
    !save.setup ||
    !Array.isArray(save.steps) ||
    !save.steps.every(Array.isArray)
  ) {
    throw notSave;
  }
  if (save.formatVersion > FORMAT_VERSION) throw new Error('This save was made by a newer version of the app. Update the app to open it.');
  let history: GameState[];
  try {
    history = restore(save).history;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("This save can't")) throw e;
    throw notSave;
  }
  // The list's summary comes from the replayed game, not from what the file says.
  const last = history[history.length - 1]!;
  return { ...save, finished: isGameOver(last), summary: summarize(last) };
}
