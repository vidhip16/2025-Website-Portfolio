// QA-only frame-time recorder behind window.__perf (blueprint §12 gate 7).
// Loaded by PerfProbe.tsx through import() only in NEXT_PUBLIC_QA=1 builds, so it never ships
// in the first-load bundle of a normal build.
import type { PerfProbe } from "@/lib/gaze";

/**
 * window.__perf as recorded here: the lib/gaze.ts `PerfProbe` contract plus long-task durations
 * (ms, PerformanceObserver "longtask", Chromium only; empty elsewhere).
 */
export type RecordedPerfProbe = PerfProbe & { longTasks: number[] };

/** About ten minutes at 60 fps; older intervals are dropped past this. */
const MAX_FRAMES = 36_000;

/** Start recording rAF intervals (ms) into window.__perf. Returns a full cleanup. */
export function startPerfProbe(): () => void {
  const frames: number[] = [];
  const longTasks: number[] = [];
  let last = 0;
  let raf = 0;

  const loop = (t: number) => {
    if (last > 0) {
      frames.push(Math.round((t - last) * 100) / 100);
      if (frames.length > MAX_FRAMES + 1000) frames.splice(0, frames.length - MAX_FRAMES);
    }
    last = t;
    raf = requestAnimationFrame(loop);
  };

  // A hidden tab stops rAF; don't count the gap as one huge frame.
  const onVisibility = () => {
    last = 0;
  };

  const probe: RecordedPerfProbe = {
    frames,
    longTasks,
    reset() {
      frames.length = 0;
      longTasks.length = 0;
      last = 0;
    },
  };

  let observer: PerformanceObserver | undefined;
  if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push(Math.round(entry.duration));
    });
    try {
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      observer = undefined;
    }
  }

  document.addEventListener("visibilitychange", onVisibility);
  raf = requestAnimationFrame(loop);
  window.__perf = probe;

  return () => {
    cancelAnimationFrame(raf);
    observer?.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    if (window.__perf === probe) delete window.__perf;
  };
}
