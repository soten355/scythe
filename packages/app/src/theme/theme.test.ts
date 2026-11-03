import { describe, expect, it } from 'vitest';
import { boardLook, clearPicture, DEFAULT_THEME, parseThemeFile, pictureSpec, setColor, setPicture, SLOTS, themeFileText, type Theme } from './theme';
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
