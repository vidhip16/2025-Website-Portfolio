"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import gaze from "@/content/gaze.json";
import type { DotsProbe } from "@/lib/gaze";
import { DESKTOP_MQ, useMotionPrefs } from "@/lib/motion";
import type { TierReason } from "@/lib/quality";
import { stage, type StageState } from "@/lib/stage";
import { LAST_SHAPE, clamp, clamp01, halftoneFrame, roomRegion, shapeRect } from "./layout";

// T0 (blueprint §5.5, §5.6): static halftones in place of the dot cloud, pre-rendered by
// scripts/render_halftones.py into public/dots/halftone-{k}{-night}.webp (640², each shape fitted
// in 86% of the frame). No WebGL, no loop:
//   - motion on (no WebGL2, Save-Data, a lost context, the governor): they crossfade with
//     `stage.dots.shape` and `stage.dots.opacity`, which the room and contact scrubs write;
//   - reduced motion or Pause: one halftone per chapter, hard cuts (the scrubs don't run then).
// The room's halftone sits where the live shapes sit (fixed, behind main, first child of <body>);
// the envelope sits inside `[data-dots-anchor="contact"]` (desktop; phones show F's sticker).

const QA = process.env.NEXT_PUBLIC_QA === "1";
const PING_ASPECT = gaze.box.w / gaze.box.h;
/** Seat scale of shape 1 (public/dots/shapes.json); icons are 512² masks at scale 1. */
const SEAT_SCALE = 0.6;
/** The About chapter's shape; later chapters follow in order (content/site.ts `chapters[].shape`). */
const FIRST_ROOM_SHAPE = 1;

/** A chapter's shape: its `data-shape` when the room renders one, else its position (About = 1). */
const chapterShape = (el: HTMLElement, i: number) => {
  const own = Number(el.dataset.shape);
  return Number.isInteger(own) && own >= FIRST_ROOM_SHAPE && own <= 4 ? own : FIRST_ROOM_SHAPE + i;
};

const src = (k: number, night: boolean) => `/dots/halftone-${k}${night ? "-night" : ""}.webp`;

/** body[data-room="night"] (the hero and room scrubs set it while the page is dark). */
function subscribeNight(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.body, { attributes: true, attributeFilter: ["data-room"] });
  return () => mo.disconnect();
}
const getNight = () => document.body.dataset.room === "night";

/** Viewport size + desktop flag, as one snapshot string (stable between resizes). */
function subscribeView(cb: () => void) {
  window.addEventListener("resize", cb, { passive: true });
  return () => window.removeEventListener("resize", cb);
}
const getView = () =>
  `${document.documentElement.clientWidth}x${window.innerHeight}x${window.matchMedia(DESKTOP_MQ).matches ? 1 : 0}`;

/** stage.dots.shape and .opacity only: the hero scrub writes the stage every frame, this needs neither of its fields. */
const dotsSnapshot = () => {
  const d: StageState["dots"] = stage.get().dots;
  return `${d.shape}|${d.opacity}`;
};
function useStageDots(): { shape: number; opacity: number } {
  const [shape, opacity] = useSyncExternalStore(stage.subscribe, dotsSnapshot, dotsSnapshot).split("|").map(Number);
  return { shape, opacity };
}

/** The chapter (and so the shape) under the viewport's centre line, for hard cuts; plus whether #about is under it. */
function useCentreChapter(): { inRoom: boolean; shape: number } {
  const [state, setState] = useState({ inRoom: false, shape: FIRST_ROOM_SHAPE });
  useEffect(() => {
    const room = document.getElementById("about");
    if (!room) return;
    const chapters = Array.from(room.querySelectorAll<HTMLElement>("[data-chapter]"));
    const hits = new Map<Element, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) hits.set(e.target, e.isIntersecting);
        const inRoom = hits.get(room) ?? false;
        const i = chapters.findIndex((c) => hits.get(c));
        setState((prev) => {
          const shape = i >= 0 ? chapterShape(chapters[i], i) : prev.shape;
          return prev.inRoom === inRoom && prev.shape === shape ? prev : { inRoom, shape };
        });
      },
      // A thin band at the viewport's centre (not a zero-height line: engines differ on edge-adjacent hits).
      { rootMargin: "-49.5% 0px -49.5% 0px" },
    );
    io.observe(room);
    chapters.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);
  return state;
}

