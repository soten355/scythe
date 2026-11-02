// Text on a faction's colour (unit initials, worker counts, the crest's
// letter): white on dark colours, black on light ones such as white or
// yellow, whichever stands out more.

/** Relative luminance (WCAG) of a "#rgb" or "#rrggbb" colour; 0 for anything else. */
function luminance(color: string): number {
  let hex = color.trim().replace(/^#/, '');
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Whether black text reads better than white on this colour. */
export function isLight(color: string): boolean {
  const l = luminance(color);
  // Contrast with black (l + 0.05) / 0.05 against contrast with white 1.05 / (l + 0.05).
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05);
}

export const DARK_INK = '#1e1a16';
export const LIGHT_INK = '#ffffff';

/** The text colour to use on this colour. */
export const inkOn = (color: string): string => (isLight(color) ? DARK_INK : LIGHT_INK);
