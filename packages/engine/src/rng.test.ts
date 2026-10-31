import { describe, expect, it } from 'vitest';
import { nextFloat, nextInt, seedRng, shuffle } from './rng';

describe('seeded RNG', () => {
  it('produces the same sequence for the same seed', () => {
    const roll = (seed: number) => {
      let s = seedRng(seed);
      const out: number[] = [];
      for (let i = 0; i < 5; i++) {
        let v: number;
        [v, s] = nextInt(s, 6);
        out.push(v);
      }
      return out;
    };
    expect(roll(42)).toEqual(roll(42));
    expect(roll(42)).not.toEqual(roll(43));
  });

  it('stays in range and keeps state JSON-serializable', () => {
    let s = seedRng(7);
    for (let i = 0; i < 1000; i++) {
      let f: number;
      [f, s] = nextFloat(s);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
    expect(JSON.parse(JSON.stringify({ rng: s }))).toEqual({ rng: s });
  });
});

describe('shuffle', () => {
  it('reorders a copy the same way for the same seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const [a] = shuffle(seedRng(3), items);
    expect(a).toEqual(shuffle(seedRng(3), items)[0]);
    expect([...a].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
