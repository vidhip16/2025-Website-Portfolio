"use client";

import { useEffect } from "react";

/**
 * Closed-eyes favicon (blueprint §1.5, Phase 6 head kit). Fetched only when the
 * tab is first hidden. Set to null to swap the title alone.
 */
export const SLEEP_ICON: string | null = "/icon-sleep.svg";

type Saved = {
  title: string;
  icons: { el: HTMLLinkElement; href: string | null; type: string | null }[];
  added: HTMLLinkElement | null;
};

/**
 * Hidden-tab easter egg: while the tab is hidden the title becomes
 * `mascot.sleepTitle` and, when SLEEP_ICON is set, the favicon her sleeping
 * icon; both are restored when the tab is visible again. Mount once, in the
 * root layout.
 */
export function TabSleep({ title }: { title: string }) {
  useEffect(() => {
    let saved: Saved | null = null;

    const sleep = () => {
      if (saved) return;
      const next: Saved = { title: document.title, icons: [], added: null };
      document.title = title;
      const icon = SLEEP_ICON;
      if (icon) {
        const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
        for (const el of links) {
          next.icons.push({ el, href: el.getAttribute("href"), type: el.getAttribute("type") });
          el.setAttribute("href", icon);
          el.setAttribute("type", "image/svg+xml");
        }
        if (!links.length) {
          const el = document.createElement("link");
          el.rel = "icon";
          el.type = "image/svg+xml";
          el.href = icon;
          document.head.appendChild(el);
          next.added = el;
        }
      }
      saved = next;
    };

    const wake = () => {
      if (!saved) return;
      // Only undo our own title; if something else retitled the page meanwhile, keep it.
      if (document.title === title) document.title = saved.title;
      for (const { el, href, type } of saved.icons) {
        if (href === null) el.removeAttribute("href");
        else el.setAttribute("href", href);
        if (type === null) el.removeAttribute("type");
        else el.setAttribute("type", type);
      }
      saved.added?.remove();
      saved = null;
    };

    const onVisibility = () => (document.visibilityState === "hidden" ? sleep() : wake());
    document.addEventListener("visibilitychange", onVisibility);
    // Opened in a background tab: she is already asleep.
    if (document.visibilityState === "hidden") sleep();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      wake();
    };
  }, [title]);

  return null;
}
