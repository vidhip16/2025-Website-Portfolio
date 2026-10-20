// Workstream R's side of the lib/stage.ts contract, plus the body hooks the room owns. Dependency-free,
// so the first-load islands (SkillChip, DotBubble, RoomScroll) and the lazy controller share it.
//
// Two drive values the renderer needs from R are not declared in lib/stage.ts yet (sharedRequests):
//   stage.anchor      "room" | "contact"   where the current shape is laid out:
//                       "room"    → the fixed box [data-dots-anchor="room"] (DotBubble renders it:
//                                   a min(34vw, 62vh) square centred at 72vw / 50vh on desktop,
//                                   the 42svh band under the nav below 1024 px)
//                       "contact" → the live rect of [data-dots-anchor="contact"] (in #contact)
//   stage.dots.stream 0..1 the contact "send": 0 = in place, 1 = every point streamed off past the
//                       right edge. Point i starts at delay_i ∈ [0, .4] and ends at 1:
//                       local = clamp((stream − delay_i) / (1 − delay_i)), x += easeIn(local) × run.
// They are written through the intersection types below, so this compiles before and after the lead
// adds them to StageState, and reading code falls back to the defaults ("room", 0).
import { setDots, stage, type StageState } from "@/lib/stage";

export type DotsAnchor = "room" | "contact";
export type RoomDots = StageState["dots"] & { stream?: number };
type RoomState = StageState & { anchor?: DotsAnchor; dots: RoomDots };

/** Merge a dots patch, including the not-yet-declared `stream`. */
export function writeDots(patch: Partial<RoomDots>): void {
  const prev = stage.get().dots as RoomDots;
  const next: RoomDots = { ...prev, ...patch };
  const keys = Object.keys(patch) as (keyof RoomDots)[];
  if (keys.every((k) => Object.is(next[k], prev[k]))) return;
  setDots(next);
}

export function getAnchor(s: StageState = stage.get()): DotsAnchor {
  return (s as RoomState).anchor ?? "room";
}

export function setAnchor(anchor: DotsAnchor): void {
  const patch: Partial<StageState> & { anchor: DotsAnchor } = { anchor };
  stage.set(patch);
}

/** Set the skill/boop bubble (null hides it). */
export function setBubble(text: string | null): void {
  stage.set({ bubble: text });
}

/** Clear the bubble only if it still shows `text` (someone else may own it by now). */
export function releaseBubble(text: string): void {
  if (stage.get().bubble === text) stage.set({ bubble: null });
}

// ── body hooks (the room's half of the hero/room colour contract) ─────────────
// The page colour lives only on body (--bg/--fg). The hero scrub tweens it paper → night and sets
// body[data-room="night"] from the tween's midpoint; the room continues that tween and owns the
// attribute while the room is lit (globals.css swaps the focus ring to lilac under it).

let wroteColours = false;
let wroteNight = false;

export function paintBody(bg: string, fg: string): void {
  const st = document.body.style;
  if (st.getPropertyValue("--bg") !== bg) st.setProperty("--bg", bg);
  if (st.getPropertyValue("--fg") !== fg) st.setProperty("--fg", fg);
  wroteColours = true;
}

/** Idempotent: writes only on change. */
export function setNight(on: boolean): void {
  const body = document.body;
  if (on) {
    if (body.dataset.room !== "night") body.dataset.room = "night";
    wroteNight = true;
  } else if (body.dataset.room === "night") {
    delete body.dataset.room;
  }
}

/** Undo the room's body writes (cleanup). Leaves the hero's values alone if the room never wrote. */
export function releaseBody(): void {
  if (wroteColours) {
    document.body.style.removeProperty("--bg");
    document.body.style.removeProperty("--fg");
    wroteColours = false;
  }
  if (wroteNight) {
    setNight(false);
    wroteNight = false;
  }
}

/** Read a colour token from :root (e.g. "--night" → "#170e24"). */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
