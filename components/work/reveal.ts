// Dependency-free helpers for moving a looping mosaic track by a pixel amount.
// Used by WorkClient (keyboard focus, first load) and the lazy motion controller
// (index glide). Tracks are 2 identical copies + a 14 px gap; the loop moves by
// exactly one copy + gap (`loopY` in work.module.css), so L = height / 2 + 7.

const GAP_HALF = 7;

/** Vertical distance (px) that brings `el` fully inside `box` (inset by `pad`). 0 if it already fits. */
export function revealDelta(el: Element, box: DOMRect, pad = 16): number {
  const r = el.getBoundingClientRect();
  const top = box.top + pad;
  const bottom = box.bottom - pad;
  if (r.height > bottom - top || r.top < top) return top - r.top;
  if (r.bottom > bottom) return bottom - r.bottom;
  return 0;
}

/** One loop period of a track in px (one copy plus the gap between copies). */
export function loopLength(track: HTMLElement): number {
  return track.offsetHeight / 2 + GAP_HALF;
}

/** The track's loop animation, or null (reduced motion, hidden column, not started yet). */
export function trackAnimation(track: HTMLElement): Animation | null {
  return track.getAnimations()[0] ?? null;
}

/**
 * Move a track's content by `dy` px (positive = down) without ever calling
 * play()/pause(). Animated tracks seek through currentTime (kept ≥ one
 * duration, so reverse playback never reaches 0); static tracks (reduced
 * motion) take an inline transform clamped to one loop so the column stays covered.
 */
export function shiftTrack(track: HTMLElement, dy: number): void {
  const L = loopLength(track);
  if (!L || !dy) return;
  const anim = trackAnimation(track);
  if (anim) {
    const timing = anim.effect?.getTiming();
    const dur = Number(timing?.duration) || 0;
    if (dur <= 0) return;
    // normal: y = -p·L, so a move of +dy is dp = -dy/L; reverse: y = -(1-p)·L, dp = +dy/L
    const dp = (timing?.direction === "reverse" ? dy : -dy) / L;
    let t = Number(anim.currentTime ?? 0) + dp * dur;
    if (t < dur) t += dur * 1000;
    anim.currentTime = t;
    return;
  }
  const m = /translate3d\(0px,\s*(-?[\d.]+)px/.exec(track.style.transform);
  const y = Math.max(-L, Math.min(0, (m ? parseFloat(m[1]) : 0) + dy));
  track.style.transform = `translate3d(0px, ${y}px, 0px)`;
}
