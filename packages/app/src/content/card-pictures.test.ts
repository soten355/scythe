import { describe, expect, it } from 'vitest';
import type { EncounterCard } from '@scythe/engine';
import { CARD_PICTURE, cardLook, pictureRef, picturesFor, readPictures } from './card-pictures';

const JPEG = 'data:image/jpeg;base64,/9j/4AAQ';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const card = (more: Partial<EncounterCard> = {}): EncounterCard => ({
  id: 'c1',
  name: 'The ford',
  story: 'A cart is stuck in the river.',
  options: [0, 1, 2].map((i) => ({ text: `o${i}`, cost: {}, gain: { coins: 1 } })) as EncounterCard['options'],
  ...more,
});

describe('encounter card pictures', () => {
  it('are kept once each, under a short reference made from the picture itself', () => {
    expect(pictureRef(JPEG)).toMatch(/^pic-[a-z0-9]+$/);
    expect(pictureRef(JPEG)).toBe(pictureRef(JPEG));
    expect(pictureRef(JPEG)).not.toBe(pictureRef(PNG));
  });

  it('are shrunk to a wide JPEG of about 100 KB', () => {
    expect(CARD_PICTURE).toEqual({ best: { width: 768, height: 512 }, max: 768, type: 'image/jpeg' });
  });

  it('show what the card asks for: by default the story, and the picture too when it has one', () => {
    expect(cardLook(card(), undefined)).toEqual({ story: 'A cart is stuck in the river.' });
    expect(cardLook(card({ picture: 'pic-1' }), JPEG)).toEqual({ picture: JPEG, story: 'A cart is stuck in the river.' });
    expect(cardLook(card({ picture: 'pic-1', show: 'picture' }), JPEG)).toEqual({ picture: JPEG });
    expect(cardLook(card({ picture: 'pic-1', show: 'story' }), JPEG)).toEqual({ story: 'A cart is stuck in the river.' });
    expect(cardLook(card({ picture: 'pic-1', show: 'none' }), JPEG)).toEqual({});
    // No story written: nothing to show for it.
    expect(cardLook(card({ story: '', picture: 'pic-1', show: 'both' }), JPEG)).toEqual({ picture: JPEG });
  });

  it('shows the story instead when the picture is not on this device', () => {
    expect(cardLook(card({ picture: 'pic-1', show: 'picture' }), undefined)).toEqual({ story: 'A cart is stuck in the river.' });
    expect(cardLook(card({ picture: 'pic-1', show: 'both' }), undefined)).toEqual({ story: 'A cart is stuck in the river.' });
  });

  it('go in a deck file: only those its cards use', () => {
    const kept = { 'pic-a': JPEG, 'pic-b': PNG, 'pic-c': JPEG };
    expect(picturesFor([card({ picture: 'pic-a' }), card({ id: 'c2' }), card({ id: 'c3', picture: 'pic-zz' })], kept)).toEqual({ 'pic-a': JPEG });
  });

  it('are read from a file only as inline pictures under proper references', () => {
    expect(readPictures({ 'pic-a': JPEG, 'pic-b': 'https://example.com/x.png', 'nope': PNG, 'pic-c': 'javascript:alert(1)' })).toEqual({ 'pic-a': JPEG });
    expect(readPictures(undefined)).toEqual({});
    expect(readPictures('x')).toEqual({});
  });
});
