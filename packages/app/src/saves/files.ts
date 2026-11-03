// Files: saves, content and themes out to the Files app, AirDrop or Downloads, and
// back in.
import { contentFileName, contentFileText, type Library } from '../content/library';
import { fileName, parseSaveFile, saveFileText, type SavedGame } from './save';
import { themeFileName, themeFileText, type Theme } from '../theme/theme';

/**
 * Hands a file to the share sheet where there is one (iPhone: Save to Files,
 * AirDrop), otherwise downloads it.
 */
async function shareFile(name: string, text: string): Promise<void> {
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      // Closing the share sheet isn't a failure; anything else falls back to a download.
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const exportSave = (save: SavedGame) => shareFile(fileName(save), saveFileText(save));

export const exportContent = (content: Library) => shareFile(contentFileName(content), contentFileText(content));

export const exportTheme = (theme: Theme) => shareFile(themeFileName(theme), themeFileText(theme));

/** Reads and checks a chosen file. Throws, in plain words, if it's not a good save. */
export async function readSaveFile(file: File): Promise<SavedGame> {
  return parseSaveFile(await file.text());
}
