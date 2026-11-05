// The game's look, set in the theme editor: pictures (made by the owner, e.g.
// in ComfyUI) for named slots, and colours. For now, the board: the map
// background, a picture filling each terrain's hexes, each terrain's symbol,
// the tunnel and encounter markers, the resource tokens, and the backdrop
// behind fights on each terrain; and the look and feel: the menus' and
// panels' colours, fonts and pictures. Each faction's
// own pictures (crest, character, mech, worker, structures) are kept here
// too, under the faction's ID, but set in the faction editor. Anything not
// set keeps the usual look. Pictures are kept as data URLs, already shrunk
// (see pictures.ts), so a theme is plain data: kept on the device and saved
// to or opened from a .scythe-theme.json file.
import type { Resource, Structure, Terrain } from '@scythe/engine';
import { ENCOUNTER_ICON, TERRAIN_ICONS, TUNNEL_ICON, type Icon } from '../play/icons';
import { inkOn } from '../play/ink';

export const TERRAINS: Terrain[] = ['farm', 'forest', 'mountain', 'tundra', 'village', 'lake', 'factory'];
const TOKENS: Resource[] = ['oil', 'metal', 'wood', 'food'];

/**
 * A faction's own pictures: its crest, its units and its structures. The
 * character and mech are full figures (fights, the faction's screen, and the
 * map), unless they have their own map pieces (characterMap, mechMap).
 */
export type FactionPart = 'crest' | 'portrait' | 'character' | 'mech' | 'characterMap' | 'mechMap' | 'worker' | Structure;

export type SlotId = 'background' | `hex.${Terrain}` | `symbol.${Terrain | 'tunnel' | 'encounter'}` | `token.${Resource}` | `backdrop.${Terrain}` | 'ui.menu' | 'ui.panel' | `faction.${string}.${FactionPart}`;

export interface Slot {
  id: SlotId;
  group: string;
  label: string;
  /** What makes a good picture for it, shown in the editor. */
  hint: string;
}

const TERRAIN_NAMES: Record<Terrain, string> = {
  farm: 'Farm', forest: 'Forest', mountain: 'Mountain', tundra: 'Tundra', village: 'Village', lake: 'Lake', factory: 'Factory',
};

/** The best size for a slot's pictures, in pixels (multiples of 16): hex art matches the hex's shape (about 7 wide to 8 tall). */
const BEST = {
  background: { width: 1600, height: 896 },
  hex: { width: 448, height: 512 },
  small: { width: 256, height: 256 },
  /** Behind the side panel in a game: tall and narrow. */
  panel: { width: 512, height: 1024 },
  /** The character's face, shown in a circle. */
  portrait: { width: 512, height: 512 },
  /** A standing figure: the character or a mech, on the map and big on the fight screen. */
  figure: { width: 384, height: 512 },
} as const;
const sizeText = (b: { width: number; height: number }) => `Best at ${b.width} × ${b.height} pixels`;

const ON_MAP = `On the map, on a see-through background. ${sizeText(BEST.small)}.`;
const FIGURE = `Standing, facing right, on a see-through background: big in fights and on the faction's screen, and small on the map unless it has its own map piece below. ${sizeText(BEST.figure)}.`;
const MAP_PIECE = (what: string) => `Its piece on the map, in place of the ${what} figure above (empty: the figure, shrunk): e.g. a token, or a simpler, bolder drawing that reads when small. It stands on a base in the faction's colour; on a see-through background. ${sizeText(BEST.figure)}.`;

/** A faction's picture slots, in the order the faction editor lists them. */
export const FACTION_PARTS: { part: FactionPart; label: string; hint: string }[] = [
  { part: 'crest', label: 'Crest', hint: `The faction's emblem: on the side panel, the new game screen, its own screen and the final scores. On a see-through background. ${sizeText(BEST.small)}.` },
  { part: 'portrait', label: 'Portrait', hint: `The character's face, shown in a circle ringed in the faction's colour: on the new game screen, the faction's own screen, fights and the final scores. Keep the face in the middle; the corners are cut off. ${sizeText(BEST.portrait)}.` },
  { part: 'character', label: 'Character', hint: FIGURE },
  { part: 'mech', label: 'Mech', hint: FIGURE },
  { part: 'characterMap', label: 'Character on the map', hint: MAP_PIECE('character') },
  { part: 'mechMap', label: 'Mech on the map', hint: MAP_PIECE('mech') },
  { part: 'worker', label: 'Worker', hint: ON_MAP },
  { part: 'mine', label: 'Mine', hint: ON_MAP },
  { part: 'mill', label: 'Mill', hint: ON_MAP },
  { part: 'armory', label: 'Armory', hint: ON_MAP },
  { part: 'monument', label: 'Monument', hint: ON_MAP },
];
const FACTION_PART_NAMES = new Set<string>(FACTION_PARTS.map((p) => p.part));

