// Where the hero's pin sits in the page, for code that stores or restores a scroll position.
//
// The desktop pin adds `end − start` px of spacing above everything after the hero
// (components/hero/heroScrollMotion.ts), so one scrollY means different content with and without
// it. A position that has to survive a layout change (a reload, "Back to the gallery", a rebuild)
// is therefore kept "flat", as if the pin were not in the page, and converted back with whatever
// pin the page has when it is restored.
//
// Dependency-free: the first-load Work island imports it. The hero controller registers the live
// pin while it has one; with none registered, flat and raw positions are the same number.

export type HeroPin = {
  /** Scroll position where the pin starts. */
  start: number;
  /** Scroll position where it ends (start + the pin length). */
  end: number;
  /** The hero section's own height. */
  height: number;
};

type ReadPin = () => HeroPin | null;

let read: ReadPin | null = null;

/** The hero controller registers how to read its live pin (null while it has none). Returns the unregister. */
export function registerHeroPin(fn: ReadPin): () => void {
  read = fn;
  return () => {
    if (read === fn) read = null;
  };
}

/** The scroll position as if the pin were not in the page. Inside the pin → the hero's top. */
export function toFlatY(y: number): number {
  const pin = read?.();
  if (!pin) return y;
  return y >= pin.end ? y - (pin.end - pin.start) : Math.min(y, pin.start);
}

/** The scroll position, in the page as it is now, of a flat one. Past the hero it shifts by the pin; at the hero it stays. */
export function fromFlatY(flat: number): number {
  const pin = read?.();
  return pin && flat > pin.start + pin.height ? flat + (pin.end - pin.start) : flat;
}
