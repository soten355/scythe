import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import { applyAction, newGame, type Action, type GameState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { fightSides } from './fight';

const play = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);
const start = () =>
  newGame({
    seed: 1,
    board: baseBoard,
    players: [
      { faction: baseFactions[0]!, mat: baseMats[0]! },
      { faction: baseFactions[1]!, mat: baseMats[1]! },
    ],
  });

/** Nordic's character (with a mech and a worker it carries) attacks Rusviet's character on A4. */
function fight(): GameState {
  const state = start();
  const [n, r] = state.players;
  const ready: GameState = {
    ...state,
    players: [
      { ...n!, character: 'A5', mechs: ['A5'], workers: ['A5', 'A5'], mechAbilities: [3], power: 4, combatCards: [2, 5] },
      { ...r!, character: 'A4', power: 3, combatCards: [3, 3, 4] },
    ],
  };
  return play(
    ready,
    { type: 'chooseSection', section: 2 },
    { type: 'moveUnit', unit: { kind: 'character' }, to: 'A4' },
    { type: 'carryWorker', unit: { kind: 'mech', index: 0 }, worker: 0 },
    // The second unit moved: the move ends and the fight begins.
    { type: 'moveUnit', unit: { kind: 'mech', index: 0 }, to: 'A4' },
  );
}

describe('the fight screen', () => {
  it('shows nothing outside a fight', () => {
    expect(fightSides(start())).toBeNull();
  });

  it('puts the attacker on the left and the defender on the right, with what each brings', () => {
    const f = fightSides(fight())!;
    expect(f.hex).toBe('A4');
    expect(f.terrain).toBe('forest');
    expect(f.attacker).toMatchObject({ seat: 0, name: 'Nordic', character: true, mechs: 1, workers: 1, power: 4, cards: 2, maxCards: 2, lockedIn: false });
    expect(f.defender).toMatchObject({ seat: 1, name: 'Rusviet', character: true, mechs: 0, workers: 0, power: 3, cards: 3, maxCards: 1, lockedIn: false });
  });

  it('shows who has locked in, without what they chose', () => {
    const f = fightSides(play(fight(), { type: 'combatPower', power: 2 }))!;
    expect(f.attacker.lockedIn).toBe(true);
    expect(f.defender.lockedIn).toBe(false);
  });
});
