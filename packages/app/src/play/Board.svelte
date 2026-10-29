<script lang="ts">
  // The 2D board: terrain, rivers, home bases, everyone's pieces and the
  // resources on each hex. Hexes the player can tap are outlined.
  import type { GameState, HexId, Location, Resource } from '@scythe/engine';
  import { center, corners, points, sharedEdge, SIZE, viewBox } from './geometry';
  import type { Prompt } from './prompt';

  let { game, prompt, onTap }: { game: GameState; prompt: Prompt; onTap: (at: Location) => void } = $props();

  const FILL: Record<string, string> = {
    farm: '#d9c46a',
    forest: '#4f7f48',
    mountain: '#8d837a',
    tundra: '#a9c7bd',
    village: '#c9875c',
    lake: '#5b8fc0',
    factory: '#7a5a8a',
  };
  const RESOURCE_COLOR: Record<Resource, string> = { oil: '#1b1b1b', metal: '#9aa3ad', wood: '#7a4a24', food: '#f0d54a' };
  const STRUCTURE_LETTER = { mine: 'Mi', mill: 'Ml', armory: 'Ar', monument: 'Mo' };

  const board = $derived(game.setup.board);
  const hexes = $derived(Object.values(board.hexes));
  const box = $derived(viewBox(board));

  /** Everything on a hex, grouped by player. */
  type Pieces = { color: string; initial: string; character: boolean; mechs: number; workers: number; structure?: string };
  const piecesOn = $derived.by(() => {
    const on = new Map<HexId, Pieces[]>();
    game.players.forEach((p, i) => {
      const f = game.setup.players[i]!.faction;
      const add = (hex: HexId, patch: Partial<Pieces>) => {
        const list = on.get(hex) ?? [];
        let mine = list.find((x) => x.color === f.color);
        if (!mine) list.push((mine = { color: f.color, initial: f.name[0] ?? '?', character: false, mechs: 0, workers: 0 }));
        Object.assign(mine, patch, {
          mechs: mine.mechs + (patch.mechs ?? 0),
          workers: mine.workers + (patch.workers ?? 0),
        });
        on.set(hex, list);
      };
      if (p.character !== 'home') add(p.character, { character: true });
      for (const m of p.mechs) add(m, { mechs: 1 });
      for (const w of p.workers) add(w, { workers: 1 });
      for (const [s, hex] of Object.entries(p.structures)) if (hex) add(hex, { structure: STRUCTURE_LETTER[s as keyof typeof STRUCTURE_LETTER] });
    });
    return on;
  });

  /** Home bases with the faction that starts there and whether its character is at home. */
  const homes = $derived(
    Object.entries(board.homeBasePositions).map(([id, pos]) => {
      const seat = game.setup.players.findIndex((p) => p.faction.homeBase === id);
      const faction = game.setup.players[seat]?.faction;
      return {
        id,
        c: center(pos),
        borders: (board.homeBases[id] ?? []).map((h) => center(board.hexes[h]!)),
        faction,
        characterHome: seat >= 0 && game.players[seat]!.character === 'home',
        mine: seat === game.currentPlayer,
      };
    }),
  );
</script>

