// Draws the base board to tools/out/board-preview.svg so it can be checked
// by eye against the physical board. Run with `npm run board-preview`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { baseBoard } from '@scythe/content';
import type { Hex, Terrain } from '@scythe/engine';

const SIZE = 48;
const FILL: Record<Terrain, string> = {
  farm: '#e8d36a',
  forest: '#4f8a4a',
  mountain: '#9a8f86',
  tundra: '#b9d3c9',
  village: '#d58a5a',
  lake: '#6fa8dc',
  factory: '#7a4e8a',
};

const center = ({ q, r }: Hex): [number, number] => [SIZE * Math.sqrt(3) * (q + r / 2), SIZE * 1.5 * r];

const corners = (h: Hex): [number, number][] => {
  const [cx, cy] = center(h);
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return [cx + SIZE * Math.cos(a), cy + SIZE * Math.sin(a)];
  });
};

const hexes = Object.values(baseBoard.hexes);
const hex = (id: string): Hex => {
  const h = baseBoard.hexes[id];
  if (!h) throw new Error(`no hex ${id}`);
  return h;
};
const parts: string[] = [];

for (const h of hexes) {
  const [cx, cy] = center(h);
  const pts = corners(h).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  parts.push(`<polygon points="${pts}" fill="${FILL[h.terrain]}" stroke="#333" stroke-width="1.5"/>`);
  parts.push(`<text x="${cx}" y="${cy - 14}" class="id">${h.id}</text>`);
  parts.push(`<text x="${cx}" y="${cy + 4}" class="t">${h.terrain}</text>`);
  const marks = [h.tunnel && 'TUNNEL', h.encounter && '★'].filter(Boolean).join(' ');
  if (marks) parts.push(`<text x="${cx}" y="${cy + 22}" class="m">${marks}</text>`);
}

// Rivers: a thick blue line along the edge shared by the two hexes.
for (const [a, b] of baseBoard.rivers) {
  const [bx, by] = center(hex(b));
  const [[x1, y1] = [0, 0], [x2, y2] = [0, 0]] = corners(hex(a)).sort(
    ([ax, ay], [cx, cy]) => Math.hypot(ax - bx, ay - by) - Math.hypot(cx - bx, cy - by),
  );
  parts.push(
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1450c8" stroke-width="7" stroke-linecap="round"/>`,
  );
}

// Home bases: a circle pushed outward from the two hexes they border.
const all = hexes.map(center);
const midX = all.reduce((s, p) => s + p[0], 0) / all.length;
const midY = all.reduce((s, p) => s + p[1], 0) / all.length;
for (const [id, borders] of Object.entries(baseBoard.homeBases)) {
  const pts = borders.map((hid) => center(hex(hid)));
  const ax = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const ay = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const len = Math.hypot(ax - midX, ay - midY);
  const hx = ax + ((ax - midX) / len) * SIZE * 1.6;
  const hy = ay + ((ay - midY) / len) * SIZE * 1.6;
  for (const [px, py] of pts) {
    parts.push(`<line x1="${hx}" y1="${hy}" x2="${px}" y2="${py}" stroke="#222" stroke-dasharray="4 4"/>`);
  }
  parts.push(`<circle cx="${hx}" cy="${hy}" r="${SIZE * 0.6}" fill="#fff" stroke="#222" stroke-width="2"/>`);
  parts.push(`<text x="${hx}" y="${hy + 5}" class="home">HOME ${id.toUpperCase()}</text>`);
}

const xs = hexes.flatMap((h) => corners(h).map((c) => c[0]));
const ys = hexes.flatMap((h) => corners(h).map((c) => c[1]));
const pad = SIZE * 3;
const [minX, minY] = [Math.min(...xs) - pad, Math.min(...ys) - pad];
const [w, h] = [Math.max(...xs) + pad - minX, Math.max(...ys) + pad - minY];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${w}" height="${h}">
<style>
  text { font-family: system-ui, sans-serif; text-anchor: middle; }
  .id { font-size: 14px; font-weight: 700; }
  .t { font-size: 11px; }
  .m { font-size: 11px; font-weight: 700; }
  .home { font-size: 10px; font-weight: 700; }
</style>
<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#f6f3ea"/>
${parts.join('\n')}
</svg>
`;

const outDir = join(import.meta.dirname, '../out');
mkdirSync(outDir, { recursive: true });
const file = join(outDir, 'board-preview.svg');
writeFileSync(file, svg);
console.log(`wrote ${file}`);
