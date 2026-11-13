<script lang="ts">
  // The 2D board: terrain, rivers, home bases, everyone's pieces and the
  // resources on each hex. Hexes the player can tap are outlined.
  // Each hex shows its terrain icon in the middle, a tunnel icon at the top
  // and an encounter icon at the bottom while its token is there (see icons.ts); its ID sits at the upper left.
  //
  // The camera (see camera.ts): pinch or use the mouse wheel to zoom (around
  // the fingers or the pointer), drag to pan, or use the buttons at the bottom
  // right. The game also guides it (guideTo) each time there's somewhere new
  // to look, once the pass screen is gone (paused).
  //
  // A unit that just moved (travel) glides hex by hex along its path, taking
  // moveMs per hex; its piece at the destination is hidden until it lands,
  // then whatever it carried hops off onto the hex.
  import { isHomeBase, type GameState, type HexId, type Location, type Resource, type Structure, type Terrain } from '@scythe/engine';
  import { tick, untrack } from 'svelte';
  import type { Travel } from './travel';
  import { between, fitView, panBy, worldOf, zoomAt, type Limits, type View } from './camera';
  import { bakeMap, type BakedMap } from './baked-map';
  import { framePoint, frameRect } from './frame';
  import { boardArea, center, corners, HEX_HEIGHT, HEX_VIEWBOX, HEX_WIDTH, points, sharedEdge, SIZE, spotsArea, type Point } from './geometry';
  import HexIcon from './HexIcon.svelte';
  import CrestDrawn from './CrestDrawn.svelte';
  import { MAP_PICTURE, mapPictureFrame } from './map-picture';
  import { LABEL_Y, MECH, MEEPLE, STRUCTURE_LETTER } from './shapes';
  import { boardLook, DEFAULT_THEME, hexArtIndex, TERRAINS, type BoardLook } from '../theme/theme';
  import { isLight } from './ink';
  import type { Prompt, Selection } from './prompt';

  let {
    game,
    prompt,
    onTap,
    onPick,
    guideTo,
    paused = false,
    travel = null,
    moveMs = 350,
    look = boardLook(DEFAULT_THEME),
    clear = false,
    onClear,
    onExplore,
    tapAny = false,
    showTurn = true,
  }: {
    game: GameState;
    prompt: Prompt;
    onTap: (at: Location) => void;
    onPick: (selection: Selection) => void;
    /** Where to look; the camera moves each time the key changes. */
    guideTo?: { key: string; spots: Location[] } | null;
    paused?: boolean;
    travel?: Travel | null;
    moveMs?: number;
    /** Pictures and colours from the theme (the usual look by default). */
    look?: BoardLook;
    /** A clear view (phone): no hex names or terrain symbols, and only the button that brings them back. */
    clear?: boolean;
    /** Shows the clear-view button (phone only). */
    onClear?: () => void;
    /** Shows the button that opens the map screen (phone only; elsewhere it's the whole-map button). */
    onExplore?: () => void;
    /** Every hex can be tapped (the map screen asks what's on it), not just the ones the turn offers. */
    tapAny?: boolean;
    /** The current player's home base glows. Off where no one is taking a turn (the Codex's maps). */
    showTurn?: boolean;
  } = $props();

  /** The travel that has landed (its piece is drawn normally again). */
  let landed = $state(-1);
  const moving = $derived(travel && travel.id !== landed && travel.path.length > 1 ? travel : null);
  const travelEnd = $derived(moving ? moving.path[moving.path.length - 1]! : null);

  /** A piece of the current player that can be tapped to pick that unit (see Prompt.pieces). */
  const pickable = (at: Location, kind: 'character' | 'mechs' | 'workers') => {
    const k = `${at}|${{ character: 'character', mechs: 'mech', workers: 'worker' }[kind]}`;
    return { key: k, select: prompt.pieces?.get(k), selected: prompt.selectedPiece === k };
  };

  /** Terrains with hex art: each hex is filled with its picture, cropped to the hex. */
  const arts = $derived(TERRAINS.flatMap((t) => look.arts(t).map((url, i) => ({ id: `art-${t}-${i}`, terrain: t, url }))));
  /** A hex's fill: one of its terrain's pictures, picked for this game, or else its colour. */
  function hexFill(id: HexId, terrain: Terrain) {
    const count = look.arts(terrain).length;
    return count ? `url(#art-${terrain}-${hexArtIndex(game.setup.seed, id, count)})` : look.fill(terrain);
  }
  /** The hex art painted into one picture, which is far quicker to move (see baked-map.ts). Until it's ready, or if it can't be made, the hexes draw their own. */
  let baked = $state.raw<BakedMap | null>(null);
  /** What the painted picture shows, as text: the board can be rebuilt after every action, and only a real change repaints it. */
  const bakeKey = $derived(`${game.setup.seed}|${Object.values(game.setup.board.hexes).map((h) => `${h.id},${h.q},${h.r},${h.terrain}`).join(';')}`);
  $effect(() => {
    void bakeKey;
    if (!arts.length) return;
    const behind = !look.background;
    let gone = false;
    let made: BakedMap | null = null;
    untrack(() =>
      bakeMap(
        hexes
          .filter((h) => look.arts(h.terrain).length)
          .map((h) => {
            const art = look.arts(h.terrain);
            return { corners: corners(center(h)), url: art[hexArtIndex(game.setup.seed, h.id, art.length)]!, fill: behind ? look.fill(h.terrain) : undefined };
          }),
      ),
    ).then(
      (picture) => {
        if (gone) URL.revokeObjectURL(picture.url);
        else baked = made = picture;
      },
      () => {},
    );
    return () => {
      gone = true;
      baked = null;
      if (made) URL.revokeObjectURL(made.url);
    };
  });
  const RESOURCE_COLOR: Record<Resource, string> = { oil: '#1b1b1b', metal: '#9aa3ad', wood: '#7a4a24', food: '#f0d54a' };
  /** The faction picture for each kind of unit. */
  const PART = { character: 'character', mechs: 'mech', workers: 'worker' } as const;
  /** How far left of a hex's centre its pieces sit, and the gap between them. */
  const PIECES_LEFT = 6;
  const PIECE_STEP = 14;
  /** Pieces per row; a crowded hex wraps onto more rows. */
  const PIECES_PER_ROW = 4;

  const board = $derived(game.setup.board);
  /** Where the map picture goes: the map guide's frame, so it lines up with the hexes (and zooms with them). */
  const pictureFrame = $derived(look.background ? mapPictureFrame(board) : null);
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
  /** The board point under a spot, given as the game sees it (see frame.ts). */
  function toWorld(x: number, y: number): Point {
    const r = frameRect(svg!);
    return worldOf(shownView, [(x - r.left) / r.width, (y - r.top) / r.height]);
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
      view = zoomAt(shownView, factor, toWorld(...framePoint(el, e.clientX, e.clientY)), aspect, limits);
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
    pointers.set(e.pointerId, framePoint(e.currentTarget as Element, e.clientX, e.clientY));
    if (pointers.size === 1) {
      travelled = 0;
      dragged = false;
    }
  }
  function move(e: PointerEvent) {
    const prev = pointers.get(e.pointerId);
    if (!prev || !svg) return;
    const now = framePoint(svg, e.clientX, e.clientY);
    const r = frameRect(svg);
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

  const isLake = (hex: HexId) => board.hexes[hex]?.terrain === 'lake';

  /**
   * Workers and resources on a lake never leave the mechs there: they're
   * drawn riding on the first mech (or the character), like a load.
   */
  function riding(hex: HexId, placed: { g: Pieces; kind: Kind; x: number; y: number }[], cargo: Prompt['cargo']) {
    const host = placed.find((p) => p.kind === 'mechs') ?? placed.find((p) => p.kind === 'character');
    if (!host || !isLake(hex)) return null;
    const seat = host.g.seat;
    const workers = game.players[seat]!.workers.filter((w, i) => w === hex && !cargo?.workers.includes(i)).length;
    const resources = (Object.entries(game.resources[hex] ?? {}) as [Resource, number][])
      .map(([r, n]): [Resource, number] => [r, n - (cargo?.resources[r] ?? 0)])
      .filter(([, n]) => n > 0);
    const chips = [
      ...(workers ? [{ what: 'worker', fill: host.g.color, n: workers, dark: isLight(host.g.color) }] : []),
      ...resources.map(([r, n]) => ({ what: r as string, fill: RESOURCE_COLOR[r], n, dark: r === 'food' || r === 'metal' })),
    ];
    return chips.length ? { x: host.x, y: host.y - (cargo?.at === hex ? 24 : 13), chips } : null;
  }

  /** Everything on a hex, grouped by player. */
  type Pieces = { seat: number; factionId: string; color: string; initial: string; character: boolean; mechs: number; workers: number; structure?: Structure };
  const piecesOn = $derived.by(() => {
    const on = new Map<HexId, Pieces[]>();
    game.players.forEach((p, i) => {
      const f = game.setup.players[i]!.faction;
      const add = (hex: HexId, patch: Partial<Pieces>) => {
        const list = on.get(hex) ?? [];
        let mine = list.find((x) => x.color === f.color);
        if (!mine) list.push((mine = { seat: i, factionId: f.id, color: f.color, initial: f.name[0] ?? '?', character: false, mechs: 0, workers: 0 }));
        Object.assign(mine, patch, {
          mechs: mine.mechs + (patch.mechs ?? 0),
          workers: mine.workers + (patch.workers ?? 0),
        });
        on.set(hex, list);
      };
      // A unit still travelling (and what it carries) isn't drawn at its destination yet.
      const hide = { character: 0, mechs: 0, workers: 0 };
      if (moving && moving.seat === i) Object.assign(hide, { [moving.kind]: 1 }, { workers: moving.workers + (moving.kind === 'workers' ? 1 : 0) });
      const shown = (at: Location, kind: keyof typeof hide) => !(at === travelEnd && hide[kind] > 0 && hide[kind]--);
      // Units on the home base (the character, and any sent home after a fight) are drawn there instead.
      if (!isHomeBase(p.character) && shown(p.character, 'character')) add(p.character, { character: true });
      for (const m of p.mechs) if (!isHomeBase(m) && shown(m, 'mechs')) add(m, { mechs: 1 });
      // Workers the selected mech has picked up ride on it instead (see cargo below).
      const carried = i === game.currentPlayer ? (prompt.cargo?.workers ?? []) : [];
      // Workers on a lake ride on a mech there (see riding below).
      p.workers.forEach((w, wi) => isHomeBase(w) || carried.includes(wi) || isLake(w) || !shown(w, 'workers') || add(w, { workers: 1 }));
      for (const [s, hex] of Object.entries(p.structures)) if (hex) add(hex, { structure: s as Structure });
    });
    return on;
  });

  // Picking things up (see Prompt.cargo): each worker or resource picked up
  // arcs from the hex to the unit's load, and back when it's put down. Spots
  // are read off the drawing just before and just after it changes.
  type Spots = Map<string, { x: number; y: number; fill: string }>;
  type Flight = { id: number; from: Point; to: Point; fill: string; delay: number };
  let flights: Flight[] = $state([]);
  let nextFlight = 0;
  let spotsBefore: Spots = new Map();
  let cargoBefore: { game: GameState; cargo: Prompt['cargo'] } | null = null;
  const readSpots = (): Spots =>
    new Map(
      [...(svg?.querySelectorAll<SVGElement>('[data-spot]') ?? [])].map((el) => [
        el.dataset.spot!,
        // Circles have a centre; shapes (a worker's meeple) say where theirs is.
        { x: Number(el.getAttribute('cx') ?? el.dataset.x), y: Number(el.getAttribute('cy') ?? el.dataset.y), fill: el.getAttribute('fill') ?? '#fff' },
      ]),
    );
  /** How many of each thing (workers, each resource) a load holds. */
  const loadCounts = (cargo: Prompt['cargo']): Record<string, number> => ({ worker: cargo?.workers.length ?? 0, ...cargo?.resources });
  $effect.pre(() => {
    void prompt.cargo;
    spotsBefore = readSpots();
  });
  $effect(() => {
    const cargo = prompt.cargo;
    const before = cargoBefore;
    cargoBefore = { game, cargo };
    // Only while the same unit loads up, not when it moves off or the turn moves on.
    if (!before || before.game !== game) return;
    const at = cargo?.at ?? before.cargo?.at;
    if (!at || (cargo && before.cargo && cargo.at !== before.cargo.at)) return;
    const after = readSpots();
    const was = loadCounts(before.cargo);
    const now = loadCounts(cargo);
    const pileKey = (what: string) => (what === 'worker' ? `worker|${at}` : `pile|${at}|${what}`);
    const added: Flight[] = [];
    for (const what of new Set([...Object.keys(was), ...Object.keys(now)])) {
      const change = (now[what] ?? 0) - (was[what] ?? 0);
      // Picked up: hex to load. Put down: load to hex.
      const [fromKey, toKey] = change > 0 ? [pileKey(what), `cargo|${what}`] : [`cargo|${what}`, pileKey(what)];
      const from = spotsBefore.get(fromKey);
      const to = after.get(toKey) ?? (change < 0 ? undefined : from);
      if (!from || !to) continue;
      for (let i = 0; i < Math.abs(change); i++) {
        added.push({ id: nextFlight++, from: [from.x, from.y], to: [to.x, to.y], fill: from.fill, delay: added.length * 90 });
      }
    }
    if (added.length) flights = [...flights, ...added];
  });

  /** Where a travelling piece is drawn on a hex (or a player's home base). */
  function spotOf(at: Location, seat: number): Point {
    const pos =
      at === 'home'
        ? board.homeBasePositions[game.setup.players[seat]!.faction.homeBase]!
        : at.startsWith('base:')
          ? board.homeBasePositions[at.slice('base:'.length)]!
          : board.hexes[at]!;
    const c = center(pos);
    return [c[0] - PIECES_LEFT, c[1] - 4];
  }

  /**
   * Glides a travelling piece (drawn at its destination) along its path, a
   * hex at a time, then lands it: its piece shows again and what it carried
   * hops off onto the hex, the way it was picked up but in reverse.
   */
  function walk(node: SVGElement, t: Travel) {
    const end = spotOf(t.path[t.path.length - 1]!, t.seat);
    const frames = t.path.map((at) => {
      const p = spotOf(at, t.seat);
      return { transform: `translate(${p[0] - end[0]}px, ${p[1] - end[1]}px)` };
    });
    const hops = t.path.length - 1;
    const run = node.animate(frames, { duration: moveMs * hops, easing: 'ease-in-out', fill: 'forwards' });
    run.finished.then(() => land(t, end), () => {});
    return { destroy: () => run.cancel() };
  }

  async function land(t: Travel, end: Point) {
    landed = t.id;
    const at = t.path[t.path.length - 1]!;
    // On a lake everything stays riding on the mech.
    if (isHomeBase(at) || isLake(at)) return;
    await tick();
    const spots = readSpots();
    const what = [...Array<string>(t.workers).fill('worker'), ...(Object.entries(t.resources) as [Resource, number][]).flatMap(([r, n]) => Array<string>(n).fill(r))];
    const added: Flight[] = [];
    for (const w of what) {
      const to = spots.get(w === 'worker' ? `worker|${at}` : `pile|${at}|${w}`);
      if (!to) continue;
      added.push({ id: nextFlight++, from: [end[0], end[1] - 13], to: [to.x, to.y], fill: to.fill, delay: added.length * 90 });
    }
    if (added.length) flights = [...flights, ...added];
  }

  /** Arcs a flying piece from its start to its end (it's drawn at the end), then drops it. */
  function fly(node: SVGElement, f: Flight) {
    const [dx, dy] = [f.from[0] - f.to[0], f.from[1] - f.to[1]];
    node
      .animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(1)`, opacity: 1 },
          { transform: `translate(${dx / 2}px, ${dy / 2 - 12}px) scale(1.4)`, opacity: 1 },
          { transform: 'translate(0, 0) scale(1)', opacity: 0.6 },
        ],
        { duration: 450, delay: f.delay, easing: 'ease-in-out', fill: 'backwards' },
      )
      .finished.then(() => (flights = flights.filter((x) => x.id !== f.id)));
  }

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

  function homeGroup(seat: number): Pieces | null {
    const p = game.players[seat]!;
    const f = game.setup.players[seat]!.faction;
    const carried = seat === game.currentPlayer && prompt.cargo?.at === 'home' ? prompt.cargo.workers : [];
    const mechs = p.mechs.filter((m) => m === 'home').length;
    const workers = p.workers.filter((w, i) => w === 'home' && !carried.includes(i)).length;
    if (!mechs && !workers) return null;
    return { seat, factionId: f.id, color: f.color, initial: f.name[0] ?? '?', character: false, mechs, workers };
  }

  /** Units of any faction standing on an unused home base (moved there with Wayfare). */
  function visitorsAt(at: Location): Pieces[] {
    return game.players.flatMap((p, seat) => {
      const f = game.setup.players[seat]!.faction;
      const carried = seat === game.currentPlayer && prompt.cargo?.at === at ? prompt.cargo.workers : [];
      const character = p.character === at;
      const mechs = p.mechs.filter((m) => m === at).length;
      const workers = p.workers.filter((w, i) => w === at && !carried.includes(i)).length;
      return character || mechs || workers ? [{ seat, factionId: f.id, color: f.color, initial: f.name[0] ?? '?', character, mechs, workers }] : [];
    });
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
        /** Mechs and workers sent home after losing a fight, drawn in a row under the home base. */
        others: seat >= 0 ? homeGroup(seat) : null,
        mine: seat === game.currentPlayer,
        /** How moves and taps name this base: "home" for the current player's own, "base:<id>" for the others. */
        key: seat === game.currentPlayer ? 'home' : `base:${id}`,
        /** On an unused base: whoever has moved there. */
        visitors: seat < 0 ? visitorsAt(`base:${id}`) : [],
      };
    }),
  );
</script>

{#snippet piece(g: Pieces, kind: Kind, x: number, y: number, at: Location)}
  {@const pick = kind !== 'structure' && g.seat === game.currentPlayer ? pickable(at, kind) : { key: '', select: undefined, selected: false }}
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
  {@const url = look.piece(g.factionId, kind === 'structure' ? g.structure! : PART[kind])}
  {#if url}
    <!-- The faction's own picture (from the faction editor), standing on a base in its colour. -->
    {@render pieceArt(url, g.color, x, y, kind === 'character' || kind === 'mechs')}
  {/if}
  {#if kind === 'structure'}
    {#if !url}
      <rect x={x - 6} y={y - 6} width="12" height="12" fill={g.color} class="structure" class:light={isLight(g.color)} />
      <text {x} y={y + 2} class="piece-text small" class:dark={isLight(g.color)}>{STRUCTURE_LETTER[g.structure!]}</text>
    {/if}
  {:else if kind === 'character'}
    {#if !url}
      <circle cx={x} cy={y} r="6.5" fill={g.color} class="character" />
      <text {x} y={y + LABEL_Y.character} class="piece-text" class:dark={isLight(g.color)}>{g.initial}</text>
    {/if}
  {:else if kind === 'mechs'}
    <!-- Kept (unseen under a picture): a newly deployed mech flies to it. -->
    <path d={MECH} transform="translate({x} {y})" fill={g.color} class="mech" class:ghost={url} data-mech="{g.seat}|{at}" />
    {#if !url}<text {x} y={y + LABEL_Y.mech} class="piece-text small" class:dark={isLight(g.color)}>{g.initial}</text>{/if}
  {:else}
    <!-- Kept (unseen under a picture): workers fly to and from it. -->
    <path d={MEEPLE} transform="translate({x} {y})" fill={g.color} class="worker" class:ghost={url} data-spot={g.seat === game.currentPlayer ? `worker|${at}` : undefined} data-x={x} data-y={y} />
    {#if !url}
      <text {x} y={y + LABEL_Y.worker} class="piece-text small" class:dark={isLight(g.color)}>{g.workers}</text>
    {:else if g.workers > 1}
      {@render countBadge(g.workers, g.color, x + 5, y + 5)}
    {/if}
  {/if}
{/snippet}

<!-- A faction's own picture of a piece: figures (character, mechs) stand taller than workers and structures. -->
{#snippet pieceArt(url: string, color: string, x: number, y: number, figure: boolean)}
  {@const w = figure ? 13 : 12}
  {@const h = figure ? 17 : 12}
  <ellipse cx={x} cy={y + (figure ? 7 : 5.5)} rx="6" ry="2.2" fill={color} class="piece-base" />
  <image href={url} x={x - w / 2} y={y + (figure ? 7.5 : 6) - h} width={w} height={h} preserveAspectRatio="xMidYMax meet" class="piece-art" />
{/snippet}

<!-- How many workers stand there, when a picture shows only one. -->
{#snippet countBadge(n: number, color: string, x: number, y: number)}
  <circle cx={x} cy={y} r="3.4" fill={color} class="count-badge" />
  <text {x} y={y + 1.5} class="piece-text tiny" class:dark={isLight(color)}>{n}</text>
{/snippet}

<!-- A resource's picture from the theme, over its coloured token (which stays as the spot things fly from and to). -->
{#snippet token(what: string, x: number, y: number, r: number)}
  {@const url = what === 'worker' ? undefined : look.token(what as Resource)}
  {#if url}<image href={url} x={x - r * 1.25} y={y - r * 1.25} width={r * 2.5} height={r * 2.5} class="token-art" />{/if}
{/snippet}

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
  {#if pictureFrame && look.background}
    {@const f = pictureFrame}
    <!-- Its edges fade into the board's background (inside the guide's margin, so never over a hex). -->
    {@const fx = (f.width * MAP_PICTURE.margin * 0.8) / MAP_PICTURE.width}
    {@const fy = (f.height * MAP_PICTURE.margin * 0.8) / MAP_PICTURE.height}
    <defs>
      <linearGradient id="fade-down" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color: var(--bg)" /><stop offset="1" style="stop-color: var(--bg)" stop-opacity="0" /></linearGradient>
      <linearGradient id="fade-up" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color: var(--bg)" /><stop offset="1" style="stop-color: var(--bg)" stop-opacity="0" /></linearGradient>
      <linearGradient id="fade-right" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color: var(--bg)" /><stop offset="1" style="stop-color: var(--bg)" stop-opacity="0" /></linearGradient>
      <linearGradient id="fade-left" x1="1" y1="0" x2="0" y2="0"><stop offset="0" style="stop-color: var(--bg)" /><stop offset="1" style="stop-color: var(--bg)" stop-opacity="0" /></linearGradient>
    </defs>
    <g class="map-picture">
      <image href={look.background} x={f.x} y={f.y} width={f.width} height={f.height} preserveAspectRatio="none" />
      <rect x={f.x} y={f.y} width={f.width} height={fy} fill="url(#fade-down)" />
      <rect x={f.x} y={f.y + f.height - fy} width={f.width} height={fy} fill="url(#fade-up)" />
      <rect x={f.x} y={f.y} width={fx} height={f.height} fill="url(#fade-right)" />
      <rect x={f.x + f.width - fx} y={f.y} width={fx} height={f.height} fill="url(#fade-left)" />
    </g>
  {/if}
  {#if arts.length && !baked}
    <defs>
      {#each arts as a (a.id)}
        <!-- The box is the hex's shape, so the picture is only ever cropped to fit, never stretched. -->
        <pattern id={a.id} width="1" height="1" viewBox={HEX_VIEWBOX} preserveAspectRatio="xMidYMid slice">
          <!-- See-through parts of the art show the map picture behind, or else the terrain's colour. -->
          {#if !look.background}<rect width={HEX_WIDTH} height={HEX_HEIGHT} fill={look.fill(a.terrain)} />{/if}
          <image href={a.url} width={HEX_WIDTH} height={HEX_HEIGHT} preserveAspectRatio="xMidYMid slice" />
        </pattern>
      {/each}
    </defs>
  {/if}
  {#if baked}
    <image href={baked.url} x={baked.x} y={baked.y} width={baked.width} height={baked.height} preserveAspectRatio="none" class="passive" />
  {/if}
  {#each hexes as h (h.id)}
    {@const c = center(h)}
    {@const lit = prompt.highlights.has(h.id)}
    {@const tappable = lit || prompt.tapSelects.has(h.id)}
    <polygon
      points={points(corners(c))}
      fill={hexFill(h.id, h.terrain)}
      fill-opacity={look.painted || (baked && look.arts(h.terrain).length) ? 0 : undefined}
      class="hex"
      class:painted={look.painted}
      class:edges={look.painted && look.edges}
      class:tappable
      onclick={() => (tappable || tapAny) && onTap(h.id)}
      role="button"
      tabindex="-1"
      onkeydown={() => {}}
    />
    {@const icon = look.symbol(h.terrain)}
    {#if icon && !clear}<HexIcon {icon} x={c[0]} y={c[1]} size={SIZE * 0.65} faded />{/if}
    {#if h.tunnel}<HexIcon icon={look.tunnel} x={c[0]} y={c[1] - SIZE * 0.62} size={SIZE * 0.36} />{/if}
    {#if game.encounterTokens.includes(h.id)}<HexIcon icon={look.encounter} x={c[0]} y={c[1] + SIZE * 0.62} size={SIZE * 0.36} />{/if}
    {#if !clear}<text x={c[0] - SIZE * 0.5} y={c[1] - SIZE * 0.45} class="id">{h.id}</text>{/if}
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
    {@const lit = prompt.highlights.has(home.key)}
    {@const tappable = lit || prompt.tapSelects.has(home.key)}
    {#if showTurn && home.mine && home.faction}
      <!-- The current player's home base glows in their colour. -->
      <!-- Soft rings rather than a blur: a blur redrawn every frame slows the phone. -->
      <g class="home-glow" stroke={home.faction.color}>
        <circle cx={home.c[0]} cy={home.c[1]} r={SIZE * 0.55} stroke-width="14" stroke-opacity="0.2" />
        <circle cx={home.c[0]} cy={home.c[1]} r={SIZE * 0.55} stroke-width="7" stroke-opacity="0.35" />
        <circle cx={home.c[0]} cy={home.c[1]} r={SIZE * 0.55} stroke-width="2.5" />
      </g>
    {/if}
    <!-- A faction's base shows its crest; the circle over it stays for tapping and highlights. An unused base is just the dark circle. -->
    {#if home.faction}
      {@const box = SIZE * 1.1}
      {@const crest = look.piece(home.faction.id, 'crest')}
      {#if crest}
        <image href={crest} x={home.c[0] - box / 2} y={home.c[1] - box / 2} width={box} height={box} class="home-crest" />
      {:else}
        <g class="home-crest"><CrestDrawn faction={home.faction} x={home.c[0] - box / 2} y={home.c[1] - box / 2} width={box} height={box} /></g>
      {/if}
    {/if}
    <circle
      cx={home.c[0]}
      cy={home.c[1]}
      r={SIZE * 0.55}
      fill={home.faction ? 'transparent' : '#444'}
      class="home"
      class:crested={home.faction}
      class:lit
      class:selected={prompt.selected === home.key}
      class:tappable
      onclick={() => tappable && onTap(home.key)}
      role="button"
      tabindex="-1"
      onkeydown={() => {}}
    />
    {#if home.characterHome}
      {@const pick = home.mine ? pickable('home', 'character') : { key: '', select: undefined, selected: false }}
      {@const sel = pick.select}
      <!-- At the crest's lower right, like a badge, so the crest still shows. -->
      {@const cx = home.c[0] + SIZE * 0.38}
      {@const cy = home.c[1] + SIZE * 0.38}
      <circle
        {cx}
        {cy}
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
      {@const url = home.faction && look.piece(home.faction.id, 'character')}
      {#if url}
        <image href={url} x={cx - 7} y={cy - 10} width="14" height="18" preserveAspectRatio="xMidYMax meet" class="piece-art" />
      {:else}
        <text x={cx} y={cy + 3.5} class="piece-text dark">{home.faction?.name[0]}</text>
      {/if}
    {/if}
    {#if home.others}
      {#each placePieces([home.others], [home.c[0] + PIECES_LEFT, home.c[1] + SIZE * 0.55 + 12]) as { g, kind, x, y }, i (i)}
        {@render piece(g, kind, x, y, 'home')}
      {/each}
    {/if}
    {#if home.visitors.length}
      {#each placePieces(home.visitors, [home.c[0] + PIECES_LEFT, home.c[1] + SIZE * 0.55 + 12]) as { g, kind, x, y }, i (i)}
        {@render piece(g, kind, x, y, home.key)}
      {/each}
    {/if}
  {/each}

  <!-- Pieces and resources sit on top but let taps through to the hex. -->
  <g class="overlay">
    {#each hexes as h (h.id)}
      {@const c = center(h)}
      {@const groups = piecesOn.get(h.id) ?? []}
      {@const placed = placePieces(groups, c)}
      {#each placed as { g, kind, x, y }, i (i)}
          {@render piece(g, kind, x, y, h.id)}
      {/each}
      {@const cargo = prompt.cargo?.at === h.id ? prompt.cargo : undefined}
      {#if cargo}
        <!-- What the selected unit has picked up, in a row just above it. -->
        {@const on = placed.find((p) => p.g.seat === game.currentPlayer && p.kind !== 'structure' && pickable(h.id, p.kind).selected)}
        {@const chips = [
          ...(cargo.workers.length ? [{ what: 'worker', fill: on?.g.color ?? '#fff', n: cargo.workers.length, dark: isLight(on?.g.color ?? '#fff') }] : []),
          ...(Object.entries(cargo.resources) as [Resource, number][]).map(([r, n]) => ({ what: r, fill: RESOURCE_COLOR[r], n, dark: r === 'food' || r === 'metal' })),
        ]}
        {#if on}
          {#each chips as chip, ci (ci)}
            {@const cx = on.x + (ci - (chips.length - 1) / 2) * 10}
            <circle {cx} cy={on.y - 13} r="4.5" fill={chip.fill} class="cargo" data-spot={`cargo|${chip.what}`} />
            {@render token(chip.what, cx, on.y - 13, 4.5)}
            <text x={cx} y={on.y - 11} class="piece-text small" class:dark={chip.dark}>{chip.n}</text>
          {/each}
        {/if}
      {/if}
      {@const ride = riding(h.id, placed, cargo)}
      {#if ride}
        {#each ride.chips as chip, ci (ci)}
          {@const cx = ride.x + (ci - (ride.chips.length - 1) / 2) * 10}
          <circle {cx} cy={ride.y} r="4.5" fill={chip.fill} class="cargo" data-spot={chip.what === 'worker' ? `worker|${h.id}` : `pile|${h.id}|${chip.what}`} />
          {@render token(chip.what, cx, ride.y, 4.5)}
          <text x={cx} y={ride.y + 2} class="piece-text small" class:dark={chip.dark}>{chip.n}</text>
        {/each}
      {/if}
      <!-- Resources picked up by the selected unit are off the hex for now (and on a lake, they ride on the mech). -->
      {@const pile = isLake(h.id) ? [] : (Object.entries(game.resources[h.id] ?? {}) as [Resource, number][])
        .map(([r, n]): [Resource, number] => [r, n - (cargo?.resources[r] ?? 0) - (travelEnd === h.id ? (moving?.resources[r] ?? 0) : 0)])
        .filter(([, n]) => n > 0)}
      {#each pile as [res, n], i (res)}
        {@const x = c[0] - (pile.length - 1) * 7 + i * 14}
        <circle cx={x} cy={c[1] + SIZE * 0.3} r="6" fill={RESOURCE_COLOR[res]} class="resource" data-spot={`pile|${h.id}|${res}`} />
        {@render token(res, x, c[1] + SIZE * 0.3, 6)}
        <text x={x} y={c[1] + SIZE * 0.3 + 3} class="piece-text" class:dark={res === 'food' || res === 'metal'}>{n}</text>
      {/each}
    {/each}
    {#each flights as f (f.id)}
      <circle cx={f.to[0]} cy={f.to[1]} r="5" fill={f.fill} class="flight" use:fly={f} />
    {/each}
    {#if moving}
      {#key moving.id}
        {@const end = spotOf(travelEnd!, moving.seat)}
        {@const f = game.setup.players[moving.seat]!.faction}
        {@const url = look.piece(f.id, PART[moving.kind])}
        {@const chips = [
          ...(moving.workers ? [{ fill: f.color, n: moving.workers, dark: isLight(f.color) }] : []),
          ...(Object.entries(moving.resources) as [Resource, number][]).map(([r, n]) => ({ fill: RESOURCE_COLOR[r], n, dark: r === 'food' || r === 'metal' })),
        ]}
        <g class="travel" use:walk={moving}>
          {#if url}
            {@render pieceArt(url, f.color, end[0], end[1], moving.kind !== 'workers')}
          {:else if moving.kind === 'mechs'}
            <path d={MECH} transform="translate({end[0]} {end[1]})" fill={f.color} class="mech" />
            <text x={end[0]} y={end[1] + LABEL_Y.mech} class="piece-text small" class:dark={isLight(f.color)}>{f.name[0]}</text>
          {:else if moving.kind === 'workers'}
            <path d={MEEPLE} transform="translate({end[0]} {end[1]})" fill={f.color} class="worker" />
            <text x={end[0]} y={end[1] + LABEL_Y.worker} class="piece-text small" class:dark={isLight(f.color)}>1</text>
          {:else}
            <circle cx={end[0]} cy={end[1]} r="6.5" fill={f.color} class="character" />
            <text x={end[0]} y={end[1] + LABEL_Y.character} class="piece-text" class:dark={isLight(f.color)}>{f.name[0]}</text>
          {/if}
          {#each chips as chip, ci (ci)}
            {@const cx = end[0] + (ci - (chips.length - 1) / 2) * 10}
            <circle {cx} cy={end[1] - 13} r="4.5" fill={chip.fill} class="cargo" />
            <text x={cx} y={end[1] - 11} class="piece-text small" class:dark={chip.dark}>{chip.n}</text>
          {/each}
        </g>
      {/key}
    {/if}
  </g>
</svg>
  <div class="zoom">
    {#if !clear}
      <button aria-label="Zoom in" onclick={() => zoomBy(0.65)}>+</button>
      <button aria-label="Zoom out" onclick={() => zoomBy(1.55)}>−</button>
      <button aria-label="Whole map" class:not-phone={!!onExplore} onclick={() => glide(fitView(limits.world, aspect, limits), 450)}>⤢</button>
      {#if onExplore}<button aria-label="Open the map screen" class="phone-only" onclick={onExplore}>⤢</button>{/if}
    {/if}
    {#if onClear}
      <button aria-label={clear ? 'Show everything again' : 'Clear display'} aria-pressed={clear} class="phone-only" class:on={clear} onclick={onClear}>👁</button>
    {/if}
  </div>
</div>

<style>
  .map {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .map-picture {
    pointer-events: none;
  }
  .token-art {
    pointer-events: none;
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
  /* A phone held sideways: in a row along the bottom, clear of the round and bonus cards above. */
  @media (pointer: coarse) {
    @container screen (max-height: 500px) {
      .zoom {
        flex-direction: row;
      }
    }
  }
  /* Phone-only buttons (clear view, map screen), and the desktop button they stand in for. */
  .phone-only {
    display: none;
  }
  @media (pointer: coarse) {
    @container screen (max-height: 500px) {
      .phone-only {
        display: block;
      }
      .not-phone {
        display: none;
      }
    }
  }
  .zoom button.on {
    background: var(--accent);
    color: var(--on-accent);
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
  /* Over the map picture: see-through (still tappable), with faint edges or none. */
  .hex.painted {
    stroke: none;
  }
  .hex.painted.edges {
    stroke: rgb(255 246 220 / 0.28);
    stroke-width: 0.8;
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
    fill: none;
    pointer-events: none;
    animation: home-glow 1.6s ease-in-out infinite;
  }
  @keyframes home-glow {
    50% {
      opacity: 0.35;
    }
  }
  .outline {
    fill: none;
    pointer-events: none;
  }
  .home.crested {
    stroke: none;
  }
  .home-crest {
    pointer-events: none;
  }
  .outline.lit,
  .home.lit {
    stroke: #fff6c8;
    /* Easy to spot even zoomed out (unused bases are a dull grey); no glow filter, which is slow to redraw as it pulses. */
    stroke-width: 3.5;
    cursor: pointer;
    animation: pulse 1.4s ease-in-out infinite;
  }
  .outline.selected,
  .home.selected {
    stroke: var(--glow);
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
    stroke: var(--glow);
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
    stroke: var(--glow);
    stroke-width: 3;
  }
  .travel {
    pointer-events: none;
  }
  .flight {
    stroke: var(--glow);
    stroke-width: 1;
    transform-box: fill-box;
    transform-origin: center;
    pointer-events: none;
  }
  .cargo {
    stroke: var(--glow);
    stroke-width: 1;
  }
  .character,
  .mech,
  .worker,
  .structure,
  .resource {
    stroke: #1e1a16;
    stroke-width: 1;
    stroke-linejoin: round;
  }
  .structure {
    stroke: #fff;
  }
  /* A light faction's structure (Polonia's white) keeps a dark edge. */
  .structure.light {
    stroke: #1e1a16;
  }
  .piece-art,
  .piece-base,
  .count-badge {
    pointer-events: none;
  }
  .piece-art {
    filter: drop-shadow(0 0.6px 0.8px rgb(0 0 0 / 0.6));
  }
  .piece-base {
    stroke: #1e1a16;
    stroke-width: 0.6;
  }
  .count-badge {
    stroke: #1e1a16;
    stroke-width: 0.5;
  }
  .ghost {
    opacity: 0;
  }
  .piece-text.tiny {
    font-size: 4.5px;
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
