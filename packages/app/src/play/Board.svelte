<script lang="ts">
  // The 2D board: terrain, rivers, home bases, everyone's pieces and the
  // resources on each hex. Hexes the player can tap are outlined.
  // Each hex shows its terrain icon in the middle, a tunnel icon at the top
  // and an encounter icon at the bottom (see icons.ts); its ID sits at the upper left.
  //
  // The camera (see camera.ts): pinch or use the mouse wheel to zoom (around
  // the fingers or the pointer), drag to pan, or use the buttons at the bottom
  // right. The game also guides it (guideTo) each time there's somewhere new
  // to look, once the pass screen is gone (paused).
  import type { GameState, HexId, Location, Resource } from '@scythe/engine';
  import { untrack } from 'svelte';
  import { between, fitView, panBy, worldOf, zoomAt, type Limits, type View } from './camera';
  import { boardArea, center, corners, points, sharedEdge, SIZE, spotsArea, type Point } from './geometry';
  import HexIcon from './HexIcon.svelte';
  import { ENCOUNTER_ICON, TERRAIN_ICONS, TUNNEL_ICON } from './icons';
  import type { Prompt, Selection } from './prompt';

  let {
    game,
    prompt,
    onTap,
    onPick,
    guideTo,
    paused = false,
  }: {
    game: GameState;
    prompt: Prompt;
    onTap: (at: Location) => void;
    onPick: (selection: Selection) => void;
    /** Where to look; the camera moves each time the key changes. */
    guideTo?: { key: string; spots: Location[] } | null;
    paused?: boolean;
  } = $props();

  /** A piece of the current player that can be tapped to pick that unit (see Prompt.pieces). */
  const pickable = (at: Location, kind: 'character' | 'mechs' | 'workers') => {
    const k = `${at}|${{ character: 'character', mechs: 'mech', workers: 'worker' }[kind]}`;
    return { key: k, select: prompt.pieces?.get(k), selected: prompt.selectedPiece === k };
  };

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
  /** How far left of a hex's centre its pieces sit, and the gap between them. */
  const PIECES_LEFT = 6;
  const PIECE_STEP = 14;
  /** Pieces per row; a crowded hex wraps onto more rows. */
  const PIECES_PER_ROW = 4;

  const board = $derived(game.setup.board);
  const hexes = $derived(Object.values(board.hexes));
  // --- Camera ---
  const HEX_W = SIZE * Math.sqrt(3);
  let W = $state(0);
  let H = $state(0);
  const aspect = $derived(W && H ? W / H : 1.6);
  /** Zoom in to about three hexes across at most. */
  const limits: Limits = $derived({ world: boardArea(board), minW: HEX_W * 3 });
  /** null until the camera first moves: the whole board. */
  let view: View | null = $state(null);
  const shownView = $derived(view ?? fitView(limits.world, aspect, limits));
  const box = $derived(`${shownView.x} ${shownView.y} ${shownView.w} ${shownView.h}`);

  // Keep the camera's middle and zoom when the map area changes shape.
  $effect(() => {
    const a = aspect;
    untrack(() => {
      if (view) view = fitView({ x: view.x, y: view.y + view.h / 2 - view.w / a / 2, w: view.w, h: view.w / a }, a, limits);
    });
  });

  let anim = 0;
  /** Glides the camera to `target`. */
  function glide(target: View, ms = 700) {
    cancelAnimationFrame(anim);
    const from = shownView;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      view = between(from, target, eased);
      if (t < 1) anim = requestAnimationFrame(frame);
    };
    anim = requestAnimationFrame(frame);
  }

  // Guided views: no closer than about five hexes across, so there's context.
  let guidedKey = '';
  $effect(() => {
    const g = guideTo;
    if (!g || paused || !W || g.key === guidedKey) return;
    guidedKey = g.key;
    untrack(() => {
      const home = board.homeBasePositions[game.setup.players[game.currentPlayer]!.faction.homeBase];
      const area = spotsArea(board, g.spots, home);
      if (!area) return;
      const target = fitView(area, aspect, { ...limits, minW: HEX_W * 5 });
      // Skip a move too small to notice, so the map doesn't twitch between steps.
      const now = shownView;
      const zoomChange = Math.abs(target.w / now.w - 1);
      const shift = Math.hypot(target.x + target.w / 2 - (now.x + now.w / 2), target.y + target.h / 2 - (now.y + now.h / 2)) / now.w;
      if (zoomChange > 0.12 || shift > 0.1) glide(target, 550);
    });
  });

  /** Zoom buttons: in or out around the middle of the view. */
  function zoomBy(factor: number) {
    const v = shownView;
    glide(zoomAt(v, factor, [v.x + v.w / 2, v.y + v.h / 2], aspect, limits), 300);
  }

  let svg: SVGSVGElement | undefined = $state();
  /** The board point under a spot on the screen. */
  function toWorld(clientX: number, clientY: number): Point {
    const r = svg!.getBoundingClientRect();
    return worldOf(shownView, [(clientX - r.left) / r.width, (clientY - r.top) / r.height]);
  }

  // Wheel or trackpad: zoom around the pointer. (Added by hand so it can stop the page scrolling.)
  $effect(() => {
    const el = svg;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(anim);
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      // A trackpad pinch arrives as a wheel with ctrlKey and small steps.
      const factor = Math.exp(dy * (e.ctrlKey ? 0.01 : 0.0015));
      view = zoomAt(shownView, factor, toWorld(e.clientX, e.clientY), aspect, limits);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  // Fingers and mouse: one drags the map, two pinch. A drag is never a tap.
  const pointers = new Map<number, Point>();
  let travelled = 0;
  let dragged = false;
  function down(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelAnimationFrame(anim);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      travelled = 0;
      dragged = false;
    }
  }
  function move(e: PointerEvent) {
    const prev = pointers.get(e.pointerId);
    if (!prev || !svg) return;
    const now: Point = [e.clientX, e.clientY];
    const r = svg.getBoundingClientRect();
    const perPixel = shownView.w / r.width;
    if (pointers.size === 1) {
      travelled += Math.hypot(now[0] - prev[0], now[1] - prev[1]);
      if (travelled > 8) {
        dragged = true;
        view = panBy(shownView, -(now[0] - prev[0]) * perPixel, -(now[1] - prev[1]) * perPixel, limits);
      }
    } else if (pointers.size === 2) {
      const other = [...pointers].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev[0] - other[0], prev[1] - other[1]);
      const after = Math.hypot(now[0] - other[0], now[1] - other[1]);
      const midBefore: Point = [(prev[0] + other[0]) / 2, (prev[1] + other[1]) / 2];
      const midAfter: Point = [(now[0] + other[0]) / 2, (now[1] + other[1]) / 2];
      dragged = true;
      if (after > 0) {
        const zoomed = zoomAt(shownView, before / after, toWorld(...midBefore), aspect, limits);
        const per = zoomed.w / r.width;
        view = panBy(zoomed, -(midAfter[0] - midBefore[0]) * per, -(midAfter[1] - midBefore[1]) * per, limits);
      }
    }
    pointers.set(e.pointerId, now);
  }
  function up(e: PointerEvent) {
    pointers.delete(e.pointerId);
  }
  /** Swallow the click that ends a drag or pinch, so it doesn't tap a hex. */
  function clickCapture(e: MouseEvent) {
    if (!dragged) return;
    e.stopPropagation();
    e.preventDefault();
    dragged = false;
  }

  /** Everything on a hex, grouped by player. */
  type Pieces = { seat: number; color: string; initial: string; character: boolean; mechs: number; workers: number; structure?: string };
  const piecesOn = $derived.by(() => {
    const on = new Map<HexId, Pieces[]>();
    game.players.forEach((p, i) => {
      const f = game.setup.players[i]!.faction;
      const add = (hex: HexId, patch: Partial<Pieces>) => {
        const list = on.get(hex) ?? [];
        let mine = list.find((x) => x.color === f.color);
        if (!mine) list.push((mine = { seat: i, color: f.color, initial: f.name[0] ?? '?', character: false, mechs: 0, workers: 0 }));
        Object.assign(mine, patch, {
          mechs: mine.mechs + (patch.mechs ?? 0),
          workers: mine.workers + (patch.workers ?? 0),
        });
        on.set(hex, list);
      };
      if (p.character !== 'home') add(p.character, { character: true });
      for (const m of p.mechs) add(m, { mechs: 1 });
      // Workers the selected mech has picked up ride on it instead (see cargo below).
      const carried = i === game.currentPlayer ? (prompt.cargo?.workers ?? []) : [];
      p.workers.forEach((w, wi) => carried.includes(wi) || add(w, { workers: 1 }));
      for (const [s, hex] of Object.entries(p.structures)) if (hex) add(hex, { structure: STRUCTURE_LETTER[s as keyof typeof STRUCTURE_LETTER] });
    });
    return on;
  });

  type Kind = 'structure' | 'character' | 'mechs' | 'workers';
  /**
   * Where each piece on a hex goes: each player's pieces side by side, a
   * little left of the middle, in rows of up to four. Each mech is its own
   * piece, so a hex with several gets crowded rather than showing a count.
   */
  function placePieces(groups: Pieces[], c: readonly [number, number]) {
    const rows = groups.flatMap((g) => {
      const kinds = (['structure', 'character', 'mechs', 'workers'] as const)
        .filter((k) => g[k])
        .flatMap((k): Kind[] => (k === 'mechs' ? Array<Kind>(g.mechs).fill('mechs') : [k]));
      const out: { g: Pieces; kind: Kind }[][] = [];
      for (let i = 0; i < kinds.length; i += PIECES_PER_ROW) out.push(kinds.slice(i, i + PIECES_PER_ROW).map((kind) => ({ g, kind })));
      return out;
    });
    // One or two rows sit where they always have; more grow upwards.
    const top = c[1] - 4 - Math.max(0, rows.length - 2) * PIECE_STEP;
    return rows.flatMap((row, r) =>
      row.map((p, i) => ({ ...p, x: c[0] - PIECES_LEFT + (i - (row.length - 1) / 2) * PIECE_STEP, y: top + r * PIECE_STEP })),
    );
  }

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

