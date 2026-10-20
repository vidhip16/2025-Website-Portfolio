"use client";

import { Pause, Play } from "lucide-react";
import { setPaused, useMotionPrefs } from "@/lib/motion";

/**
 * Pause motion toggle: the WCAG 2.2.2 pause control for every ambient motion
 * on the site (mosaic drift, dots, smooth scroll). lib/motion persists the
 * choice in localStorage and sets html[data-motion]; MotionPrefs announces it.
 *
 * The name stays "Pause motion" in both states and aria-pressed carries the
 * state (a name that flips together with aria-pressed reads backwards: "Play
 * motion, pressed"). The pressed state also fills the pill, as ViewToggle does,
 * using the room's own --fg/--bg so it reads on paper and on night. Only the
 * aria-hidden icon swaps.
 *
 * Rendered in the nav and again beside the work index, so it takes a
 * className for placement only. Selector contract:
 * button[data-motion-toggle][aria-pressed].
 */
export function MotionToggle({ className = "" }: { className?: string }) {
  const { paused, reduced } = useMotionPrefs();
  const Icon = paused ? Play : Pause;
  return (
    <button
      type="button"
      data-motion-toggle
      aria-pressed={paused}
      onClick={() => setPaused(!paused)}
      title={reduced && !paused ? "Your system asks for reduced motion, so ambient motion is already off" : undefined}
      className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-[0.95rem] font-semibold leading-none decoration-2 underline-offset-[0.3em] hover:underline aria-pressed:bg-[color:var(--fg)] aria-pressed:text-[color:var(--bg)] ${className}`}
    >
      <Icon aria-hidden size={18} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      {/* Below 360px only the icon shows; the name stays for assistive tech. */}
      <span className="max-xs:sr-only">Pause motion</span>
    </button>
  );
}
