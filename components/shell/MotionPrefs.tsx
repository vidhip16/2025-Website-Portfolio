"use client";

import { useEffect, useState } from "react";
import { getMotionPrefs, subscribeMotion } from "@/lib/motion";

/**
 * Starts the lib/motion store on load (OS reduced-motion listener, the stored
 * Pause choice, html[data-motion]) and tells assistive tech when ambient
 * motion turns off or on.
 *
 * It announces changes only, never the state found at load, so a returning
 * visitor who paused last time hears nothing on arrival. It tracks `ok`, not
 * just `paused`, so "Motion on." is only said when motion really resumes (not
 * when Play is pressed while the OS still asks for reduced motion).
 *
 * The live region is in the DOM from the first render, so screen readers
 * register it before the first message arrives. Mount once, in the layout.
 * It deliberately has no role="status": the contact form's status owns the
 * `[role="status"][aria-live="polite"]` selector in the QA contract.
 */
export function MotionPrefs() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let last = getMotionPrefs().ok;
    return subscribeMotion(() => {
      const { ok } = getMotionPrefs();
      if (ok === last) return;
      last = ok;
      setMessage(ok ? "Motion on." : "Motion paused.");
    });
  }, []);

  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only-soft" data-motion-status>
      {message}
    </p>
  );
}
