// The four bottom-row actions: Upgrade, Deploy, Build and Enlist.
//
// Pay the cost one resource at a time from hexes you control, then choose
// what the action does. Taking it also earns the section's coins, and the
// recruit bonus of anyone (you or either neighbor) with a recruit on that
// kind of action. If nothing is left to do (say, every mech is already out),
// you may still pay for the coins and recruit bonuses.
import type { HexId } from './board';
import type { Action, GameState, PlayerState, SectionIndex, TurnStep } from './game';
import { STRUCTURES, upgradeables, type BottomActionType, type RecruitBonus } from './mat';
import { addResources, bottomCost, SECTIONS, controlledHexes, current, gain, structureOn, updatePlayer } from './state';

type BottomStep = Extract<TurnStep, { step: 'bottom' }>;

const BONUS_FIELD: Record<RecruitBonus, 'power' | 'coins' | 'popularity' | 'combatCards'> = {
  power: 'power',
  coins: 'coins',
  popularity: 'popularity',
  combatCard: 'combatCards',
};

export function bottomActions(state: GameState, turn: BottomStep): Action[] {
  const { seat, player, mat } = current(state);
  const cost = bottomCost(player, mat, turn.section);
  if (turn.paid < cost.amount) {
    const sources = [...controlledHexes(state, seat)].filter((hex) => (state.resources[hex]?.[cost.resource] ?? 0) > 0);
    const available = sources.reduce((n, hex) => n + state.resources[hex]![cost.resource]!, 0);
    if (available < cost.amount - turn.paid) return [];
    return sources.map((hex) => ({ type: 'pay', hex }));
  }
  const effects = effectOptions(state, mat.sections[turn.section].bottom.action);
  return effects.length ? effects : [{ type: 'takeBottom' }];
}

/** The bottom-row action is done: the player now ends the turn with End turn. */
const finish = (state: GameState, section: SectionIndex): GameState => ({ ...state, turn: { step: 'end', section } });

export function applyBottom(state: GameState, turn: BottomStep, action: Action): GameState {
  const { seat, mat } = current(state);
  const kind = mat.sections[turn.section].bottom.action;

  if (action.type === 'pay') {
    const resource = bottomCost(state.players[seat]!, mat, turn.section).resource;
    const paid = turn.paid + 1;
    const next: GameState = { ...addResources(state, action.hex, resource, -1), turn: { ...turn, paid } };
    const done = paid >= bottomCost(state.players[seat]!, mat, turn.section).amount;
    if (done && effectOptions(next, kind).length === 0) return finish(rewards(next, turn.section), turn.section);
    return next;
  }

  // Rewards come first, so a recruit placed by this Enlist doesn't pay out on the same action.
  const next = rewards(state, turn.section);
  const player = next.players[seat]!;
  switch (action.type) {
    case 'takeBottom':
      return finish(next, turn.section);
    case 'upgrade':
      return finish(
        updatePlayer(next, seat, {
          upgrades: { top: [...player.upgrades.top, action.top], bottom: [...player.upgrades.bottom, action.bottom] },
        }),
        turn.section,
      );
    case 'deploy':
      return finish(
        updatePlayer(next, seat, { mechs: [...player.mechs, action.hex], mechAbilities: [...player.mechAbilities, action.ability] }),
        turn.section,
      );
    case 'build':
      return finish(updatePlayer(next, seat, { structures: { ...player.structures, [action.structure]: action.hex } }), turn.section);
    case 'enlist': {
      const { faction } = current(next);
      const amount = faction.recruitBonuses.find((r) => r.bonus === action.bonus)?.amount ?? 0;
      return finish(
        updatePlayer(next, seat, {
          ...gain(player, { [BONUS_FIELD[action.bonus]]: amount }),
          recruits: [...player.recruits, action.section],
          recruitBonusesTaken: [...player.recruitBonusesTaken, action.bonus],
        }),
        turn.section,
      );
    }
    default:
      throw new Error(`unreachable: ${action.type} during the bottom row`);
  }
}

/** The section's coins for the current player, and 1 of each matching recruit bonus for them and their neighbors. */
function rewards(state: GameState, section: SectionIndex): GameState {
  const { seat, player, mat } = current(state);
  const kind = mat.sections[section].bottom.action;
  let next = updatePlayer(state, seat, gain(player, { coins: mat.sections[section].bottom.coins }));
  const n = state.players.length;
  for (const who of new Set([seat, (seat + 1) % n, (seat + n - 1) % n])) {
    const theirMat = state.setup.players[who]!.mat;
    const recruited = next.players[who]!.recruits.find((s) => theirMat.sections[s].bottom.action === kind);
    if (recruited === undefined) continue;
    const bonus = theirMat.sections[recruited].bottom.recruitBonus;
    next = updatePlayer(next, who, gain(next.players[who]!, { [BONUS_FIELD[bonus]]: 1 }));
  }
  return next;
}

/** Choices for what the bottom-row action does, once it's paid for. */
function effectOptions(state: GameState, kind: BottomActionType): Action[] {
  const { player, mat, faction } = current(state);
  const workerHexes = [...new Set(player.workers)];
  switch (kind) {
    case 'upgrade': {
      const tops = SECTIONS.flatMap((section) =>
        upgradeables(mat.sections[section].top)
          .filter(([field, u]) => taken(player, section, field) < u.upgraded - u.base)
          .map(([field]) => ({ section, field })),
      );
      const bottoms = SECTIONS.filter(
        (s) => player.upgrades.bottom.filter((b) => b === s).length < mat.sections[s].bottom.upgradeSpaces,
      );
      return tops.flatMap((top) => bottoms.map((bottom): Action => ({ type: 'upgrade', top, bottom })));
    }
    case 'deploy': {
      const abilities = [0, 1, 2, 3].filter((a) => !player.mechAbilities.includes(a));
      return workerHexes.flatMap((hex) => abilities.map((ability): Action => ({ type: 'deploy', hex, ability })));
    }
    case 'build': {
      const structures = STRUCTURES.filter((s) => !player.structures[s]);
      const hexes = workerHexes.filter((hex) => buildable(state, hex));
      return structures.flatMap((structure) => hexes.map((hex): Action => ({ type: 'build', structure, hex })));
    }
    case 'enlist': {
      const sections = SECTIONS.filter((s) => !player.recruits.includes(s));
      const bonuses = faction.recruitBonuses.map((r) => r.bonus).filter((b) => !player.recruitBonusesTaken.includes(b));
      return sections.flatMap((section) => bonuses.map((bonus): Action => ({ type: 'enlist', section, bonus })));
    }
  }
}

const taken = (player: PlayerState, section: SectionIndex, field: string) =>
  player.upgrades.top.filter((u) => u.section === section && u.field === field).length;

/** One structure per hex, and none on lakes or the Factory. */
function buildable(state: GameState, hex: HexId): boolean {
  const terrain = state.setup.board.hexes[hex]?.terrain;
  return terrain !== 'lake' && terrain !== 'factory' && !structureOn(state, hex);
}
