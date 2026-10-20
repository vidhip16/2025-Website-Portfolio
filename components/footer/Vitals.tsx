"use client";

import { useSyncExternalStore } from "react";
import { afterLoadIdle } from "@/lib/idle";

// One module-level subscription to web-vitals for the page's lifetime. Its
// callbacks can't be removed, so components only subscribe to this store;
// re-mounting (Activity show, Strict Mode) never registers observers twice.
type Snapshot = { ready: number | null; inp: number | null };

const SERVER: Snapshot = { ready: null, inp: null };
let snap: Snapshot = SERVER;
let started = false;
const listeners = new Set<() => void>();

function set(next: Partial<Snapshot>) {
  snap = { ...snap, ...next };
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  afterLoadIdle(() => {
    import("web-vitals")
      .then(({ onLCP, onFCP, onINP }) => {
        const opts = { reportAllChanges: true };
        const hasLCP =
          typeof PerformanceObserver !== "undefined" &&
          PerformanceObserver.supportedEntryTypes?.includes("largest-contentful-paint");
        const ready = (m: { value: number }) => set({ ready: m.value });
        // Browsers without LCP (older Safari) fall back to first contentful paint.
        if (hasLCP) onLCP(ready, opts);
        else onFCP(ready, opts);
        onINP((m) => set({ inp: m.value }), opts);
      })
      .catch(() => {
        /* no line; the footer reads fine without it */
      });
  });
}

function subscribe(fn: () => void) {
  start();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const seconds = (ms: number) => Math.max(0.1, ms / 1000).toFixed(1);

/**
 * "This visit: page ready in 1.2 s." from web-vitals, loaded after load + idle.
 * `inpPrefix` (optional copy) appends the slowest interaction once there is one.
 */
export function Vitals({
  prefix,
  inpPrefix,
  className = "",
}: {
  prefix: string;
  inpPrefix?: string;
  className?: string;
}) {
  const { ready, inp } = useSyncExternalStore(subscribe, () => snap, () => SERVER);
  let text = "";
  if (ready !== null) {
    text = `${prefix} ${seconds(ready)} s`;
    if (inpPrefix && inp !== null) text += `, ${inpPrefix} ${Math.round(inp)} ms`;
    text += ".";
  }
  return (
    <p data-vitals="" className={`min-h-[1lh] ${className}`}>
      {text}
    </p>
  );
}
