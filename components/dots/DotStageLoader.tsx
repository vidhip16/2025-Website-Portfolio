"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { PointTier } from "@/lib/dots/types";
import { afterLoadIdle } from "@/lib/idle";
import { DESKTOP_MQ, FINE_POINTER_MQ, useMotionPrefs } from "@/lib/motion";
import type { TierReason } from "@/lib/quality";

// The dot stage's first-load island (blueprint §5.5 "Loading"). It renders nothing until the
// page has loaded and gone idle, or until #about is one viewport away, whichever comes first.
// Then it picks a tier and mounts one of two lazy chunks:
//   DotStage    WebGL (three.js), T2 12k points on desktop, T1 4k on phones / coarse pointers
//   StaticDots  T0 halftones: no WebGL2, Save-Data, a lost context, the governor's last drop,
//               and (while it lasts) reduced motion or Pause
// Neither chunk is in first-load JS.

const DotStage = dynamic(() => import("./DotStage"), { ssr: false });
const StaticDots = dynamic(() => import("./StaticDots"), { ssr: false });

/** Permanent T0 for the rest of the page's life (survives Activity re-mounts); motion prefs aren't. */
let lostFor: TierReason | null = null;

function staticReason(): TierReason | null {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return "save-data";
  if (typeof WebGL2RenderingContext === "undefined") return "no-webgl2";
  return null;
}

function startTier(): PointTier {
  return window.matchMedia(DESKTOP_MQ).matches && window.matchMedia(FINE_POINTER_MQ).matches ? "T2" : "T1";
}

export function DotStageLoader() {
  const { ok } = useMotionPrefs();
  const [start, setStart] = useState<{ tier: PointTier; lost: TierReason | null } | null>(null);

  useEffect(() => {
    let done = false;
    let io: IntersectionObserver | null = null;
    let off = () => {};
    const go = () => {
      if (done) return;
      done = true;
      off();
      io?.disconnect();
      lostFor ??= staticReason();
      setStart({ tier: startTier(), lost: lostFor });
    };
    off = afterLoadIdle(go);
    const about = document.getElementById("about");
    if (about && typeof IntersectionObserver === "function") {
      // At the latest one viewport before the room.
      io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && go(), {
        rootMargin: "100% 0px 100% 0px",
      });
      io.observe(about);
    }
    return () => {
      done = true;
      off();
      io?.disconnect();
    };
  }, []);

  const onFallback = useCallback((reason: TierReason) => {
    lostFor = reason;
    setStart((s) => (s ? { ...s, lost: reason } : s));
  }, []);

  if (!start) return null;
  const reason = start.lost ?? (ok ? null : "reduced-motion");
  return reason ? <StaticDots reason={reason} /> : <DotStage tier={start.tier} onFallback={onFallback} />;
}
