import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import { applyAction, legalActions, newGame, type Action, type GameState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { buildPrompt, label } from './prompt';

// Nordic (home "ne": workers on A4, A5) on Industrial; Rusviet on Engineering.
const start = () =>
  newGame({
    seed: 1,
    board: baseBoard,
    players: [
      { faction: baseFactions[0]!, mat: baseMats[0]! },
      { faction: baseFactions[1]!, mat: baseMats[1]! },
    ],
  });
const play = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);
const prompt = (state: GameState, sel = {}) => buildPrompt(state, legalActions(state, state.currentPlayer), sel);

describe('the prompt', () => {
  it('points to the mat at the start of a turn, with no buttons', () => {
    const p = prompt(start());
    expect(p.title).toBe('Nordic: select an action from your mat');
    expect(p.buttons).toEqual([]);
    expect(p.highlights.size).toBe(0);
  });

  it('highlights hexes with units to move, and offers coins instead', () => {
    const state = play(start(), { type: 'chooseSection', section: 2 });
    const p = prompt(state);
    expect([...p.highlights].sort()).toEqual(['A4', 'A5', 'home']);
    expect(p.buttons.map((b) => b.label)).toEqual(['Gain 1 coin instead', 'Skip the top action']);
  });

  it('selects the only unit on a tapped hex, then highlights where it can go', () => {
    const state = play(start(), { type: 'chooseSection', section: 2 });
    const p = prompt(state, { hex: 'home' });
    expect(p.selected).toBe('home');
    expect([...p.tapActions.keys()].sort()).toEqual(['A4', 'A5']);
    expect(p.tapActions.get('A4')).toEqual({ type: 'moveUnit', unit: { kind: 'character' }, to: 'A4' });
  });

  it('lets you tap a piece itself to pick that unit', () => {
    const state = play(start(), { type: 'chooseSection', section: 2 });
    const p = prompt(state);
    expect(p.pieces?.get('home|character')).toEqual({ hex: 'home', unit: { kind: 'character' } });
    expect(p.pieces?.get('A4|worker')).toEqual({ hex: 'A4', unit: { kind: 'worker', index: 0 } });
  });

  it('with a unit picked, tapping a hex only moves it; switching is done by tapping another piece', () => {
    const state = play(start(), { type: 'chooseSection', section: 2 });
    const p = prompt(state, { hex: 'A4', unit: { kind: 'worker', index: 0 } });
    expect(p.selectedPiece).toBe('A4|worker');
    // A5 has the other worker, but it's also where this one can go: tapping the hex moves.
    expect(p.tapActions.get('A5')).toMatchObject({ type: 'moveUnit', to: 'A5' });
    expect(p.tapSelects.size).toBe(0);
    expect(p.pieces?.get('A5|worker')).toEqual({ hex: 'A5', unit: { kind: 'worker', index: 1 } });
    expect(p.pieces?.get('home|character')).toEqual({ hex: 'home', unit: { kind: 'character' } });
  });

  it('keeps the loading unit selected until it moves', () => {
    let state = play(start(), { type: 'chooseSection', section: 3 }, { type: 'tradeResource', resource: 'food', hex: 'A4' },
      { type: 'tradeResource', resource: 'food', hex: 'A4' }, { type: 'skipBottom' }, { type: 'chooseSection', section: 3 },
      { type: 'gainCoins' }, { type: 'skipBottom' }, { type: 'chooseSection', section: 2 });
    state = play(state, { type: 'carryResource', unit: { kind: 'worker', index: 0 }, resource: 'food' });
    const p = prompt(state, {});
    expect(p.buttons.map((b) => b.label)).toEqual(['Pick up 1 food']);
    expect(p.tapActions.size).toBeGreaterThan(0);
  });

  it('keeps the trading hex selected for the second resource', () => {
    const state = play(start(), { type: 'chooseSection', section: 3 }, { type: 'tradeResource', resource: 'oil', hex: 'A4' });
    const p = prompt(state);
    expect(p.selected).toBe('A4');
    expect([...p.highlights]).toEqual(['A4']);
    expect(p.buttons.map((b) => b.label)).toEqual(['Take 1 oil', 'Take 1 metal', 'Take 1 wood', 'Take 1 food']);
  });


  it('names mech abilities and recruit bonuses in plain words', () => {
    const state = start();
    expect(label(state, { type: 'deploy', hex: 'A4', ability: 3 })).toBe('Mech: Speed');
    expect(label(state, { type: 'enlist', section: 1, bonus: 'power' })).toBe('Recruit on Deploy (then +1 coins); now +2 power');
  });
});

