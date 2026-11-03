// Each faction's own pictures (crest, character, mech), for the parts of the
// game outside the board: crests, the fight screens and the faction's own
// screen. The app sets the theme here once it's read from the device;
// components ask for a faction's picture by its ID and redraw when it changes.
import { DEFAULT_THEME, factionSlot, type FactionPart, type Theme } from './theme';

const current = $state<{ pictures: Theme['pictures'] }>({ pictures: DEFAULT_THEME.pictures });

export function useFactionArt(theme: Theme) {
  current.pictures = theme.pictures;
}

/** The faction's picture for that part, if the theme has one. */
export const factionPicture = (factionId: string, part: FactionPart): string | undefined => current.pictures[factionSlot(factionId, part)];
