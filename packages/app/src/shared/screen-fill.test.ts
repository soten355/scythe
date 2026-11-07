import { describe, expect, it } from 'vitest';
import { filledSize } from './screen-fill';

// An iPhone reports its screen the same way however it's held, 390 × 844, and it
// can report a page shorter than that (763) with the safe margins taken off.
describe('the size the installed app fills on an iPhone', () => {
  it('is the whole screen when held upright', () => {
    expect(filledSize({ width: 390, height: 844 }, true)).toEqual({ width: 390, height: 844 });
  });

  it('is the whole screen, on its side, when held sideways', () => {
    expect(filledSize({ width: 390, height: 844 }, false)).toEqual({ width: 844, height: 390 });
  });

  it("doesn't mind which way round the phone reports its screen", () => {
    expect(filledSize({ width: 844, height: 390 }, true)).toEqual({ width: 390, height: 844 });
  });

  it('leaves larger screens, like an iPad, to the browser', () => {
    expect(filledSize({ width: 820, height: 1180 }, true)).toBeNull();
  });
});
