"use client";

import { useEffect } from "react";
import { afterLoadIdle } from "@/lib/idle";
import { useMotionPrefs } from "@/lib/motion";

/**
 * Lazy motion controller for the branch lanes. Renders nothing. After load +
 * idle, and only while ambient motion is allowed, it imports GSAP and scrubs
 * the lanes' draw-in across the section. Reduced motion or Pause: no import,
 * no ScrollTrigger, and the server-rendered lanes stay fully drawn.
 */
export function BranchesMotion() {
  const { ok } = useMotionPrefs();

  useEffect(() => {
    if (!ok) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const off = afterLoadIdle(() => {
      import("./drawLanes")
        .then(({ drawLanes }) => {
          if (cancelled) return;
          const svg = document.querySelector<SVGSVGElement>("svg[data-branches]");
          const section = svg?.closest("section");
          if (svg && section) cleanup = drawLanes(svg, section);
        })
        .catch(() => {
          /* chunk failed to load: the lanes are already drawn */
        });
    });
    return () => {
      cancelled = true;
      off();
      cleanup?.();
    };
  }, [ok]);

  return null;
}
