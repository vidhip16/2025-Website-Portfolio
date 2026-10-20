"use client";

import { useEffect } from "react";
import { afterLoadIdle } from "@/lib/idle";
import { useMotionPrefs } from "@/lib/motion";

/**
 * Starts Lenis on the shared ticker when ambient motion is allowed.
 * GSAP + Lenis load lazily (after load + idle) to keep first-load JS small.
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
