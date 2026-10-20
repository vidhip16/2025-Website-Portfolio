// Geometry of the peeking mascot (PeekPing.tsx), shared with the lazy motion
// controller that moves the pupils. No imports, so the client chunk stays tiny.

/**
 * Viewbox of the peek art (public/ping/ping-peek.webp, 575×600 px, so 200 units
 * wide); all values below are in these units.
 */
export const PEEK_VIEWBOX = { w: 200, h: 208.7 } as const;

/** Nominal eye radius; each eye below carries its measured radius. */
export const EYE_R = 18;

/** Pupils are 35% of the eye radius (§1.1). */
const PUPIL_SCALE = 0.35;
/** Gap kept between the pupil's edge and the rim of the eye dome. */
const RIM = 3;

export const pupilRadius = (eyeR: number) => eyeR * PUPIL_SCALE;
/** Max pupil travel from the eye centre. */
export const pupilTravel = (eyeR: number) => eyeR - pupilRadius(eyeR) - RIM;

export const PUPIL_R = pupilRadius(EYE_R);
export const PUPIL_TRAVEL = pupilTravel(EYE_R);

/** The blank eye domes in the art: left, then right. */
export const EYES = [
  { cx: 51.7, cy: 139.8, r: 17.9 },
  { cx: 125.2, cy: 147.4, r: 18.8 },
] as const;
