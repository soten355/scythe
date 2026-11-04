import { describe, expect, it } from 'vitest';
import { backdropPicture, boardLook, clearPicture, copyFactionPictures, DEFAULT_THEME, FACTION_PARTS, factionSlot, parseThemeFile, pictureSpec, setColor, setPicture, SLOTS, themeFileText, type Theme } from './theme';
import { ENCOUNTER_ICON, TERRAIN_ICONS, TUNNEL_ICON } from '../play/icons';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const JPEG = 'data:image/jpeg;base64,/9j/4AAQ';

describe('the board theme', () => {
  it('has a slot for the map background, each terrain (art and symbol), the markers and the resource tokens', () => {
    const ids = SLOTS.map((s) => s.id);
    expect(ids).toContain('background');
    for (const t of ['farm', 'forest', 'mountain', 'tundra', 'village', 'lake', 'factory']) {
      expect(ids).toContain(`hex.${t}`);
      expect(ids).toContain(`symbol.${t}`);
    }
    expect(ids).toEqual(expect.arrayContaining(['symbol.tunnel', 'symbol.encounter', 'token.oil', 'token.metal', 'token.wood', 'token.food']));
    expect(new Set(ids).size).toBe(ids.length);
    expect(SLOTS.every((s) => s.label && s.group)).toBe(true);
  });

  it('tells the best size for each slot, in multiples of 16 pixels, fitting the hex shape for hex art', () => {
    expect(pictureSpec('background').best).toEqual({ width: 1600, height: 896 });
    expect(pictureSpec('hex.forest').best).toEqual({ width: 448, height: 512 });
    expect(pictureSpec('symbol.tunnel').best).toEqual({ width: 256, height: 256 });
    for (const slot of SLOTS) {
      const { best, max } = pictureSpec(slot.id);
      expect(best.width % 16).toBe(0);
      expect(best.height % 16).toBe(0);
      // Kept at that size: nothing is lost shrinking it.
      expect(Math.max(best.width, best.height)).toBe(max);
      expect(slot.hint).toContain(`${best.width} × ${best.height} pixels`);
    }
  });

  it('shrinks pictures to suit each slot: big backgrounds, smaller hexes, small symbols (kept see-through)', () => {
    expect(pictureSpec('background')).toMatchObject({ max: 1600, type: 'image/jpeg' });
    expect(pictureSpec('hex.forest')).toMatchObject({ max: 512, type: 'image/png' });
    expect(pictureSpec('symbol.forest')).toMatchObject({ max: 256, type: 'image/png' });
    expect(pictureSpec('token.oil')).toMatchObject({ max: 256, type: 'image/png' });
  });

  it('draws the usual look with no theme', () => {
    const look = boardLook(DEFAULT_THEME);
    expect(look.background).toBeUndefined();
    expect(look.art('forest')).toBeUndefined();
    expect(look.fill('forest')).toBe('#4f7f48');
    expect(look.symbol('forest')).toEqual(TERRAIN_ICONS.forest);
    expect(look.tunnel).toEqual(TUNNEL_ICON);
    expect(look.encounter).toEqual(ENCOUNTER_ICON);
    expect(look.token('oil')).toBeUndefined();
  });

  it('uses the pictures and colours set, and hides a terrain symbol over its art unless asked', () => {
    let theme: Theme = setPicture(DEFAULT_THEME, 'hex.forest', JPEG);
    theme = setPicture(theme, 'symbol.mountain', PNG);
    theme = setPicture(theme, 'token.oil', PNG);
    theme = setPicture(theme, 'background', JPEG);
    theme = setColor(theme, 'farm', '#aabbcc');
    // The map picture behind hexes drawn as usual (not as the hexes' art: see below).
    theme = { ...theme, paintedMap: false };
    const look = boardLook(theme);
    expect(look.art('forest')).toBe(JPEG);
    expect(look.symbol('forest')).toBeUndefined();
    expect(look.symbol('mountain')).toEqual({ image: PNG });
    expect(look.token('oil')).toBe(PNG);
    expect(look.background).toBe(JPEG);
    expect(look.fill('farm')).toBe('#aabbcc');
    expect(boardLook({ ...theme, symbolsOverArt: true }).symbol('forest')).toEqual(TERRAIN_ICONS.forest);
    expect(boardLook(clearPicture(theme, 'hex.forest')).art('forest')).toBeUndefined();
  });

  it('with a map picture, draws see-through hexes over it (the picture is the hexes), with faint edges if wanted', () => {
    let theme = setPicture(setPicture(DEFAULT_THEME, 'background', JPEG), 'hex.forest', JPEG);
    let look = boardLook(theme);
    expect(look.painted).toBe(true);
    expect(look.edges).toBe(true);
    // The picture replaces the hex art and, unless asked, the symbols.
    expect(look.art('forest')).toBeUndefined();
    expect(look.symbol('farm')).toBeUndefined();
    expect(boardLook({ ...theme, symbolsOverArt: true }).symbol('farm')).toEqual(TERRAIN_ICONS.farm);
    expect(boardLook({ ...theme, hexEdges: false }).edges).toBe(false);
    // Turned off: the picture sits behind hexes drawn as usual.
    theme = { ...theme, paintedMap: false };
    look = boardLook(theme);
    expect(look.painted).toBe(false);
    expect(look.art('forest')).toBe(JPEG);
    expect(look.symbol('farm')).toEqual(TERRAIN_ICONS.farm);
    // No map picture: hexes as usual whatever the setting.
    expect(boardLook(DEFAULT_THEME).painted).toBe(false);
  });

  it('goes to a file and back', () => {
    const theme = { ...setColor(setPicture(DEFAULT_THEME, 'hex.lake', JPEG), 'lake', '#123456'), name: 'Misty', symbolsOverArt: true, paintedMap: false, hexEdges: false };
    expect(parseThemeFile(themeFileText(theme))).toEqual(theme);
  });

  it("rejects files that aren't themes, and drops anything it doesn't know or that isn't a picture", () => {
    expect(() => parseThemeFile('nope')).toThrow(/isn't a Scythe theme/);
    expect(() => parseThemeFile('{"format":"scythe-save"}')).toThrow(/isn't a Scythe theme/);
    const odd = JSON.stringify({
      format: 'scythe-theme',
      formatVersion: 1,
      name: 'Odd',
      pictures: { 'hex.forest': JPEG, 'hex.moon': JPEG, 'symbol.lake': 'javascript:alert(1)', 'token.oil': 'https://example.com/x.png' },
      colors: { farm: '#abc', forest: 'red; background: url(x)', moon: '#111111' },
    });
    const theme = parseThemeFile(odd);
    expect(theme.pictures).toEqual({ 'hex.forest': JPEG });
    expect(theme.colors).toEqual({ farm: '#abc' });
    expect(theme.symbolsOverArt).toBe(false);
    expect(theme.paintedMap).toBe(true);
    expect(theme.hexEdges).toBe(true);
  });
});

describe("each faction's own pictures (set in the faction editor)", () => {
  it('has a crest, the character, a mech, a worker and each structure, at sizes in multiples of 16', () => {
    expect(FACTION_PARTS.map((p) => p.part)).toEqual(['crest', 'character', 'mech', 'worker', 'mine', 'mill', 'armory', 'monument']);
    expect(factionSlot('nordic', 'mech')).toBe('faction.nordic.mech');
    expect(pictureSpec('faction.nordic.crest')).toMatchObject({ best: { width: 256, height: 256 }, type: 'image/png' });
    // Figures are taller than wide, and big enough for the fight screen.
    expect(pictureSpec('faction.nordic.character')).toMatchObject({ best: { width: 384, height: 512 }, max: 512, type: 'image/png' });
    expect(pictureSpec('faction.nordic.mine').best).toEqual({ width: 256, height: 256 });
    for (const p of FACTION_PARTS) {
      const { best } = pictureSpec(factionSlot('x', p.part));
      expect(best.width % 16 + (best.height % 16)).toBe(0);
      expect(p.hint).toContain(`${best.width} × ${best.height} pixels`);
    }
    // Not listed in the theme editor: they belong to the faction editor.
    expect(SLOTS.some((s) => s.id.startsWith('faction.'))).toBe(false);
  });

  it('are drawn for that faction only, the usual pieces for the rest', () => {
    const theme = setPicture(DEFAULT_THEME, factionSlot('rusviet', 'mech'), PNG);
    const look = boardLook(theme);
    expect(look.piece('rusviet', 'mech')).toBe(PNG);
    expect(look.piece('rusviet', 'worker')).toBeUndefined();
    expect(look.piece('nordic', 'mech')).toBeUndefined();
  });

  it('move with a faction whose ID changes, or are copied for a duplicate', () => {
    let theme = setPicture(setPicture(DEFAULT_THEME, factionSlot('old', 'crest'), PNG), factionSlot('old', 'mine'), JPEG);
    theme = setPicture(theme, factionSlot('other', 'crest'), JPEG);
    const copied = copyFactionPictures(theme, 'old', 'copy');
    expect(copied.pictures[factionSlot('copy', 'crest')]).toBe(PNG);
    expect(copied.pictures[factionSlot('old', 'crest')]).toBe(PNG);
    const moved = copyFactionPictures(theme, 'old', 'new', { move: true });
    expect(moved.pictures[factionSlot('new', 'mine')]).toBe(JPEG);
    expect(moved.pictures[factionSlot('old', 'mine')]).toBeUndefined();
    expect(moved.pictures[factionSlot('other', 'crest')]).toBe(JPEG);
    // A faction with an ID that contains another's ("old" in "old-2") keeps its own.
    const near = setPicture(theme, factionSlot('old-2', 'crest'), JPEG);
    expect(copyFactionPictures(near, 'old', 'new', { move: true }).pictures[factionSlot('old-2', 'crest')]).toBe(JPEG);
  });

  it('travel in the theme file, and nothing else under a faction is kept', () => {
    const theme = setPicture(DEFAULT_THEME, factionSlot('my.faction', 'character'), PNG);
    expect(parseThemeFile(themeFileText(theme))).toEqual(theme);
    const odd = JSON.stringify({
      format: 'scythe-theme',
      pictures: { 'faction.nordic.crest': PNG, 'faction.nordic.hat': PNG, 'faction..crest': PNG, 'faction.nordic.mech': 'https://example.com/x.png' },
    });
    expect(parseThemeFile(odd).pictures).toEqual({ 'faction.nordic.crest': PNG });
  });
});

describe('fight backdrops', () => {
  it('has one for each terrain, a wide picture kept as JPEG', () => {
    for (const t of ['farm', 'forest', 'mountain', 'tundra', 'village', 'lake', 'factory']) {
      const slot = SLOTS.find((s) => s.id === `backdrop.${t}`);
      expect(slot?.group).toBe('Fight backdrops');
    }
    expect(pictureSpec('backdrop.forest')).toEqual({ best: { width: 1600, height: 896 }, max: 1600, type: 'image/jpeg' });
  });

  it("shows the terrain's own picture; a village without one borrows the farm's, as the drawn scenery does", () => {
    let theme = setPicture(DEFAULT_THEME, 'backdrop.forest', JPEG);
    expect(backdropPicture(theme, 'forest')).toBe(JPEG);
    expect(backdropPicture(theme, 'mountain')).toBeUndefined();
    expect(backdropPicture(theme, 'village')).toBeUndefined();
    theme = setPicture(theme, 'backdrop.farm', PNG);
    expect(backdropPicture(theme, 'village')).toBe(PNG);
    expect(backdropPicture(setPicture(theme, 'backdrop.village', JPEG), 'village')).toBe(JPEG);
    // Anything else (no terrain known) is drawn as usual.
    expect(backdropPicture(theme, '')).toBeUndefined();
  });
});
