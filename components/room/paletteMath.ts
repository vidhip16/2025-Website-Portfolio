// The pure part of the page palette (components/room/palette.ts). Dependency-free, so it runs in
// Node (tests/unit/palette.spec.ts).

/** Night is wanted from this scroll-derived night amount n on (the old tween's midpoint). */
export const NIGHT_AT = 0.5;

/** How long a change between the two palettes takes, in seconds, whatever the scroll does. */
export const FADE_S = 0.28;

/** The palette the scroll asks for: night (moon on night) from n = NIGHT_AT, else paper (ink on paper). */
export const isNight = (n: number): boolean => n >= NIGHT_AT;

/**
 * Phones (< 1024 px): body holds one complete palette and a fixed veil carries the blend on the
 * compositor. Below the midpoint body is paper under a night veil at opacity n; from it on body is
 * night under a paper veil at 1 − n. The result is the same colour as interpolate(paper, night, n)
 * at every n, with body's text colour flipping once, at the midpoint (DECISIONS 36).
 */
export function phoneVeil(n: number): { night: boolean; opacity: number } {
  const night = isNight(n);
  return { night, opacity: night ? 1 - n : n };
}
