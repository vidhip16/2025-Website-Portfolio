"use client";

import { useEffect } from "react";

/**
 * Frame-time probe for the QA build (blueprint §12 gate 7). Renders nothing.
 *
 * Only when the build was made with NEXT_PUBLIC_QA=1 does it import ./recordFrames, which records
 * rAF intervals (and long tasks where supported) into `window.__perf = {frames, reset()}`
 * (types in lib/gaze.ts). In any other build the import never runs, so the recorder's chunk is
 * never fetched and nothing is measured. Mount it once in the root layout.
 *
 * Effects re-run when an Activity boundary is shown again, so start/stop is fully symmetric.
 */
export function PerfProbe() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_QA !== "1") return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    import("./recordFrames").then((m) => {
      if (!cancelled) stop = m.startPerfProbe();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return null;
}