describe('producing', () => {
  // Nordic's Produce is section 1 (2 hexes); workers stand on A4 (forest) and A5 (tundra).
  const producing = () => play(start(), { type: 'chooseSection', section: 1 });
  const applyAll = (state: GameState, actions: Action[] = []) => play(state, ...actions);

  it('lets you pick hexes first, with empty slots for each one allowed', () => {
    const p = prompt(producing());
    expect([...p.highlights].sort()).toEqual(['A4', 'A5']);
    expect(p.slots).toEqual([{ empty: 'Tap a hex to produce' }, { empty: 'Tap a hex to produce' }]);
    expect(p.tapSelects.get('A4')).toEqual({ produce: ['A4'] });
    expect(p.buttons.map((b) => b.label)).toEqual(['Skip the top action']);
  });

  it('fills a slot per picked hex with what it will make, and produces them all at once', () => {
    const p = prompt(producing(), { produce: ['A4'] });
    expect(p.slots).toEqual([{ text: 'A4: 1 wood', icon: { text: '🪵' }, remove: { produce: [] } }, { empty: 'Tap a hex to produce' }]);
    expect(p.marked).toEqual(new Set(['A4']));
    // Tapping a picked hex again un-picks it.
    expect(p.tapSelects.get('A4')).toEqual({ produce: [] });
    const go = p.buttons.find((b) => b.label === 'Produce')!;
    expect(go.actions).toEqual([{ type: 'produce', hex: 'A4' }, { type: 'endProduce' }]);
    expect(applyAll(producing(), go.actions).turn.step).toBe('bottom');
  });

  it('stops offering more hexes once every slot is filled', () => {
    const p = prompt(producing(), { produce: ['A5', 'A4'] });
    expect([...p.highlights].sort()).toEqual(['A4', 'A5']);
    expect([...p.tapSelects.keys()].sort()).toEqual(['A4', 'A5']);
    const go = p.buttons.find((b) => b.label === 'Produce')!;
    const after = applyAll(producing(), go.actions);
    expect(after.resources).toEqual({ A5: { oil: 1 }, A4: { wood: 1 } });
    expect(after.turn.step).toBe('bottom');
  });
});

// Bottom-row actions: pay by tapping hexes, pick what to do, then press the action's button.
const filled = (p: ReturnType<typeof prompt>) => (p.slots ?? []).flatMap((s) => ('text' in s ? [s] : []));
const texts = (p: ReturnType<typeof prompt>) => filled(p).map((s) => s.text);
const button = (p: ReturnType<typeof prompt>, label: string) => p.buttons.find((b) => b.label === label);
const pays = (hexes: string[]): Action[] => hexes.map((hex) => ({ type: 'pay', hex }));

describe('paying for a bottom action', () => {
  // Nordic's Deploy (section 1) costs 3 metal; their workers stand on A4 and A5.
  const deploying = () => {
    const state = play(start(), { type: 'chooseSection', section: 1 }, { type: 'skipTop' });
    return { ...state, resources: { A4: { metal: 2 }, A5: { metal: 2 } } };
  };

  it('shows an empty slot per resource owed, filled by tapping hexes', () => {
    const p = prompt(deploying());
    expect(p.slots).toEqual(Array(3).fill({ empty: 'Tap a hex to pay 1 metal' }));
    expect([...p.highlights].sort()).toEqual(['A4', 'A5']);
    expect(p.tapSelects.get('A4')).toEqual({ pay: ['A4'] });
    expect(p.buttons).toEqual([]);
    expect(p.end).toEqual({ label: 'End turn', action: { type: 'skipBottom' }, confirm: 'Are you sure? You can still take your bottom-row action.' });
  });

  it('takes picked resources off the board for now, before the action is confirmed', () => {
    expect(prompt(deploying()).preview).toBeUndefined();
    const p = prompt(deploying(), { pay: ['A4'] });
    expect(p.preview?.resources).toEqual({ A4: { metal: 1 }, A5: { metal: 2 } });
  });

  it("stops offering a hex once it's used up, and lets a slot be removed", () => {
    const p = prompt(deploying(), { pay: ['A4', 'A4'] });
    expect(texts(p)).toEqual(['1 metal from A4', '1 metal from A4']);
    expect([...p.highlights]).toEqual(['A5']);
    expect(filled(p)[0]?.remove).toEqual({ pay: ['A4'] });
  });

  it('once paid, lets you pick a hex and a mech, then deploy with one button', () => {
    const pay = ['A4', 'A4', 'A5'];
    const p = prompt(deploying(), { pay });
    expect(texts(p)).toHaveLength(3);
    expect(p.slots?.at(-1)).toEqual({ empty: "Tap a worker's hex for the mech" });
    expect([...p.highlights].sort()).toEqual(['A4', 'A5']);
    expect(p.tapSelects.get('A5')).toEqual({ pay, hex: 'A5' });
    expect(button(p, 'Deploy')).toBeUndefined();

    const onB6 = prompt(deploying(), { pay, hex: 'A5' });
    const effect: Action = { type: 'deploy', hex: 'A5', ability: 0 };
    const mech = onB6.buttons.find((b) => b.label.startsWith('Mech:'))!;
    expect(mech.select).toEqual({ pay, hex: 'A5', effect });

    expect(onB6.slots?.at(-1)).toEqual({ text: 'Mech goes on A5', remove: { pay } });
    // Paid in full: the paying hexes stop standing out, so the mech's hex can be seen.
    expect(p.marked).toBeUndefined();
    expect(onB6.marked).toBeUndefined();

    // Picked: the other mechs grey out, and Deploy comes last.
    const picked = prompt(deploying(), mech.select);
    expect(picked.buttons.filter((b) => b.label.startsWith('Mech:')).map((b) => [!!b.chosen, !!b.dim])).toEqual([
      [true, false], [false, true], [false, true], [false, true],
    ]);
    const deploy = picked.buttons.at(-1)!;
    expect(deploy).toMatchObject({ label: 'Deploy', primary: true });
    expect(deploy.actions).toEqual([...pays(pay), effect]);
    expect(play(deploying(), ...deploy.actions!).players[0]!.mechs).toEqual(['A5']);
  });
});

