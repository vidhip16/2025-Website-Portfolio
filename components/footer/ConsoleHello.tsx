"use client";

import { useEffect } from "react";
import { afterLoadIdle } from "@/lib/idle";

/** Tiny ASCII portraits, keyed by `mascot.noun` so a CP1 re-pick is copy-only. */
const ART: Record<string, string> = {
  bunny: [" (\\(\\", " ( o.o)", ' o_(")(")'].join("\n"),
};

const KEY = "vp:hello";
let greeted = false;

/**
 * Once per session, after load + idle: an ASCII mascot and `mascot.consoleLine`
 * in the devtools console. Mount once, in the root layout.
 */
export function ConsoleHello({ line, noun }: { line: string; noun: string }) {
  useEffect(() => {
    return afterLoadIdle(() => {
      if (greeted) return;
      greeted = true;
      try {
        if (window.sessionStorage.getItem(KEY)) return;
        window.sessionStorage.setItem(KEY, "1");
      } catch {
        /* storage blocked: the module flag still keeps it to once per load */
      }
      const art = ART[noun];
      const lilac = "color:#B7A3F0;font-weight:700;line-height:1.15";
      const bold = "font-weight:700";
      if (art) console.log(`%c${art}\n%c${line}`, lilac, bold);
      else console.log(`%c${line}`, bold);
    });
  }, [line, noun]);

  return null;
}
