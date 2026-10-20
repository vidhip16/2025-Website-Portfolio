"use client";

import { Pause, Play } from "lucide-react";
import { setPaused, useMotionPrefs } from "@/lib/motion";

/** Pause motion toggle (WCAG 2.2.2). Persisted in localStorage via lib/motion. */
export function MotionToggle({ className = "" }: { className?: string }) {
  const { paused, reduced } = useMotionPrefs();
  const off = paused || reduced;
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[0.95rem] font-semibold ${className}`}
      aria-pressed={paused}
      onClick={() => setPaused(!paused)}
      title={reduced && !paused ? "Your system asks for reduced motion" : undefined}
    >
      {off ? (
        <Play aria-hidden size={18} strokeWidth={1.75} strokeLinecap="round" />
      ) : (
        <Pause aria-hidden size={18} strokeWidth={1.75} strokeLinecap="round" />
      )}
      <span>{paused ? "Play motion" : "Pause motion"}</span>
    </button>
  );
}
