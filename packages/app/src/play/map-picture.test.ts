import { describe, expect, it } from 'vitest';
import { baseBoard } from '@scythe/content';
import { center, corners } from './geometry';
import { MAP_PICTURE, mapPictureFrame, toPicture } from './map-picture';

describe('the map picture', () => {
  const frame = mapPictureFrame(baseBoard);
  // Every hex corner, in the picture's pixels.
  const px = Object.values(baseBoard.hexes).flatMap((h) => corners(center(h)).map((p) => toPicture(frame, p)));
  const [left, right] = [Math.min(...px.map((p) => p[0])), MAP_PICTURE.width - Math.max(...px.map((p) => p[0]))];
  const [top, bottom] = [Math.min(...px.map((p) => p[1])), MAP_PICTURE.height - Math.max(...px.map((p) => p[1]))];

  it('is 1600 x 896, the shape of the board picture it covers', () => {
    expect(MAP_PICTURE).toEqual({ width: 1600, height: 896, margin: 40 });
    expect(frame.width / frame.height).toBeCloseTo(1600 / 896, 6);
  });

  it('has the hexes in the middle, a 40-pixel margin on the tighter side (as the map guide is drawn)', () => {
    expect(Math.min(top, bottom)).toBeCloseTo(40, 6);
    expect(top).toBeCloseTo(bottom, 6);
    expect(left).toBeCloseTo(right, 6);
    expect(Math.min(left, right)).toBeGreaterThanOrEqual(40);
  });

  it('turns board points into picture pixels and back', () => {
    const p = center(baseBoard.hexes.D4!);
    const q = toPicture(frame, p);
    expect(frame.x + (q[0] / MAP_PICTURE.width) * frame.width).toBeCloseTo(p[0], 6);
    expect(frame.y + (q[1] / MAP_PICTURE.height) * frame.height).toBeCloseTo(p[1], 6);
  });
});
