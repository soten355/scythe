import { describe, expect, it } from 'vitest';
import { turnedPoint, turnedRect } from './frame';

// A phone held upright, 390 wide: the game lies on its side, its left edge along the phone's top.
const screenWidth = 390;

describe('the game turned on an upright phone', () => {
  it("puts the game's top-left corner at the screen's top-right", () => {
    expect(turnedPoint(390, 0, screenWidth)).toEqual([0, 0]);
  });

  it("puts the game's bottom-left corner at the screen's top-left", () => {
    expect(turnedPoint(0, 0, screenWidth)).toEqual([0, 390]);
  });

  it("puts the game's top-right corner at the screen's bottom-right", () => {
    expect(turnedPoint(390, 844, screenWidth)).toEqual([844, 0]);
  });

  it('swaps a box from how the screen sees it to how the game sees it', () => {
    // On screen: 100 wide and 300 tall, 40 from the right edge and 20 from the top.
    const box = { left: 250, right: 350, top: 20, bottom: 320, width: 100, height: 300 };
    expect(turnedRect(box, screenWidth)).toEqual({ left: 20, right: 320, top: 40, bottom: 140, width: 300, height: 100 });
  });
});
