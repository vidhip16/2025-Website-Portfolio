"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { nav, person } from "@/content/site";
import { MotionToggle } from "./MotionToggle";

/** Fixed slim bar: monogram, anchor links, Pause motion. */
export function Nav() {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const els = nav
      .map((n) => document.getElementById(n.id))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[var(--nav-h)] bg-paper/85 backdrop-blur-sm">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-full items-center justify-between gap-4 px-[var(--gutter)]"
      >
        <Link href="/#home" className="font-display text-2xl font-extrabold text-ink no-underline" aria-label={`${person.name}, home`}>
          vp
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <li key={n.id}>
              <Link
                href={`/${n.href}`}
                aria-current={current === n.id ? "location" : undefined}
                className="inline-flex min-h-11 items-center rounded-full px-3 font-semibold text-ink no-underline aria-[current]:underline aria-[current]:decoration-2"
              >
                {n.label}
              </Link>
            </li>
          ))}
          <li>
            <MotionToggle className="text-ink" />
          </li>
        </ul>
        <div className="md:hidden">
          <MotionToggle className="text-ink" />
        </div>
      </nav>
    </header>
  );
}
