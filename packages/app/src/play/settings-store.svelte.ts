// The settings in use, live: the settings screen changes them and the game
// reads them as it goes, so a change takes effect at once, mid-game too.
import { loadSettings, saveSettings, type Settings } from './settings';

export const settings: Settings = $state(loadSettings());

export function changeSettings(change: Partial<Settings>) {
  Object.assign(settings, change);
  saveSettings({ ...settings });
}
