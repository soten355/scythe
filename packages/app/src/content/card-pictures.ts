// Pictures on encounter cards. A card holds only a short reference
// ("pic-…", made from the picture itself, so the same picture is kept once);
// the pictures are kept on the device and travel in deck files, never in
// saves, so saves stay small. A game opened where a picture isn't kept shows
// the card's story instead.
import type { EncounterCard } from '@scythe/engine';

/** Shrunk to this as it comes in: 3:2 (the owner's choice), JPEG, about 100 KB. Other shapes are shown cropped to 3:2. */
export const CARD_PICTURE = { best: { width: 768, height: 512 }, max: 768, type: 'image/jpeg' } as const;

/** A short, stable reference for a picture: the same picture always gets the same one. */
export function pictureRef(url: string): string {
  // cyrb53: a quick 53-bit string hash.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < url.length; i++) {
    const ch = url.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `pic-${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
}

/** What a card shows above its options: the story by default, and the picture too if it has one; the story instead of a picture this device doesn't have. */
export function cardLook(card: Pick<EncounterCard, 'story' | 'picture' | 'show'>, picture: string | undefined): { picture?: string; story?: string } {
  const show = card.show ?? (card.picture ? 'both' : 'story');
  const wantsPicture = show === 'picture' || show === 'both';
  const hasPicture = wantsPicture && !!card.picture && !!picture;
  const wantsStory = show === 'story' || show === 'both' || (wantsPicture && !hasPicture);
  return { ...(hasPicture && { picture }), ...(wantsStory && card.story && { story: card.story }) };
}

/** The pictures these cards use, out of those kept. */
export function picturesFor(cards: EncounterCard[], kept: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of cards) if (c.picture && kept[c.picture]) out[c.picture] = kept[c.picture]!;
  return out;
}

const PICTURE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const REF = /^pic-[a-z0-9]{1,24}$/;

/** The pictures in a file: only inline images under proper references. */
export function readPictures(data: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data || typeof data !== 'object') return out;
  for (const [ref, url] of Object.entries(data)) if (REF.test(ref) && typeof url === 'string' && PICTURE.test(url)) out[ref] = url;
  return out;
}
