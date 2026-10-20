// Constants shared by the room's still (reduced motion) and scrubbed controllers. Dependency-free.

/** lib/stage dots.shape slots (lib/dots/types SHAPE_ORDER): ping-hero 0 … envelope 5. */
export const HERO_SHAPE = 0;
export const SEAT_SHAPE = 1;
export const CONTACT_SHAPE = 5;

/** How long the boop line stays in the bubble after a sent message. */
export const BOOP_HOLD_MS = 3200;

/** Laid out and not display:none (the contact anchor is hidden below 1024 px). */
export function visible(el: Element): boolean {
  return el.getClientRects().length > 0;
}
