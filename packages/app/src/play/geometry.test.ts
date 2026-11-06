import { describe, expect, it } from 'vitest';
import { center, corners, HEX_HEIGHT, HEX_VIEWBOX, HEX_WIDTH, SIZE } from './geometry';

describe('the hex art box', () => {
  it("is exactly a hex's own size, so a picture fitted to it keeps its shape", () => {
    const pts = corners(center({ q: 2, r: 3 }));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(HEX_WIDTH);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(HEX_HEIGHT);
    expect(HEX_HEIGHT).toBe(SIZE * 2);
    expect(HEX_VIEWBOX).toBe(`0 0 ${HEX_WIDTH} ${HEX_HEIGHT}`);
  });
});