<svelte:window onpointermove={move} onpointerup={up} onpointercancel={up} />

<div class="map" bind:clientWidth={W} bind:clientHeight={H}>
<svg
  bind:this={svg}
  viewBox={box}
  preserveAspectRatio="xMidYMid meet"
  role="application"
  onpointerdown={down}
  onclickcapture={clickCapture}
>
  {#each hexes as h (h.id)}
    {@const c = center(h)}
    {@const lit = prompt.highlights.has(h.id)}
    {@const tappable = lit || prompt.tapSelects.has(h.id)}
    <polygon
      points={points(corners(c))}
      fill={FILL[h.terrain]}
      class="hex"
      class:tappable
      onclick={() => tappable && onTap(h.id)}
      role="button"
      tabindex="-1"
      onkeydown={() => {}}
    />
    {@const icon = TERRAIN_ICONS[h.terrain]}
    {#if icon}<HexIcon {icon} x={c[0]} y={c[1]} size={SIZE * 0.65} faded />{/if}
    {#if h.tunnel}<HexIcon icon={TUNNEL_ICON} x={c[0]} y={c[1] - SIZE * 0.62} size={SIZE * 0.36} />{/if}
    {#if h.encounter}<HexIcon icon={ENCOUNTER_ICON} x={c[0]} y={c[1] + SIZE * 0.62} size={SIZE * 0.36} />{/if}
    <text x={c[0] - SIZE * 0.5} y={c[1] - SIZE * 0.45} class="id">{h.id}</text>
  {/each}

  {#each board.rivers as [a, b] (a + b)}
    {@const [p, q] = sharedEdge(board, a, b)}
    <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} class="river" />
  {/each}

  <!-- Outlines of tappable and selected hexes go over the rivers so they show in full. -->
  {#each hexes as h (h.id)}
    {@const lit = prompt.highlights.has(h.id)}
    {@const selected = prompt.selected === h.id || !!prompt.marked?.has(h.id)}
    {#if lit || selected}
      <polygon points={points(corners(center(h)))} class="outline" class:lit class:selected />
    {/if}
  {/each}

  {#each homes as home (home.id)}
    {#each home.borders as b, i (i)}
      <line x1={home.c[0]} y1={home.c[1]} x2={b[0]} y2={b[1]} class="home-link" />
    {/each}
    {@const lit = home.mine && prompt.highlights.has('home')}
    {@const tappable = home.mine && (lit || prompt.tapSelects.has('home'))}
    {#if home.mine && home.faction}
      <!-- The current player's home base glows in their colour. -->
      <circle cx={home.c[0]} cy={home.c[1]} r={SIZE * 0.55} fill="none" stroke={home.faction.color} class="home-glow" />
    {/if}
    <circle
      cx={home.c[0]}
      cy={home.c[1]}
      r={SIZE * 0.55}
      fill={home.faction?.color ?? '#444'}
      class="home"
      class:lit
      class:selected={home.mine && prompt.selected === 'home'}
      class:tappable
      onclick={() => tappable && onTap('home')}
      role="button"
      tabindex="-1"
      onkeydown={() => {}}
    />
    {#if home.characterHome}
      {@const pick = home.mine ? pickable('home', 'character') : { key: '', select: undefined, selected: false }}
      {@const sel = pick.select}
      <circle
        cx={home.c[0]}
        cy={home.c[1]}
        r="7"
        class="character"
        data-piece={pick.key || undefined}
        class:passive={!sel}
        class:pickable={sel}
        class:picked={pick.selected}
        fill="#fff"
        onclick={(e) => sel && (e.stopPropagation(), onPick(sel))}
        role="button"
        tabindex="-1"
        onkeydown={() => {}}
      />
      <text x={home.c[0]} y={home.c[1] + 3.5} class="piece-text dark">{home.faction?.name[0]}</text>
    {/if}
  {/each}

  <!-- Pieces and resources sit on top but let taps through to the hex. -->
  <g class="overlay">
    {#each hexes as h (h.id)}
      {@const c = center(h)}
      {@const groups = piecesOn.get(h.id) ?? []}
      {@const placed = placePieces(groups, c)}
      {#each placed as { g, kind, x, y }, i (i)}
          {@const pick = kind !== 'structure' && g.seat === game.currentPlayer ? pickable(h.id, kind) : { key: '', select: undefined, selected: false }}
          {@const sel = pick.select}
          {#if sel || pick.selected}
            <!-- Your own unit that can move: tap the piece itself to pick it. -->
            <circle
              cx={x}
              cy={y}
              r="8.5"
              class="pick-ring"
              data-piece={pick.key || undefined}
              class:pickable={sel}
              class:picked={pick.selected}
              onclick={() => sel && onPick(sel)}
              role="button"
              tabindex="-1"
              onkeydown={() => {}}
            />
          {/if}
          {#if kind === 'structure'}
            <rect x={x - 6} y={y - 6} width="12" height="12" fill={g.color} class="structure" />
            <text {x} y={y + 2} class="piece-text small">{g.structure}</text>
          {:else if kind === 'character'}
            <circle cx={x} cy={y} r="6.5" fill={g.color} class="character" />
            <text {x} y={y + 3} class="piece-text">{g.initial}</text>
          {:else if kind === 'mechs'}
            <rect x={x - 6} y={y - 6} width="12" height="12" rx="2" fill={g.color} class="mech" />
            <text {x} y={y + 3} class="piece-text">{g.initial}</text>
          {:else}
            <circle cx={x} cy={y} r="5.5" fill={g.color} class="worker" />
            <text {x} y={y + 3} class="piece-text">{g.workers}</text>
          {/if}
      {/each}
      {@const cargo = prompt.cargo?.at === h.id ? prompt.cargo : undefined}
      {#if cargo}
        <!-- What the selected unit has picked up, in a row just above it. -->
        {@const on = placed.find((p) => p.g.seat === game.currentPlayer && p.kind !== 'structure' && pickable(h.id, p.kind).selected)}
        {@const chips = [
          ...(cargo.workers.length ? [{ fill: on?.g.color ?? '#fff', n: cargo.workers.length, dark: false }] : []),
          ...(Object.entries(cargo.resources) as [Resource, number][]).map(([r, n]) => ({ fill: RESOURCE_COLOR[r], n, dark: r === 'food' || r === 'metal' })),
        ]}
        {#if on}
          {#each chips as chip, ci (ci)}
            {@const cx = on.x + (ci - (chips.length - 1) / 2) * 10}
            <circle {cx} cy={on.y - 13} r="4.5" fill={chip.fill} class="cargo" />
            <text x={cx} y={on.y - 11} class="piece-text small" class:dark={chip.dark}>{chip.n}</text>
          {/each}
        {/if}
      {/if}
      <!-- Resources picked up by the selected unit are off the hex for now. -->
      {@const pile = (Object.entries(game.resources[h.id] ?? {}) as [Resource, number][])
        .map(([r, n]): [Resource, number] => [r, n - (cargo?.resources[r] ?? 0)])
        .filter(([, n]) => n > 0)}
      {#each pile as [res, n], i (res)}
        {@const x = c[0] - (pile.length - 1) * 7 + i * 14}
        <circle cx={x} cy={c[1] + SIZE * 0.3} r="6" fill={RESOURCE_COLOR[res]} class="resource" />
        <text x={x} y={c[1] + SIZE * 0.3 + 3} class="piece-text" class:dark={res === 'food' || res === 'metal'}>{n}</text>
      {/each}
    {/each}
  </g>
</svg>
  <div class="zoom">
    <button aria-label="Zoom in" onclick={() => zoomBy(0.65)}>+</button>
    <button aria-label="Zoom out" onclick={() => zoomBy(1.55)}>−</button>
    <button aria-label="Whole map" onclick={() => glide(fitView(limits.world, aspect, limits), 450)}>⤢</button>
  </div>
</div>

<style>
  .map {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
    /* The map handles pinch and drag itself. */
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .zoom {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .zoom button {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    border: 1px solid #8a7a5c;
    background: rgb(36 31 26 / 0.85);
    color: #efe6d4;
    font: inherit;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
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
  .hex.tappable,
  .home.tappable {
    cursor: pointer;
  }
  .home-glow {
    stroke-width: 10;
    pointer-events: none;
    filter: blur(3px);
    animation: home-glow 1.6s ease-in-out infinite;
  }
  @keyframes home-glow {
    50% {
      stroke-opacity: 0.25;
    }
  }
  .outline {
    fill: none;
    pointer-events: none;
  }
  .outline.lit,
  .home.lit {
    stroke: #fff6c8;
    stroke-width: 2.5;
    cursor: pointer;
    animation: pulse 1.4s ease-in-out infinite;
  }
  .outline.selected,
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
    dominant-baseline: central;
    fill: #1e1a16;
    opacity: 0.6;
    pointer-events: none;
  }
  .overlay {
    pointer-events: none;
  }
  /* A ring behind each of your pieces that can move; the piece is tapped through to it. */
  .pick-ring {
    fill: rgba(255, 246, 200, 0.15);
    stroke: #fff6c8;
    stroke-width: 1.5;
    pointer-events: all;
    cursor: pointer;
    animation: pulse 1.4s ease-in-out infinite;
  }
  .pick-ring.picked {
    fill: rgba(255, 210, 63, 0.3);
    stroke: #ffd23f;
    stroke-width: 2.5;
    animation: none;
  }
  .pick-ring.picked:not(.pickable) {
    pointer-events: none;
    cursor: default;
  }
  .character.pickable {
    cursor: pointer;
    stroke: #fff6c8;
    stroke-width: 2;
  }
  .character.picked {
    stroke: #ffd23f;
    stroke-width: 3;
  }
  .cargo {
    stroke: #ffd23f;
    stroke-width: 1;
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
