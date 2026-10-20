// Skill chip click → the project's canonical mosaic tile: scroll the wall into view, move the tile's
// looping track until the tile is inside it, then focus the tile. Falls back to the list view's link
// or the work index link when the mosaic is hidden (View as list). Loaded on the first chip click.
// lib/scroll (Lenis) and the mosaic's reveal helpers are imported lazily: both are already loaded
// by then (SmoothScroll and WorkClient start them after load + idle).

type FocusOpts = FocusOptions & { focusVisible?: boolean };

const shown = (el: Element | null | undefined): el is HTMLElement =>
  !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

const navHeight = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 64;

/** Scroll Y that centres `frame` in the area under the nav (or puts its top under the nav if taller). */
function centredY(frame: HTMLElement): number {
  const nav = navHeight();
  const r = frame.getBoundingClientRect();
  const room = window.innerHeight - nav;
  const top = r.top + window.scrollY;
  return Math.max(0, Math.round(r.height < room ? top - nav - (room - r.height) / 2 : top - nav));
}

/** Resolves once window.scrollY has held still for a few frames (Lenis or native smooth scroll). */
function settled(timeoutMs = 2500): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    let last = window.scrollY;
    let still = 0;
    const step = () => {
      const y = window.scrollY;
      still = Math.abs(y - last) < 0.5 ? still + 1 : 0;
      last = y;
      if (still >= 6 || performance.now() - start > timeoutMs) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/** False when no tile, list link or index link is on the page (the caller navigates instead). */
export async function goToProject(slug: string, smooth: boolean): Promise<boolean> {
  const q = CSS.escape(slug);
  const tile = document.querySelector<HTMLElement>(`a[data-tile][data-canonical][data-slug="${q}"]`);
  const mosaic = tile?.closest<HTMLElement>("[data-mosaic]");

  let target: HTMLElement | undefined;
  let frame: HTMLElement | undefined;
  if (shown(tile) && shown(mosaic)) {
    target = tile;
    frame = mosaic;
  } else {
    target = [`ul[data-list-view] a[href="/work/${q}"]`, `ol#work-index a[data-index-link="${q}"]`]
      .map((sel) => document.querySelector<HTMLElement>(sel))
      .find(shown);
    frame = target;
  }
  if (!target || !frame) return false;

  const y = centredY(frame);
  try {
    const { scrollToTarget } = await import("@/lib/scroll");
    scrollToTarget(y, !smooth);
  } catch {
    window.scrollTo({ top: y, behavior: smooth ? "smooth" : "instant" });
  }
  await settled();

  if (target === tile && mosaic) {
    // The tracks loop inside an overflow-clipped wall: shift this one until the tile is in view.
    const track = tile.closest<HTMLElement>("[data-track]");
    if (track) {
      try {
        const { revealDelta, shiftTrack } = await import("@/components/work/reveal");
        const m = mosaic.getBoundingClientRect();
        const top = Math.max(m.top, navHeight());
        const bottom = Math.min(m.bottom, window.innerHeight);
        const dy = bottom > top ? revealDelta(tile, new DOMRect(m.left, top, m.width, bottom - top)) : 0;
        if (dy) shiftTrack(track, dy);
      } catch {
        /* the tile is focused regardless */
      }
    }
  }
  const opts: FocusOpts = { preventScroll: true, focusVisible: true };
  target.focus(opts);
  return true;
}
