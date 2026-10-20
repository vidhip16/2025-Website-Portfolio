"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";
import { afterLoadIdle } from "@/lib/idle";
import { revealDelta, shiftTrack, trackAnimation } from "./reveal";
import { rememberScroll, takeRestore } from "./scrollMemory";
import { MORPH_TYPE } from "./transition";

const TILE = "a[data-tile]";
const INDEX_LINK = "a[data-index-link]";

const closest = <T extends Element>(target: EventTarget | null, selector: string): T | null =>
  target instanceof Element ? target.closest<T>(selector) : null;

const isPlainClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;

/**
 * The Work section's small first-load island (renders nothing). It wires the
 * server-rendered index, mosaic and list with delegated listeners:
 * - tile click/Enter → remember scroll, router.push (canonical covers add the
 *   morph transition type; prints and clones navigate without it)
 * - index hover/focus → highlight that project's cover and hold the wall
 * - keyboard focus on a tile → hold its column and bring the tile into view
 * - "Back to the gallery" → restore the stored scroll position
 * The motion controller (GSAP, ticker, scroll velocity) loads lazily after
 * load + idle via import(), never in the first-load bundle.
 */
export function WorkClient({ slugs }: { slugs: readonly string[] }) {
  const router = useRouter();

  useLayoutEffect(() => {
    // The stored spot is relative to #work, so this is right with or without the hero pin
    // (heroScrollMotion adds the pin's length later if it isn't there yet).
    const y = takeRestore();
    if (y === null) return;
    window.scrollTo({ top: y, behavior: "instant" });
    // Lenis (when it runs) keeps its own scroll value and rewrites the native one on every tick
    // while it smooths, so a wheel tick just before the route changed would undo the restore.
    // Hand it the position too. Lazy, like every other lib/scroll consumer: first-load JS stays small.
    import("@/lib/scroll")
      .then((m) => m.scrollToTarget(y, true))
      .catch(() => {
        /* the native restore above already ran */
      });
  }, []);

  useEffect(() => {
    const section = document.getElementById("work");
    const mosaic = section?.querySelector<HTMLElement>("[data-mosaic]");
    const index = section?.querySelector<HTMLElement>("#work-index");
    if (!section || !mosaic || !index) return;

    const known = new Set(slugs);
    const prefetched = new Set<string>();

    // ── Index → mosaic highlight ───────────────────────────────────────
    let hoverSlug: string | null = null;
    let focusSlug: string | null = null;
    let shown: string | null = null;
    const applyIndex = () => {
      const slug = hoverSlug ?? focusSlug;
      if (slug === shown) return;
      shown = slug;
      mosaic.querySelectorAll(`${TILE}[data-active]`).forEach((el) => el.removeAttribute("data-active"));
      if (slug) {
        mosaic
          .querySelectorAll(`${TILE}[data-kind="cover"][data-slug="${CSS.escape(slug)}"]`)
          .forEach((el) => el.setAttribute("data-active", ""));
        mosaic.setAttribute("data-active-slug", slug);
        mosaic.setAttribute("data-hold", "index");
      } else {
        mosaic.removeAttribute("data-active-slug");
        mosaic.removeAttribute("data-hold");
      }
    };

    // ── Mosaic → index echo ────────────────────────────────────────────
    let echoed: string | null = null;
    const echo = (slug: string | null) => {
      if (slug === echoed) return;
      echoed = slug;
      index.querySelectorAll(`${INDEX_LINK}[data-active]`).forEach((el) => el.removeAttribute("data-active"));
      if (slug) index.querySelector(`${INDEX_LINK}[data-index-link="${CSS.escape(slug)}"]`)?.setAttribute("data-active", "");
    };

    const onIndexOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      hoverSlug = closest<HTMLAnchorElement>(e.target, INDEX_LINK)?.dataset.indexLink ?? null;
      applyIndex();
    };
    const onIndexLeave = () => {
      hoverSlug = null;
      applyIndex();
    };
    const onIndexFocusIn = (e: FocusEvent) => {
      focusSlug = closest<HTMLAnchorElement>(e.target, INDEX_LINK)?.dataset.indexLink ?? null;
      applyIndex();
    };
    const onIndexFocusOut = () => {
      focusSlug = null;
      applyIndex();
    };

    // ── Tiles ──────────────────────────────────────────────────────────
    const prefetch = (slug: string | undefined) => {
      if (!slug || !known.has(slug) || prefetched.has(slug)) return;
      prefetched.add(slug);
      router.prefetch(`/work/${slug}`);
    };

    const onMosaicOver = (e: PointerEvent) => {
      const tile = closest<HTMLAnchorElement>(e.target, TILE);
      if (tile) prefetch(tile.dataset.slug);
      if (e.pointerType !== "touch") echo(tile?.dataset.slug ?? null);
    };
    const onMosaicLeave = () => echo(null);

    const columnOf = (tile: Element) => tile.closest<HTMLElement>("[data-mosaic-col]");
    const trackOf = (col: HTMLElement | null) => col?.querySelector<HTMLElement>("[data-track]") ?? null;
    // Before the controller loads, the island holds/releases the rate itself.
    const controllerReady = () => mosaic.hasAttribute("data-motion-ready");

    const onMosaicFocusIn = (e: FocusEvent) => {
      const tile = closest<HTMLAnchorElement>(e.target, TILE);
      if (!tile) return;
      prefetch(tile.dataset.slug);
      echo(tile.dataset.slug ?? null);
      if (!tile.matches(":focus-visible")) return;
      const col = columnOf(tile);
      const track = trackOf(col);
      if (!col || !track) return;
      col.setAttribute("data-hold-focus", "");
      const anim = trackAnimation(track);
      if (anim) anim.playbackRate = 0;
      // overflow:clip can't scroll, so move the loop until the tile is in view.
      const dy = revealDelta(tile, mosaic.getBoundingClientRect());
      if (dy) shiftTrack(track, dy);
    };
    const onMosaicFocusOut = (e: FocusEvent) => {
      const tile = closest<HTMLAnchorElement>(e.target, TILE);
      const col = tile && columnOf(tile);
      if (!col) return;
      const next = e.relatedTarget instanceof Node ? e.relatedTarget : null;
      if (next && col.contains(next)) return;
      col.removeAttribute("data-hold-focus");
      echo(null);
      const track = trackOf(col);
      const anim = track && !controllerReady() ? trackAnimation(track) : null;
      if (anim) anim.playbackRate = 1;
    };

    // ── Navigation ─────────────────────────────────────────────────────
    const onClick = (e: MouseEvent) => {
      if (!isPlainClick(e)) return;
      const tile = closest<HTMLAnchorElement>(e.target, TILE);
      if (tile && mosaic.contains(tile)) {
        const slug = tile.dataset.slug;
        if (!slug || !known.has(slug)) return;
        e.preventDefault();
        rememberScroll();
        router.push(`/work/${slug}`, {
          transitionTypes: tile.hasAttribute("data-canonical") ? [MORPH_TYPE] : [],
        });
        return;
      }
      // Index and list links navigate through <Link>; just remember the spot.
      if (closest(e.target, 'a[href^="/work/"]')) rememberScroll();
    };

    index.addEventListener("pointerover", onIndexOver);
    index.addEventListener("pointerleave", onIndexLeave);
    index.addEventListener("focusin", onIndexFocusIn);
    index.addEventListener("focusout", onIndexFocusOut);
    mosaic.addEventListener("pointerover", onMosaicOver);
    mosaic.addEventListener("pointerleave", onMosaicLeave);
    mosaic.addEventListener("focusin", onMosaicFocusIn);
    mosaic.addEventListener("focusout", onMosaicFocusOut);
    section.addEventListener("click", onClick);

    // ── Lazy motion controller ─────────────────────────────────────────
    let cancelled = false;
    let stop: (() => void) | undefined;
    const offIdle = afterLoadIdle(() => {
      import("./mosaicMotion")
        .then((m) => {
          if (!cancelled) stop = m.startMosaicMotion(section);
        })
        .catch(() => {
          /* the CSS loop keeps running on its own */
        });
    });

    return () => {
      cancelled = true;
      offIdle();
      stop?.();
      index.removeEventListener("pointerover", onIndexOver);
      index.removeEventListener("pointerleave", onIndexLeave);
      index.removeEventListener("focusin", onIndexFocusIn);
      index.removeEventListener("focusout", onIndexFocusOut);
      mosaic.removeEventListener("pointerover", onMosaicOver);
      mosaic.removeEventListener("pointerleave", onMosaicLeave);
      mosaic.removeEventListener("focusin", onMosaicFocusIn);
      mosaic.removeEventListener("focusout", onMosaicFocusOut);
      section.removeEventListener("click", onClick);
      hoverSlug = focusSlug = null;
      applyIndex();
      echo(null);
      mosaic.querySelectorAll("[data-hold-focus]").forEach((el) => el.removeAttribute("data-hold-focus"));
    };
  }, [router, slugs]);

  return null;
}
