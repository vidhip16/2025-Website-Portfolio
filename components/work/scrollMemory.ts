// Remembers where the visitor was on `/` when they opened a project, so
// "Back to the gallery" can return them to the same spot (§6.3, §6.4).
// sessionStorage only; every access is guarded (private mode, blocked storage).

const POS = "vp:work-scroll";
const RESTORE = "vp:work-restore";

export function rememberScroll(): void {
  try {
    sessionStorage.setItem(POS, String(Math.round(window.scrollY)));
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

/** Returns the stored position once, if a restore was requested. */
export function takeRestore(): number | null {
  try {
    if (sessionStorage.getItem(RESTORE) !== "1") return null;
    sessionStorage.removeItem(RESTORE);
    const y = Number(sessionStorage.getItem(POS));
    return Number.isFinite(y) && y >= 0 ? y : null;
  } catch {
    return null;
  }
}