export const factionSlot = (factionId: string, part: FactionPart): SlotId => `faction.${factionId}.${part}`;

/** "faction.<id>.<part>" → its faction and part (the ID may itself hold dots), or null. */
function readFactionSlot(slot: string): { id: string; part: FactionPart } | null {
  const m = /^faction\.(.+)\.([a-zA-Z]+)$/.exec(slot);
  return m && FACTION_PART_NAMES.has(m[2]!) ? { id: m[1]!, part: m[2] as FactionPart } : null;
}

/** Every slot, in the order the editor lists them. */
export const SLOTS: Slot[] = [
  { id: 'background', group: 'Map', label: 'Map picture', hint: `The whole map in one painting, made from the map guide so it lines up with the hexes; it zooms and pans with them. ${sizeText(BEST.background)}.` },
  ...TERRAINS.map((t): Slot => ({ id: `hex.${t}`, group: 'Hex art', label: TERRAIN_NAMES[t], hint: `Fills each hex, cropped to the hex shape; see-through parts show the map picture, or else the hex's colour. ${sizeText(BEST.hex)}.` })),
  ...TERRAINS.map((t): Slot => ({ id: `symbol.${t}`, group: 'Hex symbols', label: TERRAIN_NAMES[t], hint: `In the middle of the hex, on a see-through background. ${sizeText(BEST.small)}.` })),
  { id: 'symbol.tunnel', group: 'Markers', label: 'Tunnel', hint: `At the top of tunnel hexes, on a see-through background. ${sizeText(BEST.small)}.` },
  { id: 'symbol.encounter', group: 'Markers', label: 'Encounter', hint: `At the bottom of hexes with an encounter, on a see-through background. ${sizeText(BEST.small)}.` },
  ...TOKENS.map((r): Slot => ({ id: `token.${r}`, group: 'Resource tokens', label: r[0]!.toUpperCase() + r.slice(1), hint: `A resource on the map, on a see-through background. ${sizeText(BEST.small)}.` })),
  { id: 'ui.menu', group: 'Menus and panels', label: 'Menu picture', hint: `Behind the menus: in full on the opening menu, dimmed behind the others so their words stay readable. ${sizeText(BEST.background)}.` },
  { id: 'ui.panel', group: 'Menus and panels', label: 'Side panel picture', hint: `Behind the side panel in a game, dimmed under its words; cropped to the panel's shape. ${sizeText(BEST.panel)}.` },
  ...TERRAINS.map((t): Slot => ({
    id: `backdrop.${t}`,
    group: 'Fight backdrops',
    label: TERRAIN_NAMES[t],
    hint: `Behind fights on this terrain, and behind a faction's own screen when its character stands here${t === 'village' ? " (without one, villages use the farm's)" : ''}. The fighters stand on the ground about 70% of the way down, covering the middle; the picture is cropped at the top and bottom on wide screens. ${sizeText(BEST.background)}.`,
  })),
];

const SLOT_IDS = new Set<string>(SLOTS.map((s) => s.id));

/**
 * A slot's best picture size (`best`), how big its pictures are kept (longest
 * side, `max`, the same: nothing is lost at the best size) and in what
 * format: the map picture as JPEG (it's big, and fills its frame), everything
 * else as PNG, so see-through parts stay see-through.
 */