describe('upgrading', () => {
  // Nordic's Upgrade (section 0) costs 3 oil.
  const upgrading = () => {
    const state = play(start(), { type: 'chooseSection', section: 0 }, { type: 'skipTop' });
    return { ...state, resources: { A5: { oil: 3 } } };
  };
  const pay = ['A5', 'A5', 'A5'];

  it('offers any top-row value and any bottom-row cost with room, picked on the mat in any combination', () => {
    const p = prompt(upgrading(), { pay });
    const tops = p.upgrade!.tops;
    const bottoms = p.upgrade!.bottoms;
    expect(tops.length).toBeGreaterThan(1);
    expect(bottoms.length).toBeGreaterThan(1);
    expect(texts(p)).toHaveLength(3);
    expect(p.slots?.slice(3)).toEqual([
      { empty: 'Tap a glowing top-row value on your mat' },
      { empty: 'Tap a glowing bottom-row cost on your mat' },
    ]);

    // Pick the last top value and the first bottom cost, which belong to different sections.
    const top = tops.at(-1)!.top;
    const low = bottoms[0]!.section;
    const half = prompt(upgrading(), tops.at(-1)!.select);
    expect(half.upgrade!.tops.at(-1)!.chosen).toBe(true);
    expect(button(half, 'Upgrade')).toBeUndefined();

    const both = prompt(upgrading(), half.upgrade!.bottoms[0]!.select);
    expect(both.upgrade!.bottoms[0]!.chosen).toBe(true);
    const go = both.buttons.at(-1)!;
    expect(go).toMatchObject({ label: 'Upgrade', primary: true });
    expect(go.actions).toEqual([...pays(pay), { type: 'upgrade', top, bottom: low }]);
    expect(play(upgrading(), ...go.actions!).players[0]!.upgrades).toEqual({ top: [top], bottom: [low] });
  });
});

describe('enlisting', () => {
  // Nordic's Enlist (section 3) costs 4 food.
  const enlisting = () => ({ ...play(start(), { type: 'chooseSection', section: 3 }, { type: 'tradePopularity' }), resources: { A4: { food: 4 } } });
  const pay = ['A4', 'A4', 'A4', 'A4'];

  it('lights up the recruit spots on the mat, with their ongoing bonus', () => {
    const p = prompt(enlisting(), { pay });
    expect(p.enlist?.map((e) => e.section)).toEqual([0, 1, 2, 3]);
    expect(p.enlist?.[0]).toMatchObject({ bonus: 'power', chosen: false, select: { pay, recruit: 0 } });
    expect(p.slots?.slice(-2)).toEqual([{ empty: 'Tap a glowing recruit spot on your mat' }, { empty: 'Then choose a one-time bonus' }]);
    expect(p.choice).toBeUndefined();
  });

  it('asks for the one-time bonus once a spot is picked, then enlists with one button', () => {
    const p = prompt(enlisting(), { pay, recruit: 1 });
    expect(p.enlist?.find((e) => e.chosen)?.section).toBe(1);
    expect(p.choice?.options.map((o) => o.label)).toEqual(['+2 power', '+2 coins', '+2 popularity', '+2 combat cards']);
    expect(p.choice?.cancel).toEqual({ pay });
    const effect = p.choice!.options[2]!.select.effect;
    expect(effect).toEqual({ type: 'enlist', section: 1, bonus: 'popularity' });

    const picked = prompt(enlisting(), p.choice!.options[2]!.select);
    expect(picked.choice).toBeUndefined();
    expect(texts(picked).slice(-2)).toEqual(['Recruit on Deploy: +1 coin each time', 'Now: +2 popularity']);
    const enlist = picked.buttons.at(-1)!;
    expect(enlist).toMatchObject({ label: 'Enlist', primary: true });
    expect(enlist.actions).toEqual([...pays(pay), effect]);
    expect(play(enlisting(), ...enlist.actions!).players[0]!.recruits).toEqual([1]);
  });
});

