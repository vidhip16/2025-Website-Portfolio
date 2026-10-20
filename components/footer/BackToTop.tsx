"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { ArrowUp } from "lucide-react";
import { useMotionPrefs } from "@/lib/motion";

/** How long the mascot shows her awake still before the page scrolls up. */
const WAKE_MS = 400;

/**
 * Back to top (blueprint §3.6). If the footer has an awake still, the mascot
 * wakes for 400 ms (footer[data-awake] swaps the stills), then the page scrolls
 * to the top through lib/scroll, loaded on demand. Reduced motion or Pause:
 * no wake, and an instant jump. Focus moves to #main so keyboard users start
 * from the top too.
 */
export function BackToTop({ label }: { label: string }) {
  const { ok } = useMotionPrefs();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function onClick(e: MouseEvent<HTMLButtonElement>) {
    const footer = e.currentTarget.closest("footer");
    window.clearTimeout(timer.current);

    const go = () => {
      if (footer) delete footer.dataset.awake;
      document.getElementById("main")?.focus({ preventScroll: true });
      if (!ok) {
        window.scrollTo({ top: 0, behavior: "instant" });
        return;
      }
      import("@/lib/scroll")
        .then((m) => m.scrollToTarget(0))
        .catch(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    };

    if (ok && footer?.querySelector("[data-still-awake]")) {
      footer.dataset.awake = "";
      timer.current = window.setTimeout(go, WAKE_MS);
    } else {
      go();
    }
  }

  return (
    <button
      type="button"
      data-back-to-top=""
      onClick={onClick}
      className={[
        "inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-paper px-5",
        "font-semibold text-paper transition-colors duration-200 ease-quint",
        "hover:bg-paper hover:text-ink forced-colors:border-[color:ButtonText]",
      ].join(" ")}
    >
      <ArrowUp aria-hidden size={18} strokeWidth={1.75} strokeLinecap="round" />
      <span>{label}</span>
    </button>
  );
}