/** Plain intersection with the viewport (crossfades need the room as soon as any of it shows). */
function useInView(id: string): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(!!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [id]);
  return inView;
}

/**
 * The halftone layer: a fixed element that is the body's first child while mounted, like the
 * canvas. Created once (this component is client-only, `ssr: false`); the effect attaches it and
 * its cleanup detaches it, so an Activity hide leaves nothing behind.
 */
function useBodyHost(): HTMLElement {
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.setAttribute("data-halftone-layer", "");
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "100%",
      height: "100%",
      zIndex: "0",
      pointerEvents: "none",
      overflow: "hidden",
    });
    return el;
  });
  useEffect(() => {
    document.body.prepend(host);
    return () => host.remove();
  }, [host]);
  return host;
}

/** `[data-dots-anchor="contact"]` (components/contact/Contact.tsx), looked up once on mount. */
function useContactAnchor(): HTMLElement | null {
  const [anchor] = useState(() => document.querySelector<HTMLElement>('[data-dots-anchor="contact"]'));
  return anchor;
}

export default function StaticDots({ reason }: { reason: TierReason }) {
  // Reduced motion or Pause: the scrubs don't run, so the chapter under the centre line decides.
  const hardCuts = !useMotionPrefs().ok || reason === "reduced-motion";
  const dots = useStageDots();
  const night = useSyncExternalStore(subscribeNight, getNight, () => false);
  const view = useSyncExternalStore(subscribeView, getView, () => "0x0x1");
  const centre = useCentreChapter();
  const roomInView = useInView("about");
  const host = useBodyHost();
  const anchor = useContactAnchor();

  // Which shapes, and how much of each.
  const scrubbed = clamp(Number.isFinite(dots.shape) ? dots.shape : 0, FIRST_ROOM_SHAPE, LAST_SHAPE);
  const shape = hardCuts ? centre.shape : scrubbed;
  const a = Math.floor(shape);
  const b = Math.min(a + 1, LAST_SHAPE);
  const f = hardCuts ? 0 : shape - a;
  const roomOpacity = hardCuts ? (centre.inRoom ? 1 : 0) : roomInView ? clamp01(dots.opacity) : 0;
  const envelope = hardCuts ? 1 : clamp01(shape - 4);

  useEffect(() => {
    if (!QA) return;
    const probe: DotsProbe = { shape: hardCuts ? centre.shape : scrubbed, holeR: 0, pupilDir: 0, tier: "T0" };
    window.__dots = probe;
  }, [hardCuts, centre.shape, scrubbed]);

  const [vw, vh, desktop] = view.split("x").map(Number);
  const region = roomRegion(vw, vh, desktop !== 1);
  const layer = (k: number, opacity: number) => {
    if (k > 4 || opacity <= 0.001) return null;
    const ping = k <= 1;
    const box = shapeRect(region, ping ? PING_ASPECT : 1, k === 1 ? SEAT_SCALE : 1, ping);
    const frame = halftoneFrame(box);
    return (
      <Image
        key={k}
        src={src(k, night)}
        alt=""
        width={640}
        height={640}
        unoptimized
        loading="eager"
        draggable={false}
        style={{
          position: "absolute",
          left: frame.left,
          top: frame.top,
          width: frame.size,
          height: frame.size,
          maxWidth: "none",
          opacity,
        }}
      />
    );
  };

  const room = createPortal(
    <div
      data-halftone=""
      style={{ position: "absolute", inset: 0, opacity: roomOpacity, visibility: roomOpacity > 0 ? "visible" : "hidden" }}
    >
      {layer(a, 1 - f)}
      {f > 0 && layer(b, f)}
    </div>,
    host,
  );

  // The envelope fills the anchor (hidden with it below 1024 px, where F's sticker stands in).
  const contact =
    anchor &&
    envelope > 0.001 &&
    createPortal(
      <Image
        src={src(LAST_SHAPE, false)}
        alt=""
        width={640}
        height={640}
        unoptimized
        draggable={false}
        data-halftone=""
        style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", opacity: envelope }}
      />,
      anchor,
    );

  return (
    <>
      {room}
      {contact}
    </>
  );
}