export function pictureSpec(slot: SlotId): { best: { width: number; height: number }; max: number; type: 'image/jpeg' | 'image/png' } {
  const spec = (best: { width: number; height: number }, type: 'image/jpeg' | 'image/png') => ({ best, max: Math.max(best.width, best.height), type });
  if (slot === 'background' || slot === 'ui.menu' || slot.startsWith('backdrop.')) return spec(BEST.background, 'image/jpeg');
  if (slot === 'ui.panel') return spec(BEST.panel, 'image/jpeg');
  if (slot.startsWith('hex.')) return spec(BEST.hex, 'image/png');
  const part = readFactionSlot(slot)?.part;
  if (part === 'character' || part === 'mech' || part === 'characterMap' || part === 'mechMap') return spec(BEST.figure, 'image/png');
  if (part === 'portrait') return spec(BEST.portrait, 'image/png');
  return spec(BEST.small, 'image/png');
}

/** The menus' and panels' colours. */
export type UiColor = 'background' | 'panel' | 'raised' | 'line' | 'text' | 'accent' | 'highlight';

export const DEFAULT_UI_COLORS: Record<UiColor, string> = {
  background: '#1e1a16',
  panel: '#2a241e',
  raised: '#3a3129',
  line: '#4a4036',
  text: '#efe6d4',
  accent: '#c9a227',
  highlight: '#ffd23f',
};

/** Each colour, the CSS variable the app reads it from, and where it shows (in the editor's order). */
export const UI_COLORS: { id: UiColor; variable: string; label: string; hint: string }[] = [
  { id: 'background', variable: '--bg', label: 'Background', hint: 'Behind the menus and around the map' },
  { id: 'panel', variable: '--panel', label: 'Panels', hint: 'The side panel, the top bar, the mat drawer, pop-up menus' },
  { id: 'raised', variable: '--raised', label: 'Buttons and cards', hint: 'Buttons, list rows, the cards on the menus' },
  { id: 'line', variable: '--line', label: 'Borders', hint: 'Lines between parts of the panels' },
  { id: 'text', variable: '--fg', label: 'Text', hint: 'Words on the menus and panels' },
  { id: 'accent', variable: '--accent', label: 'Accent', hint: 'Main buttons, titles and frames' },
  { id: 'highlight', variable: '--glow', label: 'Highlight', hint: 'What you can tap now and what is chosen, on the map and the mat' },
];

export type FontId = 'system' | 'rounded' | 'georgia' | 'newyork' | 'palatino' | 'baskerville' | 'didot' | 'avenir' | 'futura' | 'typewriter' | 'copperplate' | 'mono';

