// Lazy motion controller for the mosaic (§6.2, §6.3). WorkClient loads it with
// import() after load + idle, so GSAP, the ticker and the scroll module never
// reach the first-load bundle.
//
// One addTick ticker drives every track through `getAnimations()[0]`:
//   boost = max(boost·0.92, min(|v|·0.08, 4))         v = getScrollVelocity()
//   dir   = |v| > 0.5 ? sign(v) : 1                   (never a stale direction)
//   rate += ((1 + boost)·dir − rate)·0.12
// Track animations are never played, paused or cancelled: off-screen, Pause
// motion, hover/focus and the index all ease playbackRate to 0 and back.
// currentTime starts at an exact multiple of the iteration (phase kept) and is
// pushed forward a thousand iterations whenever it drops below one, so reverse
// playback never reaches 0, where an infinite CSS animation would finish.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { addTick } from "@/lib/ticker";
import { getScrollVelocity } from "@/lib/scroll";
import { FINE_POINTER_MQ, getMotionPrefs, subscribeMotion } from "@/lib/motion";
import { PEEK_VIEWBOX, PUPIL_TRAVEL } from "./peekGeometry";
import { revealDelta, shiftTrack } from "./reveal";

const LERP = 0.12;
const BOOST_GAIN = 0.08;
const BOOST_MAX = 4;
const BOOST_DECAY = 0.92;
const DIR_MIN_V = 0.5;
/** playbackRate is written only when it moves by more than this. */
const WRITE_EPS = 0.01;
const SETTLE_EPS = 0.002;
/** Touch: half speed on top of the 60 s CSS loop. */
const TOUCH_FACTOR = 0.5;
/** Index hover: how quickly a column glides its tile into view. */
const GLIDE_LERP = 0.16;
const PUPIL_LERP = 0.22;
/** Distance (px) at which the pupils reach full travel. */
const PUPIL_REACH = 140;
const BUBBLE_LERP = 0.3;
/** Safety net for animations recreated by layout changes. */
const REACQUIRE_MS = 1000;

type Track = {
  col: HTMLElement;
  el: HTMLElement;
  anim: Animation | null;
  /** Iteration duration in ms (0 until the first animation is seen). */
  dur: number;
  rate: number;
  written: number;
};

type Pupil = {
  el: SVGElement;
  svg: SVGSVGElement;
  cx: number;
  cy: number;
  /** Max travel in viewbox units (per eye: the domes differ in size). */
  travel: number;
  x: number;
  y: number;
};

