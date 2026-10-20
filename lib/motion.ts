// Motion preferences: the OS reduced-motion setting plus the site's own
// Pause motion toggle (persisted in localStorage). Both mean "no ambient
// motion"; user-driven gaze still follows the pointer, snapping.
//
// Read with `useMotionPrefs()` in client components, or subscribe() outside React.
import { useSyncExternalStore } from "react";

export type MotionPrefs = {
  /** prefers-reduced-motion: reduce */
  reduced: boolean;
  /** The Pause motion toggle */
  paused: boolean;
  /** true when ambient motion may run (neither reduced nor paused) */
  ok: boolean;
};

const KEY = "vp:motion-paused";
const SERVER: MotionPrefs = { reduced: false, paused: false, ok: true };

let state: MotionPrefs = SERVER;
const listeners = new Set<() => void>();
let started = false;

function readPaused(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function compute(reduced: boolean, paused: boolean): MotionPrefs {
  return { reduced, paused, ok: !reduced && !paused };
}

function emit(next: MotionPrefs) {
  if (next.reduced === state.reduced && next.paused === state.paused) return;
  state = next;
  document.documentElement.dataset.motion = next.ok ? "on" : "off";
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  state = compute(mq.matches, readPaused());
  document.documentElement.dataset.motion = state.ok ? "on" : "off";
  mq.addEventListener("change", (e) => emit(compute(e.matches, state.paused)));
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) emit(compute(state.reduced, readPaused()));
  });
}

export function getMotionPrefs(): MotionPrefs {
  start();
  return state;
}

export function subscribeMotion(fn: () => void): () => void {
  start();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setPaused(paused: boolean): void {
  start();
  try {
    if (paused) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: keep the in-memory value */
  }
  emit(compute(state.reduced, paused));
}

export function useMotionPrefs(): MotionPrefs {
  return useSyncExternalStore(subscribeMotion, getMotionPrefs, () => SERVER);
}

/** Shared easings (match the CSS tokens). */
export const EASE = {
  expo: "expo.out",
  quint: "power4.out",
  cssExpo: "cubic-bezier(.16,1,.3,1)",
  cssQuint: "cubic-bezier(.22,1,.36,1)",
} as const;

/** Desktop breakpoint where the hero pins. */
export const DESKTOP_MQ = "(min-width: 1024px)";
export const FINE_POINTER_MQ = "(hover: hover) and (pointer: fine)";
