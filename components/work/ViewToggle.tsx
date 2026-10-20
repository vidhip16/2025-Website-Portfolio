"use client";

import { List } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import styles from "./work.module.css";

type View = "mosaic" | "list";

const KEY = "vp:work-view";
/** Reduced motion and very narrow screens default to the list (§6.5). */
const LIST_DEFAULT_MQ = "(prefers-reduced-motion: reduce), (max-width: 359.98px)";

const listeners = new Set<() => void>();
/** The choice, when localStorage is blocked (lasts for this page only). */
let memory: View | null = null;

function stored(): View | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "list" || v === "mosaic" ? v : null;
  } catch {
    return null;
  }
}

function getView(): View {
  return stored() ?? (window.matchMedia(LIST_DEFAULT_MQ).matches ? "list" : "mosaic");
}

function setView(view: View) {
  try {
    window.localStorage.setItem(KEY, view);
  } catch {
    memory = view;
  }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const mq = window.matchMedia(LIST_DEFAULT_MQ);
  const onStorage = (e: StorageEvent) => e.key === KEY && fn();
  mq.addEventListener("change", fn);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    mq.removeEventListener("change", fn);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => memory ?? getView();
const getServerSnapshot = (): View => "mosaic";

/**
 * "View as list" toggle: button[data-view-toggle][aria-pressed]. The label
 * stays the same; aria-pressed carries the state. The choice is remembered in
 * localStorage and applied through html[data-work-view], which the Work CSS
 * reads (so it can also be set before paint).
 */
export function ViewToggle({ label }: { label: string }) {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.dataset.workView = view;
  }, [view]);

  return (
    <button
      type="button"
      data-view-toggle
      aria-pressed={view === "list"}
      onClick={() => setView(view === "list" ? "mosaic" : "list")}
      className={`${styles.viewToggle} inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink px-4 text-[0.95rem] font-semibold text-ink transition-colors aria-pressed:bg-ink aria-pressed:text-paper`}
    >
      <List aria-hidden size={18} strokeWidth={1.75} strokeLinecap="round" />
      <span>{label}</span>
    </button>
  );
}
