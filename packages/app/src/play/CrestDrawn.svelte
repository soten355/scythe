<script lang="ts">
  // The drawn crest: a shield in the faction's colour with its initial, over a
  // cog. An <svg>, so it works in a page (FactionEmblem) and inside the board.
  import type { Faction } from '@scythe/engine';
  import { isLight } from './ink';

  let { faction, x, y, width = '100%', height = '100%' }: { faction: Faction; x?: number; y?: number; width?: number | string; height?: number | string } = $props();

  /** A cog outline: `teeth` square-ish teeth around a circle. */
  function cog(cx: number, cy: number, inner: number, outer: number, teeth: number): string {
    const pts: string[] = [];
    for (let i = 0; i < teeth * 4; i++) {
      const r = i % 4 < 2 ? outer : inner;
      const a = ((i + 0.5) / (teeth * 4)) * Math.PI * 2;
      pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
    }
    return `M${pts.join('L')}Z`;
  }
</script>

<svg viewBox="0 0 120 120" {x} {y} {width} {height} aria-hidden="true" style:display="block">
  <path d={cog(60, 58, 46, 55, 14)} fill="none" stroke={faction.color} stroke-width="3" opacity="0.7" />
  <circle cx="60" cy="58" r="38" fill="none" stroke={faction.color} stroke-width="1.5" opacity="0.6" />
  <path d="M60 22 L88 32 V58 C88 78 75 90 60 98 C45 90 32 78 32 58 V32 Z" fill={faction.color} stroke="#e9dcc0" stroke-width="2" />
  <text x="60" y="72" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="36" font-weight="700" fill={isLight(faction.color) ? '#1e1a16' : '#f4ead2'}
    >{faction.name[0]}</text
  >
</svg>
