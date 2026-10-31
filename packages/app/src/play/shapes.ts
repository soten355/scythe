// Outlines for the pieces on the map, as SVG paths centred on 0,0 (about 13
// units across): a meeple for a worker and a squat two-legged walker for a
// mech. The character stays a plain circle. Original shapes.

/** A worker: round head, arms out, two legs. */
export const MEEPLE =
  'M2.4-4.4A2.4 2.4 0 1 1-2.4-4.4A2.4 2.4 0 1 1 2.4-4.4Z' +
  'M-1.6-2.3L-5.7-1Q-6.7-.5-6.1.6L-3 1.3L-4.6 5.5Q-4.9 6.4-4 6.4H-1.4L0 3.6L1.4 6.4H4Q4.9 6.4 4.6 5.5L3 1.3L6.1.6Q6.7-.5 5.7-1L1.6-2.3Z';

/** A mech's parts, in the order it's put together: two stout legs with wide feet, a hull with a sloped top, short arms. */
export const MECH_PARTS = [
  'M-4.2 1.6H-1.8L-2.2 4.6L-.8 6.6H-5.8L-4.4 4.6Z M4.2 1.6H1.8L2.2 4.6L.8 6.6H5.8L4.4 4.6Z',
  'M-4.2-6.2H4.2L6.2-2.2V.6L4.4 1.6H-4.4L-6.2.6V-2.2Z',
  'M-6.2-3.8H-7.8V1.2H-6.2Z M6.2-3.8H7.8V1.2H6.2Z',
] as const;

/** A whole mech. */
export const MECH = MECH_PARTS.join(' ');

/** Where a piece's label sits, relative to its centre. */
export const LABEL_Y = { worker: 3.2, mech: 0.6, character: 3 } as const;
