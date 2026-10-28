// Guards the architecture rules in CLAUDE.md by scanning engine source.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const engineSrc = join(import.meta.dirname, '../../packages/engine/src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}

const forbidden: [string, RegExp][] = [
  ['imports from app', /from\s+['"]@scythe\/app/],
  ['Math.random', /Math\.random/],
  ['the clock', /Date\.now|new Date\b|performance\.now/],
  ['the DOM', /\b(window|document|localStorage|indexedDB)\./],
];

describe('engine purity', () => {
  for (const file of sourceFiles(engineSrc)) {
    it(`${file.slice(engineSrc.length + 1)} follows engine rules`, () => {
      const code = readFileSync(file, 'utf8');
      for (const [label, pattern] of forbidden) {
        expect(pattern.test(code), `uses ${label}`).toBe(false);
      }
    });
  }
});