describe('ending the turn', () => {
  it("doesn't ask when the bottom-row action can't be afforded", () => {
    // Nordic's Deploy costs 3 metal, and they have none.
    const state = play(start(), { type: 'chooseSection', section: 1 }, { type: 'skipTop' });
    const p = prompt(state);
    expect(p.title).toBe("Nordic · Deploy: can't deploy, need 3 more metal");
    // Nothing else to do, so End turn is the main button.
    expect(p.end).toEqual({ label: 'End turn', action: { type: 'skipBottom' }, primary: true });
  });

  it('waits for End turn after a bottom-row action, shown as the main button', () => {
    const state = { ...play(start(), { type: 'chooseSection', section: 1 }, { type: 'skipTop' }), resources: { A4: { metal: 3 } } };
    const pay: Action = { type: 'pay', hex: 'A4' };
    const done = play(state, pay, pay, pay, { type: 'deploy', hex: 'A4', ability: 0 });
    const p = prompt(done);
    expect(p.title).toBe('Nordic · Deploy done: end your turn');
    expect(p.buttons).toEqual([]);
    expect(p.end).toEqual({ label: 'End turn', action: { type: 'endTurn' }, primary: true });
  });
});

describe("a top-row action that can't be paid for", () => {
  it('says what more is needed, leaving only the skip', () => {
    const s0 = play(start(), { type: 'chooseSection', section: 3 });
    const broke = { ...s0, players: s0.players.map((p, i) => (i === 0 ? { ...p, coins: 0 } : p)) };
    const p = prompt(broke);
    expect(p.title).toBe("Nordic · Trade: can't trade, need 1 more coin");
    expect(p.buttons.map((b) => b.label)).toEqual(['Skip the top action']);
  });
});

describe('trading', () => {
  // Nordic's Trade (section 3): pay 1 coin for 2 resources, or popularity instead.
  const trading = () => play(start(), { type: 'chooseSection', section: 3 });

  it('shows a slot per resource, filled by tapping a worker hex and choosing', () => {
    const p = prompt(trading());
    expect(p.slots).toEqual(Array(2).fill({ empty: "Tap a worker's hex, then choose a resource" }));
    expect([...p.highlights].sort()).toEqual(['A4', 'A5']);
    expect(p.tapSelects.get('A4')).toEqual({ trade: { hex: 'A4', resources: [] } });
    expect(p.buttons.map((b) => b.label)).toEqual(['Gain 1 popularity instead', 'Skip the top action']);

    const onB5 = prompt(trading(), { trade: { hex: 'A4', resources: ['oil'] } });
    expect(onB5.selected).toBe('A4');
    expect(onB5.slots).toEqual([
      { text: '1 oil on A4', icon: { text: '🛢️' }, remove: { trade: { hex: 'A4', resources: [] } } },
      { empty: 'Choose a resource below' },
    ]);
    expect(onB5.buttons.map((b) => b.label)).toEqual(['Take 1 oil', 'Take 1 metal', 'Take 1 wood', 'Take 1 food', 'Gain 1 popularity instead', 'Skip the top action']);
    expect(onB5.buttons[4]!.confirm).toBe('Are you sure? You picked resources to trade; gain popularity instead?');
  });

  it('trades both picked resources onto the hex with one button', () => {
    const p = prompt(trading(), { trade: { hex: 'A4', resources: ['oil', 'food'] } });
    expect(p.buttons.map((b) => b.label)).toEqual(['Trade', 'Gain 1 popularity instead', 'Skip the top action']);
    const after = play(trading(), ...p.buttons[0]!.actions!);
    expect(after.resources).toEqual({ A4: { oil: 1, food: 1 } });
    expect(after.turn.step).toBe('bottom');
  });
});
