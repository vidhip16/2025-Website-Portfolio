// Tiny scheduling helpers with no dependencies, safe to import from
// first-load client components. (lib/ticker re-exports these.)

/** requestIdleCallback with a Safari fallback (Safari has no rIC). */
export const onIdle = (cb: () => void): void => {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(cb, { timeout: 2000 });
  } else {
    setTimeout(cb, 200);
  }
};

/** Run `cb` once the window `load` event has fired (immediately if it already has). */
export function afterLoad(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (document.readyState === "complete") {
    cb();
    return () => {};
  }
  window.addEventListener("load", cb, { once: true });
  return () => window.removeEventListener("load", cb);
}

/** After `load`, then idle: the standard gate for non-critical work. */
export function afterLoadIdle(cb: () => void): () => void {
  let cancelled = false;
  const off = afterLoad(() => onIdle(() => !cancelled && cb()));
  return () => {
    cancelled = true;
    off();
  };
}
