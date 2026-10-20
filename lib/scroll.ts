// Lenis singleton, driven by gsap.ticker (one loop for everything).
// SmoothScroll (components/shell) calls `startScroll()` once on mount.
// When ambient motion is off (reduced motion / Pause), Lenis is not created
// and scrolling is native; `getScrollVelocity()` still works from native
// scroll deltas so the gaze and mosaic can react to the wheel.
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let lenis: Lenis | null = null;
let tick: ((time: number) => void) | null = null;
let nativeVel = 0;
let lastY = 0;
let lastT = 0;
let nativeBound = false;

function onNativeScroll() {
  const now = performance.now();
  const y = window.scrollY;
  const dt = Math.max(1, now - lastT);
  // Lenis reports px per frame-ish; normalise native to px per 16.7 ms.
  nativeVel = ((y - lastY) / dt) * 16.7;
  lastY = y;
  lastT = now;
}

function bindNative() {
  if (nativeBound || typeof window === "undefined") return;
  nativeBound = true;
  lastY = window.scrollY;
  lastT = performance.now();
  window.addEventListener("scroll", onNativeScroll, { passive: true });
  // Decay the native velocity when scrolling stops.
  gsap.ticker.add(() => {
    if (performance.now() - lastT > 80) nativeVel *= 0.8;
    if (Math.abs(nativeVel) < 0.01) nativeVel = 0;
  });
}

export function startScroll(opts: { smooth: boolean }): void {
  if (typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  // QA builds expose the ScrollTrigger class so specs can count live triggers.
  if (process.env.NEXT_PUBLIC_QA === "1") (window as unknown as { __st?: unknown }).__st = ScrollTrigger;
  bindNative();
  if (!opts.smooth) {
    stopScroll();
    return;
  }
  if (lenis) return;
  lenis = new Lenis({ autoRaf: false, anchors: true });
  lenis.on("scroll", ScrollTrigger.update);
  tick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
}

export function stopScroll(): void {
  if (tick) gsap.ticker.remove(tick);
  tick = null;
  lenis?.destroy();
  lenis = null;
}

export function getLenis(): Lenis | null {
  return lenis;
}

/**
 * Signed scroll velocity, roughly px per frame (+ = scrolling down).
 * Uses lenis.velocity when Lenis runs, else a native-scroll estimate.
 * Never read lenis.direction: it stays -1 after scrolling up stops.
 */
export function getScrollVelocity(): number {
  if (lenis) return lenis.velocity;
  return nativeVel;
}

export function scrollToTarget(target: string | number | HTMLElement, immediate = false): void {
  if (lenis) {
    lenis.scrollTo(target, { immediate });
    return;
  }
  if (typeof target === "number") {
    window.scrollTo({ top: target, behavior: immediate ? "instant" : "smooth" });
  } else {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el?.scrollIntoView({ behavior: immediate ? "instant" : "smooth", block: "start" });
  }
}
