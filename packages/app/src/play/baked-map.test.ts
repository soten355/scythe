import { describe, expect, it } from 'vitest';
import { bakeArea, bakeScale, coverRect } from './baked-map';
import { corners, HEX_WIDTH } from './geometry';

describe('a picture cropped to a hex', () => {
  const box = { x: 10, y: 20, width: 100, height: 100 };

  it('fills a box of its own shape exactly', () => {
    expect(coverRect(box, 512, 512)).toEqual(box);
  });

  it('keeps its shape and crops the sides when it is too wide', () => {
    expect(coverRect(box, 200, 100)).toEqual({ x: -40, y: 20, width: 200, height: 100 });
  });

  it('keeps its shape and crops the top and bottom when it is too tall', () => {
    expect(coverRect(box, 100, 200)).toEqual({ x: 10, y: -30, width: 100, height: 200 });
  });
});

describe('the one picture all the hexes are painted into', () => {
  it('covers every hex and nothing more', () => {
    const area = bakeArea([corners([0, 0]), corners([100, 50])]);
    const all = [...corners([0, 0]), ...corners([100, 50])];
    expect(area.x).toBeCloseTo(Math.min(...all.map((p) => p[0])));
    expect(area.y).toBeCloseTo(Math.min(...all.map((p) => p[1])));
    expect(area.x + area.width).toBeCloseTo(Math.max(...all.map((p) => p[0])));
    expect(area.y + area.height).toBeCloseTo(Math.max(...all.map((p) => p[1])));
  });

  it("is as sharp as the art itself: a hex's picture keeps its pixels", () => {
    const area = { x: 0, y: 0, width: HEX_WIDTH * 4, height: HEX_WIDTH * 3 };
    expect(bakeScale(area, 452, 4096) * HEX_WIDTH).toBeCloseTo(452);
  });

  it('is never larger than the most a phone handles well', () => {
    const area = { x: 0, y: 0, width: HEX_WIDTH * 20, height: HEX_WIDTH * 10 };
    const scale = bakeScale(area, 452, 4096);
    expect(area.width * scale).toBeCloseTo(4096);
  });
});
