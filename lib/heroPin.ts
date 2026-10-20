// Scroll positions that survive the hero's desktop pin coming and going (heroScrollMotion: a
// reload, a Pause/Play or 1024 px rebuild).
//
// The pin adds `end − start` px of spacing above everything after the hero, so one scrollY means
// different content with and without it. Such a position is kept "flat", as if the pin were not in
// the page, and converted back with whatever pin the page has when it is restored. Pure functions:
// the caller passes its live pin (null while it has none, and then flat and raw are the same).

export type HeroPin = {
  /** Scroll position where the pin starts. */
  start: number;
  /** Scroll position where it ends (start + the pin length). */
  end: number;
};

/** The scroll position as if the pin were not in the page. Inside the pin → the hero's top. */
export function toFlatY(y: number, pin: HeroPin | null): number {
  if (!pin) return y;
  return y >= pin.end ? y - (pin.end - pin.start) : Math.min(y, pin.start);
}

/**
 * The scroll position, in the page as it is now, of a flat one. Past the hero (`heroHeight`, the
 * section's own height) it shifts by the pin; at the hero it stays.
 */
export function fromFlatY(flat: number, pin: HeroPin | null, heroHeight: number): number {
  return pin && flat > pin.start + heroHeight ? flat + (pin.end - pin.start) : flat;
}
