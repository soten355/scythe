// Shrinks a chosen picture to what its slot needs (see pictureSpec) and
// turns it into a data URL, so themes stay small enough for the phone.
// Browser only (it draws on a canvas).
import { pictureSpec, type SlotId } from './theme';

export async function pictureFor(slot: SlotId, file: Blob): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file couldn't be read as a picture. Try a PNG or JPEG.");
  }
  const { max, type } = pictureSpec(slot);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL(type, 0.85);
}

/** About how much room a data URL takes, in kilobytes. */
export const sizeKb = (url: string) => Math.round((url.length * 3) / 4 / 1024);
