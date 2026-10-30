import { baseBoard, baseFactions, baseMats } from '@scythe/content';
import { applyAction, legalActions, newGame, type Action, type GameState } from '@scythe/engine';
import { describe, expect, it } from 'vitest';
import { fitView, guide, panBy, worldOf, zoomAt, type Limits, type View } from './camera';
import { buildPrompt } from './prompt';

const world: View = { x: 0, y: 0, w: 1000, h: 800 };
const limits: Limits = { world, minW: 100 };
const aspect = 2; // a wide phone-landscape map area
const centre = (v: View) => [v.x + v.w / 2, v.y + v.h / 2];

describe('fitting a view', () => {
  it('covers the area asked for, shaped like the screen', () => {
    const v = fitView({ x: 400, y: 300, w: 200, h: 200 }, aspect, limits);
    expect(v.w / v.h).toBeCloseTo(aspect);
    expect(v.x).toBeLessThanOrEqual(400);
    expect(v.x + v.w).toBeGreaterThanOrEqual(600);
    expect(v.y).toBeLessThanOrEqual(300);
    expect(v.y + v.h).toBeGreaterThanOrEqual(500);
    expect(centre(v)).toEqual([500, 400]);
  });

  it("doesn't zoom in closer than the limit", () => {
    const v = fitView({ x: 500, y: 400, w: 10, h: 10 }, aspect, limits);
    expect(v.w).toBe(100);
  });

  it("doesn't zoom out past the whole map", () => {
    const v = fitView({ x: -5000, y: -5000, w: 20000, h: 20000 }, aspect, limits);
    // The whole 1000 x 800 map, shaped 2:1, needs 1600 x 800.
    expect([v.w, v.h]).toEqual([1600, 800]);
    expect(centre(v)).toEqual([500, 400]);
  });
});

describe('zooming and panning', () => {
  const v: View = { x: 200, y: 200, w: 400, h: 200 };

  it('zooms around a point, keeping that point where it was on screen', () => {
    const z = zoomAt(v, 0.5, [300, 250], aspect, limits);
    expect(z.w).toBe(200);
    // [300, 250] was a quarter of the way across and down; it still is.
    expect(worldOf(z, [0.25, 0.25])).toEqual([300, 250]);
  });

  it("stops at the limits and doesn't drift off the map", () => {
    expect(zoomAt(v, 0.01, [300, 250], aspect, limits).w).toBe(100);
    const far = panBy(v, 5000, 5000, limits);
    const [cx, cy] = centre(far);
    expect(cx).toBeLessThanOrEqual(1000);
    expect(cy).toBeLessThanOrEqual(800);
  });
});

// Nordic (home "ne": workers on A4, A5) on Industrial: 0 bolster/upgrade, 1 produce/deploy, 2 move/build, 3 trade/enlist.
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
const guided = (state: GameState, sel = {}) => guide(state, buildPrompt(state, legalActions(state, state.currentPlayer), sel));
const sorted = (g: ReturnType<typeof guided>) => [...(g?.spots ?? [])].sort();

describe('guiding the view', () => {
  it("shows the player's units when their turn starts", () => {
    const g = guided(start());
    expect(sorted(g)).toEqual(['A4', 'A5', 'home']);
  });

  it('moves to the hexes the chosen top-row action works on, each time the choice changes', () => {
    const produce = guided(play(start(), { type: 'chooseSection', section: 1 }));
    const trade = guided(play(start(), { type: 'chooseSection', section: 3 }));
    expect(sorted(produce)).toEqual(['A4', 'A5']);
    expect(produce?.key).not.toBe(trade?.key);
    expect(produce?.key).not.toBe(guided(start())?.key);
  });

  it('falls back to your units when the action has no hexes (Bolster)', () => {
    expect(sorted(guided(play(start(), { type: 'chooseSection', section: 0 })))).toEqual(['A4', 'A5', 'home']);
  });

  it("stays put when a pick doesn't change where to look", () => {
    const state = play(start(), { type: 'chooseSection', section: 1 });
    expect(guided(state, { produce: ['A4'] })?.key).toBe(guided(state)?.key);
  });

  it('follows each step of an action: the picked unit and where it can go, then the units left to move', () => {
    const state = play(start(), { type: 'chooseSection', section: 2 });
    const all = guided(state);
    // The character at home can reach A4 and A5: the same hexes already in view, so no need to move.
    const character = guided(state, { hex: 'home', unit: { kind: 'character' } });
    expect(sorted(character)).toEqual(['A4', 'A5', 'home']);
    // A worker on A4 can go elsewhere: the camera follows.
    const worker = guided(state, { hex: 'A4', unit: { kind: 'worker', index: 0 } });
    expect(worker?.key).not.toBe(all?.key);
    expect(worker?.spots).toContain('A4');
    expect(worker?.spots).not.toContain('home');
    // After moving the character to A4, the camera looks at what's left to do.
    const moved = guided(play(state, { type: 'moveUnit', unit: { kind: 'character' }, to: 'A4' }));
    expect(moved?.key).not.toBe(all?.key);
  });

  it('moves to the bottom-row hexes after the top action: first where to pay from, then where it happens', () => {
    const state = { ...play(start(), { type: 'chooseSection', section: 1 }, { type: 'skipTop' }), resources: { A4: { metal: 3 } } };
    const paying = guided(state);
    expect(sorted(paying)).toEqual(['A4']);
    const deploying = guided(state, { pay: ['A4', 'A4', 'A4'] });
    expect(deploying?.key).not.toBe(paying?.key);
    expect(sorted(deploying)).toEqual(['A4', 'A5']);
  });
});
