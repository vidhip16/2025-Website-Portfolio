// Remembers where the visitor was on `/` when they opened a project, so
// "Back to the gallery" can return them to the same spot (§6.3, §6.4).
// sessionStorage only; every access is guarded (private mode, blocked storage).
//
// The position is stored relative to #work (how far the viewport top sat below the
// section's top), never as a raw window.scrollY. On desktop the hero pin adds 140vh of
// spacing above #work, but only once the lazy hero controller has loaded; a raw scrollY
// measured with the pin would land 140vh too far in a document that has no pin yet (a
// reload on the detail page, a new tab). Relative to #work it is right either way, and
// when the pin is added later heroScrollMotion shifts the scroll by the pin length, so
// the same content stays in view.

const POS = "vp:work-offset";
const RESTORE = "vp:work-restore";

/** The top of #work in document coordinates, or null when the section isn't mounted. */
function workTop(): number | null {
  const work = document.getElementById("work");
  return work ? work.getBoundingClientRect().top + window.scrollY : null;
}

export function rememberScroll(): void {
  try {
    const top = workTop();
    if (top === null) return;
    sessionStorage.setItem(POS, String(Math.round(window.scrollY - top)));
  } catch {
    /* storage blocked: the back link falls back to /#work */
  }
}

export function hasRememberedScroll(): boolean {
  try {
    return sessionStorage.getItem(POS) !== null;
  } catch {
    return false;
  }
}

/** Called by the back link right before it navigates to `/`. */
export function requestRestore(): void {
  try {
    sessionStorage.setItem(RESTORE, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Returns the document Y to scroll to, once, if a restore was requested: #work's
 * current top plus the stored offset. Call it after `/` has laid out.
 */
export function takeRestore(): number | null {
  try {
    if (sessionStorage.getItem(RESTORE) !== "1") return null;
    sessionStorage.removeItem(RESTORE);
    const stored = sessionStorage.getItem(POS);
    const top = workTop();
    if (stored === null || top === null) return null;
    const offset = Number(stored);
    return Number.isFinite(offset) ? Math.max(0, Math.round(top + offset)) : null;
  } catch {
    return null;
  }
}
