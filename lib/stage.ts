// Shared stage state between the hero (Phase 4) and the dot stage (Phase 5).
// Dependency-free so first-load islands can import it. One tiny store: the hero
// scrub writes progress, the dots read it; the hero registers the figure.ping
// element so the dots can lay shape 0 inside its rect for the one-frame hand-off.

export type Handoff = "still" | "dots";

/** Where the current shape is laid out: the room box or the contact anchor (components/room/roomStage.ts). */
export type DotsAnchor = "room" | "contact";

/** A point the dot pupils should look at (client px), or null for the cursor. */
export type LookTarget = { x: number; y: number } | null;

export type StageState = {
  /** Hero pin progress 0..1 (desktop). Mobile: 0 until Ping's top reaches the viewport top, then 1. */
  heroProgress: number;
  /** Which Ping is visible: the image still or the dot cloud. */
  handoff: Handoff;
  /** True while the hero section intersects the viewport. */
  heroInView: boolean;
  /** True while the projection room (#about) intersects the viewport. */
  roomInView: boolean;
  /**
   * Dot-stage drive values, read by the renderer every frame. shape: 0 ping-hero,
   * 1 ping-seat, 2 braces, 3 db-net, 4 terminal, 5 envelope (fractional = morphing).
   * Zone split: above #about ("top bottom") the room controller keeps
   * {shape 0, disperse 0, opacity 1, stream 0} with glow = the hero's night
   * amount, and the renderer derives the hero release from heroProgress itself.
   * From #about down, the room and contact scrubs (components/room) write every
   * field. The hero writes heroProgress only. The renderer never writes dots.
   * stream: legacy contact send progress, kept at 0 (the renderer owns the send).
   */
  dots: { shape: number; disperse: number; opacity: number; glow: number; stream: number };
  /** Where the dot shapes are laid out (room box or the contact anchor). */
  anchor: DotsAnchor;
  /** Skill-chip hover/focus: where the dot pupils should look (null = cursor). */
  look: LookTarget;
  /** Skill bubble text beside the shape, e.g. "used in Type Racer" (null = hidden). */
  bubble: string | null;
};

let state: StageState = {
  heroProgress: 0,
  handoff: "still",
  heroInView: true,
  roomInView: false,
  dots: { shape: 0, disperse: 0, opacity: 1, glow: 0, stream: 0 },
  anchor: "room",
  look: null,
  bubble: null,
};
const listeners = new Set<(s: StageState, prev: StageState) => void>();
let pingFigure: HTMLElement | null = null;

export const stage = {
  get(): StageState {
    return state;
  },
  set(patch: Partial<StageState>): void {
    const prev = state;
    const next = { ...state, ...patch };
    if ((Object.keys(patch) as (keyof StageState)[]).every((k) => Object.is(next[k], prev[k]))) return;
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

/** Merge a partial dots patch (keeps the other drive values). */
export function setDots(patch: Partial<StageState["dots"]>): void {
  stage.set({ dots: { ...state.dots, ...patch } });
}

/** Hero progress at which the still swaps to dots in one frame (blueprint §3.1). */
export const HANDOFF_AT = 0.48;