/** Fonts already on both the iPhone and the Mac, so nothing is downloaded; each falls back to a generic family. */
export const FONTS: { id: FontId; label: string; stack: string }[] = [
  { id: 'system', label: 'System (plain)', stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { id: 'rounded', label: 'Rounded', stack: "ui-rounded, 'SF Pro Rounded', -apple-system, sans-serif" },
  { id: 'avenir', label: 'Avenir Next', stack: "'Avenir Next', Avenir, 'Segoe UI', sans-serif" },
  { id: 'futura', label: 'Futura', stack: "Futura, 'Trebuchet MS', sans-serif" },
  { id: 'georgia', label: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
  { id: 'newyork', label: 'New York', stack: "ui-serif, 'New York', Georgia, serif" },
  { id: 'palatino', label: 'Palatino', stack: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif" },
  { id: 'baskerville', label: 'Baskerville', stack: "Baskerville, 'Baskerville Old Face', Georgia, serif" },
  { id: 'didot', label: 'Didot', stack: "Didot, 'Bodoni 72', Georgia, serif" },
  { id: 'copperplate', label: 'Copperplate', stack: "Copperplate, 'Copperplate Gothic Light', Georgia, serif" },
  { id: 'typewriter', label: 'Typewriter', stack: "'American Typewriter', 'Courier New', monospace" },
  { id: 'mono', label: 'Monospace', stack: 'ui-monospace, Menlo, Consolas, monospace' },
];
const FONT_IDS = new Set<string>(FONTS.map((f) => f.id));
const fontStack = (id: FontId) => (FONTS.find((f) => f.id === id) ?? FONTS[0]!).stack;

export interface Theme {
  name: string;
  /** Data URLs, by slot. */
  pictures: Partial<Record<SlotId, string>>;
  /** Hex colours (where there's no hex art, and while it loads). */
  colors: Partial<Record<Terrain, string>>;
  /** Draw the terrain symbols over hex art (or the map picture) too (off: the art says what the hex is). */
  symbolsOverArt: boolean;
  /** With a map picture: it is the hexes' art, under see-through hexes (off: it sits behind hexes drawn as usual). */
  paintedMap: boolean;
  /** Over a map picture: faint hex edges, so the hexes can be told apart. */
  hexEdges: boolean;
  /** The menus' and panels' colours (anything not set keeps the usual one). */
  uiColors: Partial<Record<UiColor, string>>;
  /** Words on the menus and panels. */
  bodyFont: FontId;
  /** Titles, and the round card and structure bonus tile. */
  headingFont: FontId;
}

export const DEFAULT_THEME: Theme = { name: 'My theme', pictures: {}, colors: {}, symbolsOverArt: false, paintedMap: true, hexEdges: true, uiColors: {}, bodyFont: 'system', headingFont: 'georgia' };

export const DEFAULT_COLORS: Record<Terrain, string> = {
  farm: '#d9c46a',
  forest: '#4f7f48',
  mountain: '#8d837a',
  tundra: '#a9c7bd',
  village: '#c9875c',
  lake: '#5b8fc0',
  factory: '#7a5a8a',
};

export const setPicture = (theme: Theme, slot: SlotId, url: string): Theme => ({ ...theme, pictures: { ...theme.pictures, [slot]: url } });

export function clearPicture(theme: Theme, slot: SlotId): Theme {
  const pictures = { ...theme.pictures };
  delete pictures[slot];
  return { ...theme, pictures };
}

/** A faction's pictures copied to another ID (a duplicate), or moved there (its ID changed). */
export function copyFactionPictures(theme: Theme, from: string, to: string, { move = false } = {}): Theme {
  if (from === to) return theme;
  const pictures = { ...theme.pictures };
  for (const { part } of FACTION_PARTS) {
    const url = pictures[factionSlot(from, part)];
    if (!url) continue;
    pictures[factionSlot(to, part)] = url;
    if (move) delete pictures[factionSlot(from, part)];
  }
  return { ...theme, pictures };
}

/** The CSS variables the app's menus and panels read: the colours and fonts chosen, and readable text on the accent and highlight. */
export function uiStyle(theme: Theme): Record<string, string> {
  const color = (id: UiColor) => theme.uiColors?.[id] ?? DEFAULT_UI_COLORS[id];
  const style: Record<string, string> = {};
  for (const c of UI_COLORS) style[c.variable] = color(c.id);
  style['--on-accent'] = inkOn(color('accent'));
  style['--on-glow'] = inkOn(color('highlight'));
  style['--font-body'] = fontStack(theme.bodyFont ?? DEFAULT_THEME.bodyFont);
  style['--font-heading'] = fontStack(theme.headingFont ?? DEFAULT_THEME.headingFont);
  return style;
}

/** The picture behind a fight on this terrain, if the theme has one (a village without its own borrows the farm's). */
export function backdropPicture(theme: Theme, terrain: string): string | undefined {
  if (!(TERRAINS as string[]).includes(terrain)) return undefined;
  return theme.pictures[`backdrop.${terrain as Terrain}`] ?? (terrain === 'village' ? theme.pictures['backdrop.farm'] : undefined);
}

export const setColor = (theme: Theme, terrain: Terrain, color: string): Theme => ({ ...theme, colors: { ...theme.colors, [terrain]: color } });

/** What the board draws, with the theme's pictures and colours in place of the usual ones. */
export interface BoardLook {
  /** The map picture, drawn in the map guide's frame (see map-picture.ts). */
  background?: string;
  /** The map picture is the hexes' art: hexes are drawn see-through over it. */
  painted: boolean;
  /** Faint edges on see-through hexes. */
  edges: boolean;
  fill: (terrain: Terrain) => string;
  art: (terrain: Terrain) => string | undefined;
  symbol: (terrain: Terrain) => Icon | undefined;
  tunnel: Icon;
  encounter: Icon;
  token: (resource: Resource) => string | undefined;
  /** A faction's own picture for one of its pieces (by faction ID), if it has one. */
  piece: (factionId: string, part: FactionPart) => string | undefined;
}

export function boardLook(theme: Theme): BoardLook {
  const picture = (slot: SlotId) => theme.pictures[slot];
  const asIcon = (slot: SlotId, usual: Icon): Icon => {
    const url = picture(slot);
    return url ? { image: url } : usual;
  };
  const painted = !!picture('background') && theme.paintedMap;
  return {
    ...(picture('background') && { background: picture('background') }),
    painted,
    edges: theme.hexEdges,
    fill: (t) => theme.colors[t] ?? DEFAULT_COLORS[t],
    // A painted map replaces the hex art.
    art: (t) => (painted ? undefined : picture(`hex.${t}`)),
    symbol: (t) => {
      const own = picture(`symbol.${t}`);
      if (own) return { image: own };
      if ((painted || picture(`hex.${t}`)) && !theme.symbolsOverArt) return undefined;
      return TERRAIN_ICONS[t];
    },
    tunnel: asIcon('symbol.tunnel', TUNNEL_ICON),
    encounter: asIcon('symbol.encounter', ENCOUNTER_ICON),
    token: (r) => picture(`token.${r}`),
    // On the map the character and mech use their own map pieces, if they have them.
    piece: (id, part) => (part === 'character' || part === 'mech' ? picture(factionSlot(id, `${part}Map`)) : undefined) ?? picture(factionSlot(id, part)),
  };
}

const FORMAT = 'scythe-theme';
const FORMAT_VERSION = 1;

export const themeFileText = (theme: Theme) => JSON.stringify({ format: FORMAT, formatVersion: FORMAT_VERSION, ...theme });

/** "scythe-theme-misty.scythe-theme.json" */
export const themeFileName = (theme: Theme) => `scythe-theme-${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme'}.scythe-theme.json`;

/** Pictures the app makes or accepts: inline images only (never links to elsewhere, or anything that could run). */
const PICTURE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Reads a theme file, keeping only slots, pictures and colours it knows. Throws, in plain words, if it's not a theme. */
export function parseThemeFile(text: string): Theme {
  const notTheme = new Error("This file isn't a Scythe theme.");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw notTheme;
  }
  if (!data || typeof data !== 'object' || data.format !== FORMAT) throw notTheme;
  if (typeof data.formatVersion === 'number' && data.formatVersion > FORMAT_VERSION) throw new Error('This theme was made by a newer version of the app. Update the app to open it.');
  return readTheme(data);
}

/** A theme from plain data (a theme file's, or a skin's), keeping only slots, pictures and colours it knows. */
export function readTheme(data: Record<string, unknown>): Theme {
  const pictures: Theme['pictures'] = {};
  for (const [slot, url] of Object.entries((data.pictures as Record<string, unknown>) ?? {})) {
    if ((SLOT_IDS.has(slot) || readFactionSlot(slot)) && typeof url === 'string' && PICTURE.test(url)) pictures[slot as SlotId] = url;
  }
  const colors: Theme['colors'] = {};
  for (const [terrain, color] of Object.entries((data.colors as Record<string, unknown>) ?? {})) {
    if ((TERRAINS as string[]).includes(terrain) && typeof color === 'string' && COLOR.test(color)) colors[terrain as Terrain] = color;
  }
  const uiColors: Theme['uiColors'] = {};
  for (const [id, color] of Object.entries((data.uiColors as Record<string, unknown>) ?? {})) {
    if (id in DEFAULT_UI_COLORS && typeof color === 'string' && COLOR.test(color)) uiColors[id as UiColor] = color;
  }
  const font = (v: unknown, usual: FontId): FontId => (typeof v === 'string' && FONT_IDS.has(v) ? (v as FontId) : usual);
  return {
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 60) : DEFAULT_THEME.name,
    pictures,
    colors,
    symbolsOverArt: data.symbolsOverArt === true,
    paintedMap: data.paintedMap !== false,
    hexEdges: data.hexEdges !== false,
    uiColors,
    bodyFont: font(data.bodyFont, DEFAULT_THEME.bodyFont),
    headingFont: font(data.headingFont, DEFAULT_THEME.headingFont),
  };
}
