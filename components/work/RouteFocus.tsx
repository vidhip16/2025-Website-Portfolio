"use client";

import { useEffect, useRef } from "react";

// The first mount after a hard load is the initial page, where focus must stay
// at the top of the document (the skip link is the first Tab stop).
let initialLoadSeen = false;

/**
 * After a client navigation, focus can be left on an element of the previous
 * route, which Cache Components keeps mounted but hidden (<Activity>). Screen
 * readers then announce nothing and Safari can't Tab out of the hidden subtree.
 * On later mounts (client navigations, Activity re-shows), move focus to this
 * route's own <main> when the focused element is gone or invisible.
 * Render it inside <main>; #main exists on every kept-alive route, so the
 * element is found through the DOM tree, not by id.
 */
export function RouteFocus() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!initialLoadSeen) {
      initialLoadSeen = true;
      return;
    }
    const el = document.activeElement as HTMLElement | null;
    const lost = !el || el === document.body || !el.isConnected || el.getClientRects().length === 0;
    if (lost) ref.current?.closest("main")?.focus({ preventScroll: true });
  }, []);
  return <span ref={ref} hidden />;
}
