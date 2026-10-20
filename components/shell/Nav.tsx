"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { nav, person } from "@/content/site";
import { Monogram } from "./Monogram";
import { MotionToggle } from "./MotionToggle";

const MENU_ID = "nav-menu";
const DESKTOP_MQ = "(min-width: 768px)";

/** Native popover support (Baseline 2024). Older engines get a small fallback. */
const supportsPopover = () =>
  typeof HTMLElement !== "undefined" && Object.prototype.hasOwnProperty.call(HTMLElement.prototype, "popover");

/**
 * Fixed slim bar: monogram, anchor links, Pause motion.
 *
 * One list serves both layouts. From 768px it sits inline in the bar. Below
 * that, the same element is a native `popover="auto"` sheet under the bar,
 * opened by the Menu button (`popovertarget`), so Escape and light dismiss come
 * from the browser. Colours read `--bg`/`--fg` from body, which the hero and
 * projection-room scrubs tween, so the bar stays legible on night.
 */
export function Nav() {
  const [current, setCurrent] = useState<string | null>(null);
  // `open` mirrors the native popover state; `fallbackOpen` drives the
  // no-popover fallback only. aria-expanded reads either.
  const [open, setOpen] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const expanded = open || fallbackOpen;

  const closeMenu = useCallback(() => {
    const el = menuRef.current;
    try {
      if (el?.matches(":popover-open")) el.hidePopover();
    } catch {
      /* :popover-open unsupported: fallback state below handles it */
    }
    setFallbackOpen(false);
  }, []);

  // Keep aria-expanded in sync with the native popover, however it closed
  // (button, Escape, light dismiss, link click).
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const onToggle = (e: Event) => setOpen((e as ToggleEvent).newState === "open");
    el.addEventListener("toggle", onToggle);
    return () => el.removeEventListener("toggle", onToggle);
  }, []);

  // Crossing to the desktop layout closes the sheet (the list goes inline).
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) closeMenu();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [closeMenu]);

  // Fallback only: Escape closes and returns focus to the button.
  useEffect(() => {
    if (!fallbackOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setFallbackOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fallbackOpen]);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 h-[var(--nav-h)] bg-[color:color-mix(in_srgb,var(--bg)_86%,transparent)] text-[color:var(--fg)] backdrop-blur-[6px] print:hidden"
    >
      <Suspense fallback={null}>
        <SectionSpy onChange={setCurrent} />
      </Suspense>
      <nav aria-label="Primary" className="flex h-full items-center gap-1 px-[var(--gutter)]">
        <Link
          href="/#home"
          aria-label={`${person.name}, home`}
          className="mr-auto inline-flex min-h-11 min-w-11 items-center text-inherit no-underline"
        >
          <Monogram className="text-[1.75rem]" />
        </Link>

        <div
          ref={menuRef}
          id={MENU_ID}
          popover="auto"
          data-open={fallbackOpen || undefined}
          className={[
            // display: hidden on mobile until opened; inline from md
            "hidden open:block data-open:block md:block",
            // mobile: a sheet under the bar (overrides the UA popover box)
            "max-md:fixed max-md:inset-x-0 max-md:top-[var(--nav-h)] max-md:bottom-auto max-md:m-0 max-md:h-auto",
            "max-md:max-h-[calc(100dvh-var(--nav-h))] max-md:w-full max-md:max-w-none max-md:overflow-y-auto max-md:overscroll-contain",
            "max-md:border-0 max-md:border-b-2 max-md:border-[color:var(--fg)] max-md:bg-[color:var(--bg)] max-md:text-[color:var(--fg)]",
            "max-md:px-[var(--gutter)] max-md:pt-2 max-md:pb-6",
            "max-md:transition-[opacity,translate] max-md:duration-200 max-md:ease-quint",
            "max-md:starting:open:-translate-y-1 max-md:starting:open:opacity-0",
            // desktop: plain inline list (neutralise the UA popover box)
            "md:static md:m-0 md:size-auto md:overflow-visible md:border-0 md:bg-transparent md:p-0 md:text-inherit",
          ].join(" ")}
        >
          <ul className="flex flex-col md:flex-row md:items-center md:gap-1">
            {nav.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/#${n.id}`}
                  aria-current={current === n.id ? "location" : undefined}
                  onClick={closeMenu}
                  className={[
                    "inline-flex min-h-11 items-center text-inherit no-underline decoration-2 underline-offset-[0.3em]",
                    "hover:underline aria-[current=location]:underline",
                    "max-md:min-h-14 max-md:w-full max-md:font-display max-md:text-[2rem] max-md:font-bold max-md:leading-none",
                    "md:rounded-full md:px-3 md:text-base md:font-semibold",
                  ].join(" ")}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <MotionToggle />

        <button
          ref={buttonRef}
          type="button"
          popoverTarget={MENU_ID}
          aria-controls={MENU_ID}
          aria-expanded={expanded}
          onClick={() => {
            if (!supportsPopover()) setFallbackOpen((o) => !o);
          }}
          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-[0.95rem] font-semibold leading-none decoration-2 underline-offset-[0.3em] hover:underline md:hidden"
        >
          {expanded ? (
            <X aria-hidden size={18} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <Menu aria-hidden size={18} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
          )}
          <span>Menu</span>
        </button>
      </nav>
    </header>
  );
}

/**
 * Sets aria-current="location" on the link whose section crosses a thin band
 * just above the middle of the viewport (none while the hero is there).
 *
 * Re-runs on route change, because the nav lives in the layout and the home
 * sections are absent on /work/[slug]. It reads usePathname, which can suspend
 * during prerender under Cache Components, so it sits in its own Suspense
 * boundary and renders nothing.
 */
function SectionSpy({ onChange }: { onChange: (id: string | null) => void }) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = nav
      .map((n) => document.getElementById(n.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!els.length) return;

    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        onChange(nav.find((n) => visible.has(n.id))?.id ?? null);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      onChange(null);
    };
  }, [pathname, onChange]);

  return null;
}
