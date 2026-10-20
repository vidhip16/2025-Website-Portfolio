// Shared stage state between the hero (Phase 4) and the dot stage (Phase 5).
// Dependency-free so first-load islands can import it. One tiny store: the hero
// scrub writes progress, the dots read it; the hero registers the figure.ping
// element so the dots can lay shape 0 inside its rect for the one-frame hand-off.

export type Handoff = "still" | "dots";

export type StageState = {
  /** Hero pin progress 0..1 (desktop). Mobile: 0 until Ping's top reaches the viewport top, then 1. */
  heroProgress: number;
  /** Which Ping is visible: the image still or the dot cloud. */
  handoff: Handoff;
  /** True while the hero section intersects the viewport. */
  heroInView: boolean;
  /** True while the projection room (#about) intersects the viewport. */
  roomInView: boolean;
};

let state: StageState = { heroProgress: 0, handoff: "still", heroInView: true, roomInView: false };
const listeners = new Set<(s: StageState, prev: StageState) => void>();
let pingFigure: HTMLElement | null = null;

export const stage = {
  get(): StageState {
    return state;
  },
  set(patch: Partial<StageState>): void {
    const prev = state;
    const next = { ...state, ...patch };
    if (
      next.heroProgress === prev.heroProgress &&
      next.handoff === prev.handoff &&
      next.heroInView === prev.heroInView &&
      next.roomInView === prev.roomInView
    )
      return;
    state = next;
    listeners.forEach((l) => l(next, prev));
  },
  subscribe(fn: (s: StageState, prev: StageState) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** The hero registers its figure.ping element (null on unmount). */
export function registerPingFigure(el: HTMLElement | null): void {
  pingFigure = el;
}

/** The figure.ping element, for reading its rect in the hand-off frame. */
export function getPingFigure(): HTMLElement | null {
  return pingFigure;
}

/** Hero progress at which the still swaps to dots in one frame (blueprint §3.1). */
export const HANDOFF_AT = 0.48;
