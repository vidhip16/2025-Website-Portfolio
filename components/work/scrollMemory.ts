// Remembers where the visitor was on `/` when they opened a project, so
// "Back to the gallery" can return them to the same spot (§6.3, §6.4).
// sessionStorage only; every access is guarded (private mode, blocked storage).
//
// The position is kept flat (lib/heroPin): as if the hero's desktop pin were not in the page. The
// pin comes and goes (a cached controller has it by the time Work restores, a fresh mount has not
// built it yet), and a raw scrollY would then land one pin length off.
import { toFlatY } from "@/lib/heroPin";

const POS = "vp:work-scroll";
const RESTORE = "vp:work-restore";

export function rememberScroll(): void {
  try {
    sessionStorage.setItem(POS, String(Math.round(toFlatY(window.scrollY))));
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

/** Returns the stored (flat) position once, if a restore was requested. Pass it through `fromFlatY`. */
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
