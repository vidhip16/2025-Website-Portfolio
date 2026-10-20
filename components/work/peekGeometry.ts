// Geometry of the peeking mascot (PeekPing.tsx), shared with the lazy motion
// controller that moves the pupils. No imports, so the client chunk stays tiny.

/** Viewbox of the peek drawing; all values below are in these units. */
export const PEEK_VIEWBOX = { w: 200, h: 150 } as const;

export const EYE_R = 21;

/** Pupils are 35% of the eye radius (§1.1). */
export const PUPIL_R = Math.round(EYE_R * 0.35);

export const EYES = [
  { cx: 74, cy: 84 },
  { cx: 126, cy: 84 },
] as const;

/** Max pupil travel from the eye centre. */
export const PUPIL_TRAVEL = EYE_R - PUPIL_R - 3;