export function startMosaicMotion(section: HTMLElement): () => void {
  const mosaic = section.querySelector<HTMLElement>("[data-mosaic]");
  const wrap = mosaic?.parentElement;
  if (!mosaic || !wrap) return () => {};

  gsap.registerPlugin(ScrollTrigger);
  const fine = window.matchMedia(FINE_POINTER_MQ);
  const touch = window.matchMedia("(hover: none)");

  const tracks: Track[] = [...mosaic.querySelectorAll<HTMLElement>("[data-mosaic-col]")].flatMap((col) => {
    const el = col.querySelector<HTMLElement>("[data-track]");
    return el ? [{ col, el, anim: null, dur: 0, rate: 1, written: 1 }] : [];
  });

  const pupils: Pupil[] = [...mosaic.querySelectorAll<SVGElement>("[data-pupil]")].flatMap((el) => {
    const svg = el.ownerSVGElement;
    if (!svg) return [];
    const travel = Number(el.dataset.travel) || PUPIL_TRAVEL;
    return [{ el, svg, cx: Number(el.dataset.cx), cy: Number(el.dataset.cy), travel, x: 0, y: 0 }];
  });

  const bubbleEl = wrap.querySelector<HTMLElement>("[data-view-bubble]");
  const bubble = { on: false, placed: false, x: 0, y: 0 };
  const pointer = { x: 0, y: 0, seen: false };

  let boost = 0;
  let visible = false;
  let hoverCol: HTMLElement | null = null;
  let glideSlug: string | null = null;
  let glides: { track: HTMLElement; left: number }[] = [];
  let lastAcquire = 0;
  let removeTick: (() => void) | null = null;

  // ── Animations ───────────────────────────────────────────────────────
  const acquire = (t: Track) => {
    const anim = t.el.getAnimations()[0] ?? null;
    if (anim === t.anim) return;
    const first = t.dur === 0;
    t.anim = anim;
    if (!anim) return;
    const dur = Number(anim.effect?.getTiming().duration) || 0;
    if (dur <= 0) {
      t.anim = null;
      return;
    }
    t.dur = dur;
    // Exact multiple of the iteration plus the current phase: nothing moves.
    const phase = (((Number(anim.currentTime ?? 0) % dur) + dur) % dur) || 0;
    anim.currentTime = dur * 10000 + phase;
    // First sight: keep a hold set by WorkClient (rate 0) and start at rest
    // when motion is off, so taking over from the CSS pause never jolts.
    if (first) t.rate = getMotionPrefs().ok ? anim.playbackRate : 0;
    anim.playbackRate = t.rate;
    t.written = t.rate;
  };

  // ── Index glide: bring the highlighted project's cover into view ──────
  const planGlide = (slug: string) => {
    const box = mosaic.getBoundingClientRect();
    const best = new Map<HTMLElement, number>();
    mosaic
      .querySelectorAll<HTMLElement>(`a[data-tile][data-kind="cover"][data-slug="${CSS.escape(slug)}"]`)
      .forEach((tile) => {
        const track = tile.closest<HTMLElement>("[data-track]");
        if (!track || !track.offsetParent) return; // column hidden at this width
        const d = revealDelta(tile, box, 24);
        const prev = best.get(track);
        if (prev === undefined || Math.abs(d) < Math.abs(prev)) best.set(track, d);
      });
    return [...best].filter(([, d]) => d !== 0).map(([track, left]) => ({ track, left }));
  };

  const glideStep = (ok: boolean): boolean => {
    const slug = mosaic.getAttribute("data-active-slug");
    if (slug !== glideSlug) {
      glideSlug = slug;
      glides = slug ? planGlide(slug) : [];
    }
    if (!glides.length) return false;
    for (const g of glides) {
      const step = ok ? g.left * GLIDE_LERP : g.left;
      shiftTrack(g.track, step);
      g.left -= step;
    }
    glides = glides.filter((g) => Math.abs(g.left) > 0.5);
    return glides.length > 0;
  };

  // ── Pupils follow the cursor (snapping when motion is off) ────────────
  const pupilStep = (ok: boolean): boolean => {
    if (!pointer.seen || !pupils.length) return false;
    let moving = false;
    const rects = new Map<SVGSVGElement, DOMRect>();
    for (const p of pupils) {
      let r = rects.get(p.svg);
      if (!r) {
        r = p.svg.getBoundingClientRect();
        rects.set(p.svg, r);
      }
      if (!r.width || r.bottom < 0 || r.top > window.innerHeight) continue;
      const s = r.width / PEEK_VIEWBOX.w;
      const dx = pointer.x - (r.left + p.cx * s);
      const dy = pointer.y - (r.top + p.cy * s);
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / PUPIL_REACH) * p.travel;
      const k = ok ? PUPIL_LERP : 1;
      const nx = p.x + ((dx / d) * reach - p.x) * k;
      const ny = p.y + ((dy / d) * reach - p.y) * k;
      if (Math.abs(nx - p.x) > 0.02 || Math.abs(ny - p.y) > 0.02) {
        p.x = nx;
        p.y = ny;
        p.el.setAttribute("transform", `translate(${nx.toFixed(2)} ${ny.toFixed(2)})`);
        moving = true;
      }
    }
    return moving;
  };

  // ── "View" bubble ─────────────────────────────────────────────────────
  const bubbleStep = (ok: boolean): boolean => {
    if (!bubbleEl || !bubble.on) return false;
    const r = wrap.getBoundingClientRect();
    const tx = pointer.x - r.left;
    const ty = pointer.y - r.top;
    if (!bubble.placed || !ok) {
      bubble.x = tx;
      bubble.y = ty;
      bubble.placed = true;
    } else {
      bubble.x += (tx - bubble.x) * BUBBLE_LERP;
      bubble.y += (ty - bubble.y) * BUBBLE_LERP;
    }
    bubbleEl.style.transform = `translate3d(${bubble.x.toFixed(1)}px, ${bubble.y.toFixed(1)}px, 0)`;
    return Math.abs(tx - bubble.x) > 0.3 || Math.abs(ty - bubble.y) > 0.3;
  };

  // ── The one ticker ────────────────────────────────────────────────────
  const tick = () => {
    const now = performance.now();
    if (now - lastAcquire > REACQUIRE_MS) {
      lastAcquire = now;
      tracks.forEach(acquire);
    }
    const { ok } = getMotionPrefs();
    const v = getScrollVelocity();
    boost = Math.max(boost * BOOST_DECAY, Math.min(Math.abs(v) * BOOST_GAIN, BOOST_MAX));
    const dir = Math.abs(v) > DIR_MIN_V ? Math.sign(v) : 1;
    const run = ok && visible && !mosaic.hasAttribute("data-hold");
    const base = (1 + boost) * dir * (touch.matches ? TOUCH_FACTOR : 1);

    let busy = false;
    for (const t of tracks) {
      const a = t.anim;
      if (!a) continue;
      if (t.col.hasAttribute("data-hold-focus")) {
        t.rate = 0; // keyboard focus: hold at once so the revealed tile stays put
      } else {
        const target = run && t.col !== hoverCol ? base : 0;
        t.rate += (target - t.rate) * LERP;
        if (Math.abs(target - t.rate) < SETTLE_EPS) t.rate = target;
        if (target !== 0 || t.rate !== 0) busy = true;
      }
      if (Math.abs(t.rate - t.written) > WRITE_EPS || (t.rate === 0 && t.written !== 0)) {
        a.playbackRate = t.rate;
        t.written = t.rate;
      }
      const ct = Number(a.currentTime ?? 0);
      if (ct < t.dur) a.currentTime = ct + t.dur * 1000;
    }
    if (glideStep(ok)) busy = true;
    if (visible && pupilStep(ok)) busy = true;
    if (bubbleStep(ok)) busy = true;
    if (!busy) sleep();
  };

  const wake = () => {
    if (!removeTick) removeTick = addTick(tick);
  };
  const sleep = () => {
    removeTick?.();
    removeTick = null;
  };

  // ── Parallax: an outer wrapper per column, scrubbed across the section ─
  let ctx: gsap.Context | null = null;
  const setParallax = (on: boolean) => {
    if (on && !ctx) {
      ctx = gsap.context(() => {
        for (const { col } of tracks) {
          const travel = Number(col.dataset.parallax) || 0;
          if (!travel) continue;
          gsap.fromTo(
            col,
            { yPercent: -travel / 2 },
            {
              yPercent: travel / 2,
              ease: "none",
              scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true },
            },
          );
        }
      }, section);
    } else if (!on && ctx) {
      ctx.revert();
      ctx = null;
    }
  };

  // ── Listeners ─────────────────────────────────────────────────────────
  const trackOf = (target: EventTarget | null) =>
    target instanceof Element ? tracks.find((t) => t.el === target) : undefined;
  const tileOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>("a[data-tile]") : null;

  const onAnimStart = (e: AnimationEvent) => {
    const t = trackOf(e.target);
    if (!t) return;
    acquire(t);
    wake();
  };
  const onAnimCancel = (e: AnimationEvent) => {
    const t = trackOf(e.target);
    if (t) t.anim = null;
  };

  const setBubble = (on: boolean) => {
    if (bubble.on === on || !bubbleEl) return;
    bubble.on = on;
    bubble.placed = false;
    bubbleEl.toggleAttribute("data-on", on);
  };

  const onOver = (e: PointerEvent) => {
    const tile = tileOf(e.target);
    if (!tile || e.pointerType === "touch" || !fine.matches) return;
    hoverCol = tile.closest<HTMLElement>("[data-mosaic-col]");
    setBubble(true);
    wake();
  };
  const onOut = (e: PointerEvent) => {
    const tile = tileOf(e.target);
    if (!tile) return;
    const next = e.relatedTarget instanceof Node ? e.relatedTarget : null;
    if (next && tile.contains(next)) return;
    if (!tileOf(next)) {
      hoverCol = null;
      setBubble(false);
    }
    wake();
  };
  const onLeave = () => {
    hoverCol = null;
    setBubble(false);
    wake();
  };
  const onPointerMove = (e: PointerEvent) => {
    // The pupils and the bubble follow a cursor. A finger scrolling the page isn't one, and
    // letting it wake pupilStep measured the peek SVGs (a forced layout) every frame of the scroll.
    if (e.pointerType === "touch") return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.seen = true;
    if (visible) wake();
  };
  const onScroll = () => {
    if (visible) wake();
  };

  mosaic.addEventListener("animationstart", onAnimStart);
  mosaic.addEventListener("animationcancel", onAnimCancel);
  mosaic.addEventListener("pointerover", onOver);
  mosaic.addEventListener("pointerout", onOut);
  mosaic.addEventListener("pointerleave", onLeave);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = !!entry?.isIntersecting;
      wake();
    },
    { rootMargin: "120px 0px" },
  );
  io.observe(mosaic);

  // WorkClient flags (index hold, active slug, focus hold) wake the ticker.
  const mo = new MutationObserver(wake);
  mo.observe(mosaic, {
    attributes: true,
    subtree: true,
    attributeFilter: ["data-hold", "data-active-slug", "data-hold-focus"],
  });

  // Height changes (list ⇄ mosaic, fonts, images) move every trigger below.
  let lastHeight = -1;
  let refreshTimer = 0;
  const ro = new ResizeObserver(([entry]) => {
    const h = Math.round(entry?.contentRect.height ?? 0);
    if (lastHeight >= 0 && h !== lastHeight) {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    }
    lastHeight = h;
  });
  ro.observe(section);

  const unsubscribe = subscribeMotion(() => {
    setParallax(getMotionPrefs().ok);
    tracks.forEach(acquire);
    wake();
  });

  // Seed visibility so the first ticks don't ease a visible wall toward 0
  // before the observer reports.
  const r = mosaic.getBoundingClientRect();
  visible = r.width > 0 && r.bottom > -120 && r.top < window.innerHeight + 120;

  tracks.forEach(acquire);
  setParallax(getMotionPrefs().ok);
  mosaic.setAttribute("data-motion-ready", "");
  wake();

  return () => {
    sleep();
    io.disconnect();
    mo.disconnect();
    ro.disconnect();
    window.clearTimeout(refreshTimer);
    unsubscribe();
    setParallax(false);
    mosaic.removeEventListener("animationstart", onAnimStart);
    mosaic.removeEventListener("animationcancel", onAnimCancel);
    mosaic.removeEventListener("pointerover", onOver);
    mosaic.removeEventListener("pointerout", onOut);
    mosaic.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("scroll", onScroll);
    setBubble(false);
    mosaic.removeAttribute("data-motion-ready");
  };
}