<svg viewBox={box} preserveAspectRatio="xMidYMid meet" role="application">
  {#each hexes as h (h.id)}
    {@const c = center(h)}
    {@const lit = prompt.highlights.has(h.id)}
    <polygon
      points={points(corners(c))}
      fill={FILL[h.terrain]}
      class:lit
      class:selected={prompt.selected === h.id}
      class="hex"
      onclick={() => lit && onTap(h.id)}
      role="button"
      tabindex="-1"
      onkeydown={() => {}}
    />
    <text x={c[0]} y={c[1] - SIZE * 0.6} class="id">{h.id}{h.tunnel ? ' ⌂' : ''}</text>
  {/each}

  {#each board.rivers as [a, b] (a + b)}
    {@const [p, q] = sharedEdge(board, a, b)}
    <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} class="river" />
  {/each}

  {#each homes as home (home.id)}
    {#each home.borders as b, i (i)}
      <line x1={home.c[0]} y1={home.c[1]} x2={b[0]} y2={b[1]} class="home-link" />
    {/each}
    {@const lit = home.mine && prompt.highlights.has('home')}
    <circle
      cx={home.c[0]}
      cy={home.c[1]}
      r={SIZE * 0.55}
      fill={home.faction?.color ?? '#444'}
      class="home"
      class:lit
      class:selected={home.mine && prompt.selected === 'home'}
      onclick={() => lit && onTap('home')}
      role="button"
      tabindex="-1"
      onkeydown={() => {}}
    />
    {#if home.characterHome}
      <circle cx={home.c[0]} cy={home.c[1]} r="7" class="character passive" fill="#fff" />
      <text x={home.c[0]} y={home.c[1] + 3.5} class="piece-text dark">{home.faction?.name[0]}</text>
    {/if}
  {/each}

  <!-- Pieces and resources sit on top but let taps through to the hex. -->
  <g class="overlay">
    {#each hexes as h (h.id)}
      {@const c = center(h)}
      {@const groups = piecesOn.get(h.id) ?? []}
      {#each groups as g, gi (g.color)}
        {@const y = c[1] - 4 + gi * 14}
        {@const x0 = c[0] - 16}
        {#if g.structure}
          <rect x={x0 - 4} y={y - 6} width="12" height="12" fill={g.color} class="structure" />
          <text x={x0 + 2} y={y + 3} class="piece-text small">{g.structure}</text>
        {/if}
        {#if g.character}
          <circle cx={x0 + 14} cy={y} r="6.5" fill={g.color} class="character" />
          <text x={x0 + 14} y={y + 3} class="piece-text">{g.initial}</text>
        {/if}
        {#if g.mechs}
          <rect x={x0 + 22} y={y - 6} width="12" height="12" rx="2" fill={g.color} class="mech" />
          <text x={x0 + 28} y={y + 3} class="piece-text">{g.mechs}</text>
        {/if}
        {#if g.workers}
          <circle cx={x0 + 41} cy={y} r="5.5" fill={g.color} class="worker" />
          <text x={x0 + 41} y={y + 3} class="piece-text">{g.workers}</text>
        {/if}
      {/each}
      {@const pile = Object.entries(game.resources[h.id] ?? {}) as [Resource, number][]}
      {#each pile as [res, n], i (res)}
        {@const x = c[0] - (pile.length - 1) * 7 + i * 14}
        <circle cx={x} cy={c[1] + SIZE * 0.55} r="6" fill={RESOURCE_COLOR[res]} class="resource" />
        <text x={x} y={c[1] + SIZE * 0.55 + 3} class="piece-text" class:dark={res === 'food' || res === 'metal'}>{n}</text>
      {/each}
    {/each}
  </g>
</svg>

<style>
  svg {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: manipulation;
  }
  .hex {
    stroke: #2a241e;
    stroke-width: 1;
  }
  .hex,
  .home {
    outline: none;
  }
  .passive {
    pointer-events: none;
  }
  .hex.lit,
  .home.lit {
    stroke: #fff6c8;
    stroke-width: 2.5;
    cursor: pointer;
    animation: pulse 1.4s ease-in-out infinite;
  }
  .hex.selected,
  .home.selected {
    stroke: #ffd23f;
    stroke-width: 4;
    animation: none;
  }
  @keyframes pulse {
    50% {
      stroke-opacity: 0.35;
    }
  }
  .home {
    stroke: #1e1a16;
    stroke-width: 1.5;
  }
  .home-link {
    stroke: #efe6d4;
    stroke-opacity: 0.4;
    stroke-dasharray: 3 3;
  }
  .river {
    stroke: #2f6fe0;
    stroke-width: 4;
    stroke-linecap: round;
    pointer-events: none;
  }
  .id {
    font-size: 7px;
    text-anchor: middle;
    fill: #1e1a16;
    opacity: 0.6;
    pointer-events: none;
  }
  .overlay {
    pointer-events: none;
  }
  .character,
  .mech,
  .worker,
  .structure,
  .resource {
    stroke: #1e1a16;
    stroke-width: 1;
  }
  .structure {
    stroke: #fff;
  }
  .piece-text {
    font-size: 8px;
    font-weight: 700;
    text-anchor: middle;
    fill: #fff;
    pointer-events: none;
  }
  .piece-text.small {
    font-size: 6px;
  }
  .piece-text.dark {
    fill: #1e1a16;
  }
</style>
