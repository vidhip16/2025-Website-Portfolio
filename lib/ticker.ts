// One loop for everything: Lenis, gaze, mosaic rate and dots all run on
// gsap.ticker. Components register with `addTick` and get an unsubscribe fn.
//
// This module imports gsap, so only import it from lazily loaded code
// (dynamic import after load/idle). First-load components import the
// scheduling helpers from lib/idle instead.
import { gsap } from "gsap";

export { onIdle, afterLoad, afterLoadIdle } from "./idle";

/** gsap.ticker callback: time (s), deltaTime (ms), frame index. */
export type TickFn = (time: number, deltaTime: number, frame: number) => void;

export function addTick(fn: TickFn): () => void {
  gsap.ticker.add(fn);
  return () => gsap.ticker.remove(fn);
}
