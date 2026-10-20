// Constants shared by the room's still (reduced motion) and scrubbed controllers. Dependency-free.

/** lib/stage dots.shape slots (lib/dots/types SHAPE_ORDER): ping-hero 0 … envelope 5. */
export const HERO_SHAPE = 0;
export const SEAT_SHAPE = 1;
export const CONTACT_SHAPE = 5;

/** How long the boop line stays in the bubble after a sent message. */
export const BOOP_HOLD_MS = 3200;

/**
 * Zone split for stage.dots (the room's half of the lib/stage contract):
 *   hero zone  #about's top still below the viewport bottom (before #about "top bottom", where
 *              roomInView turns true). The hero scrub writes only heroProgress, and the renderer
 *              derives the hero release (shape 0 → 1 and its disperse) from heroProgress itself.
 *              So the room hands stage.dots back to lib/stage's initial values, which put shape 0
 *              in figure.ping's rect at HANDOFF_AT on the way back up.
 *   room zone  from #about "top bottom" down (room, exit, and contact): the room scrubs write it all.
 * Glow is the one hero-zone value that moves: it follows the hero's night amount (heroNight), so
 * it meets the room's glow without a jump and is 0 again before the hand-off (.48 < .5).
 */
export const HERO_REST = { shape: HERO_SHAPE, disperse: 0, opacity: 1, glow: 0, stream: 0 } as const;

/** The hero pin's night span: heroProgress .5 → 1 (desktop pin only). Night is wanted from its midpoint. */
export const HERO_NIGHT_FROM = 0.5;

/** How far into its night span the hero pin is, 0..1 (0 when the hero doesn't pin). */
export function heroNight(heroProgress: number, pinned: boolean): number {
  if (!pinned) return 0;
  const n = (heroProgress - HERO_NIGHT_FROM) / (1 - HERO_NIGHT_FROM);
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Laid out and not display:none (the contact anchor is hidden below 1024 px). */
export function visible(el: Element): boolean {
  return el.getClientRects().length > 0;
}
