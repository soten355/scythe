// The theme in use, for the parts of the game outside the board: each
// faction's crest, character and mech (crests, the fight screens and the
// faction's own screen) and the fight backdrops. The app sets the theme here
// once it's read from the device; components ask for a picture and redraw
// when it changes.
import { backdropPicture, DEFAULT_THEME, factionSlot, type FactionPart, type Theme } from './theme';

const current = $state<{ theme: Theme }>({ theme: DEFAULT_THEME });

export function useTheme(theme: Theme) {
  current.theme = theme;
}

/** The faction's picture for that part, if the theme has one. */
export const factionPicture = (factionId: string, part: FactionPart): string | undefined => current.theme.pictures[factionSlot(factionId, part)];

/** The picture behind fights on this terrain, if the theme has one. */
export const backdropNow = (terrain: string): string | undefined => backdropPicture(current.theme, terrain);
