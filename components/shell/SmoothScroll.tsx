"use client";

import { useEffect } from "react";
import { afterLoadIdle } from "@/lib/idle";
import { useMotionPrefs } from "@/lib/motion";

/**
 * Starts Lenis on the shared ticker when ambient motion is allowed, and
 * native scrolling (still with velocity tracking) when it isn't.
 *
 * lib/scroll pulls in GSAP + Lenis, so it is only ever reached through
 * `import()` after load + idle. Never import it statically from here: that
 * would put both libraries in first-load JS (budget 170 KB gz).
 *
 * Re-runs when the motion prefs flip (Pause motion, OS setting): the cleanup
 * stops Lenis, and the next run starts it again or stays native.
 */
export function SmoothScroll() {
  const { ok } = useMotionPrefs();
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    const off = afterLoadIdle(() => {
      import("@/lib/scroll").then((m) => {
        if (cancelled) return;
        m.startScroll({ smooth: ok });
        stop = m.stopScroll;
      });
    });
    return () => {
      cancelled = true;
      off();
      stop?.();
    };
  }, [ok]);
  return null;
}
