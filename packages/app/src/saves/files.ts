// Save files: out to the Files app, AirDrop or Downloads, and back in.
import { fileName, parseSaveFile, saveFileText, type SavedGame } from './save';

/**
 * Hands a save to the share sheet where there is one (iPhone: Save to Files,
 * AirDrop), otherwise downloads it.
 */
export async function exportSave(save: SavedGame): Promise<void> {
  const name = fileName(save);
  const file = new File([saveFileText(save)], name, { type: 'application/json' });
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

/** Reads and checks a chosen file. Throws, in plain words, if it's not a good save. */
export async function readSaveFile(file: File): Promise<SavedGame> {
  return parseSaveFile(await file.text());
}
