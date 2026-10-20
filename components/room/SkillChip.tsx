"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { getMotionPrefs } from "@/lib/motion";
import { stage, type LookTarget } from "@/lib/stage";
import { releaseBubble, setBubble } from "./roomStage";
import s from "./room.module.css";

type Props = {
  name: string;
  /** Bubble text beside the shape ("used in Type Racer"), already verified by the server. */
  bubble?: string;
  /** A verified project: the chip links to its detail page and, with JS, scrolls to its mosaic tile. */
  slug?: string;
  /** An external proof link, used when there is no project tile. */
  href?: string;
  /** Server-rendered trailing icon. */
  children?: ReactNode;
};

/** How long a tapped (touch) chip keeps the dots looking at it. */
const TOUCH_HOLD_MS = 2200;

const isPlainClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;

/**
 * One skill chip (blueprint §3.2 "Skills the dots show off"). Hover or focus points the dot pupils
 * at the chip (stage.look = its centre, followed while the page scrolls) and shows the bubble beside
 * the shape (stage.bubble); leaving clears both, unless something else has taken them over since.
 * The bubble is decorative: the same words are in the chip's accessible name.
 *
 * Project chips are links to /work/<slug> (so they work without JS and in a new tab); a plain click
 * scrolls to that project's canonical mosaic tile instead and focuses it. Link chips open their
 * href. Chips with neither are not interactive, only hoverable. All listeners live in one effect,
 * so a hidden route (Activity) releases the look and the bubble.
 */
export function SkillChip({ name, bubble, slug, href, children }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let hovered = false;
    let focused = false;
    let on = false;
    let mine: LookTarget = null;
    let raf = 0;
    let touchTimer = 0;

    const centre = (): LookTarget => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const aim = () => {
      mine = centre();
      stage.set({ look: mine });
    };
    const onScroll = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (on && stage.get().look === mine) aim();
        });
    };
    const show = () => {
      on = true;
      aim();
      if (bubble) setBubble(bubble);
      el.setAttribute("data-lit", "");
      window.addEventListener("scroll", onScroll, { passive: true });
    };
    const hide = () => {
      on = false;
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (mine && stage.get().look === mine) stage.set({ look: null });
      mine = null;
      if (bubble) releaseBubble(bubble);
      el.removeAttribute("data-lit");
    };
    const apply = () => {
      const want = hovered || focused;
      if (want && !on) show();
      else if (!want && on) hide();
    };

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      hovered = true;
      apply();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      hovered = false;
      apply();
    };
    // Touch has no hover: a tap lights the chip for a moment.
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      hovered = true;
      apply();
      window.clearTimeout(touchTimer);
      touchTimer = window.setTimeout(() => {
        hovered = false;
        apply();
      }, TOUCH_HOLD_MS);
    };
    const onFocus = () => {
      focused = true;
      apply();
    };
    const onBlur = () => {
      focused = false;
      apply();
    };
    const onClick = (e: MouseEvent) => {
      if (!slug || !isPlainClick(e)) return;
      e.preventDefault();
      const smooth = getMotionPrefs().ok;
      const detail = () => router.push(`/work/${slug}`);
      import("./goToProject")
        .then((m) => m.goToProject(slug, smooth))
        .then((found) => found || detail())
        .catch(detail);
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("focus", onFocus);
    el.addEventListener("blur", onBlur);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("focus", onFocus);
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("click", onClick);
      window.clearTimeout(touchTimer);
      if (on) hide();
    };
  }, [bubble, slug, router]);

  const bind = (node: HTMLElement | null) => {
    ref.current = node;
  };
  const label = (
    <>
      {name}
      {bubble && <span className="sr-only-soft">, {bubble}</span>}
    </>
  );

  if (slug) {
    return (
      <a ref={bind} href={`/work/${slug}`} className={s.chip} data-chip="project" data-slug={slug}>
        {label}
        {children}
      </a>
    );
  }
  if (href) {
    return (
      <a ref={bind} href={href} rel="noopener noreferrer" className={s.chip} data-chip="link">
        {label}
        {children}
      </a>
    );
  }
  return (
    <span ref={bind} className={s.chip} data-chip="plain">
      {label}
    </span>
  );
}
