// Lazy hero scroll controller (blueprint §3.1 "Desktop scroll", PHASE4 "Hero scroll").
// HeroScroll loads it with import() after load + idle, so GSAP and ScrollTrigger never reach the
// first-load bundle.
//
// Desktop (≥ 1024 px) with ambient motion allowed: pin #home for +140vh, scrub 1.
//   0 → .45   "Vidhi" xPercent −14, both .name-patel +14, h1 → .3, Ping and shadow scale 1.06
//   0 → .45   front clip and shadow → .3; hidden in one frame at HANDOFF_AT (.48)
//   0 → .6    the copy (intro, status, links, wall label) fades out
//   .5 → 1    body --bg paper → night, --fg ink → moon
//   Every timeline update writes stage.heroProgress (the smoothed progress the visuals follow).
// Anything else (below 1024 px, reduced motion, Pause): no ScrollTrigger at all. heroProgress is
//   0 until Ping's top reaches the viewport top, then 1 (lib/stage contract).
// Always: stage.heroInView from an IntersectionObserver.
//
// Pause / Play rebuild it. The pin adds 140vh of spacing above everything after the hero, so a
// rebuild keeps the visitor on the same content. Cleanup reverts everything and is safe to re-run.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DESKTOP_MQ, getMotionPrefs, subscribeMotion } from "@/lib/motion";
import { HANDOFF_AT, stage } from "@/lib/stage";

/** Pin length as a fraction of the viewport height. */
const PIN = 1.4;
/** 0 → SPLIT: the name parts, the h1 dims, Ping grows. */
const SPLIT = 0.45;
const NAME_SHIFT = 14;
const DIM = 0.3;
const GROW = 1.06;
/** The copy is gone by this progress. */
const COPY_OUT = 0.6;
/** NIGHT → 1: the room goes dark. */
const NIGHT = 0.5;
/** On #home from HANDOFF_AT on (hero.module.css): front clip and shadow hidden, "Patel" whole. */
const HANDOFF_ATTR = "data-handoff";

const CONDITIONS = {
  desktop: DESKTOP_MQ,
  motionOK: "(prefers-reduced-motion: no-preference)",
  reduce: "(prefers-reduced-motion: reduce)",
};

export function startHeroScroll(section: HTMLElement): () => void {
  const h1 = section.querySelector<HTMLElement>("h1");
  const vidhi = section.querySelector<HTMLElement>('[data-hero="vidhi"]');
  const front = section.querySelector<HTMLElement>('[data-hero="front"]');
  const patels = Array.from(section.querySelectorAll<HTMLElement>(".name-patel"));
  const figure = section.querySelector<HTMLElement>("figure.ping");
  const shadow = section.querySelector<HTMLElement>(".ping-shadow");
  const copy = section.querySelector<HTMLElement>('[data-hero="copy"]');
  if (!h1 || !vidhi || !front || !figure || !shadow || !copy || patels.length < 2) return () => {};

  gsap.registerPlugin(ScrollTrigger);

  let pin: ScrollTrigger | null = null;
  let handoff = false;

  const setHandoff = (on: boolean) => {
    if (on === handoff) return;
    handoff = on;
    section.toggleAttribute(HANDOFF_ATTR, on);
  };

  // ── Desktop: pin + scrub ─────────────────────────────────────────────
  const pinned = () => {
    const root = getComputedStyle(document.documentElement);
    const token = (name: string) => root.getPropertyValue(name).trim();

    const tl = gsap.timeline({
      defaults: { ease: "none", duration: SPLIT },
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: `+=${PIN * 100}%`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        // The pin shifts everything below it: measure it before any later trigger.
        refreshPriority: 1,
      },
      onUpdate: () => {
        const p = tl.progress();
        stage.set({ heroProgress: p });
        setHandoff(p >= HANDOFF_AT);
      },
    });

    tl.to(vidhi, { xPercent: -NAME_SHIFT }, 0)
      .to(patels, { xPercent: NAME_SHIFT }, 0)
      .to(h1, { opacity: DIM }, 0)
      .to([front, shadow], { opacity: DIM }, 0)
      .to([figure, shadow], { scale: GROW }, 0)
      .to(copy, { opacity: 0, duration: COPY_OUT }, 0)
      .fromTo(
        document.body,
        { "--bg": token("--paper"), "--fg": token("--ink") },
        { "--bg": token("--night"), "--fg": token("--moon"), duration: 1 - NIGHT, immediateRender: false },
        NIGHT,
      );

    pin = tl.scrollTrigger ?? null;
    return () => {
      // The context reverts the timeline, its ScrollTrigger and every inline style it wrote.
      pin = null;
      setHandoff(false);
      stage.set({ heroProgress: 0 });
    };
  };

  // ── Everything else: no ScrollTrigger, progress 0/1 ──────────────────
  const flowing = () => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      stage.set({ heroProgress: figure.getBoundingClientRect().top <= 0 ? 1 : 0 });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      stage.set({ heroProgress: 0 });
    };
  };

  let mm: gsap.MatchMedia | null = null;
  const build = () => {
    mm = gsap.matchMedia();
    mm.add(CONDITIONS, (ctx) => {
      const { desktop, motionOK } = ctx.conditions ?? {};
      return desktop && motionOK && !getMotionPrefs().paused ? pinned() : flowing();
    });
  };

  // ── Keeping the visitor's place when the pin comes or goes ──────────
  /** Where the visitor would be on the page without the pin. Inside the pin → the hero's top. */
  const flatY = () => {
    const y = window.scrollY;
    if (!pin) return y;
    const d = pin.end - pin.start;
    return y >= pin.end ? y - d : Math.min(y, pin.start);
  };
  /** After a rebuild: past the hero → shift by the new pin; at the hero → stay (pin picks it up). */
  const place = (flat: number) => {
    const y = pin && flat > pin.start + section.offsetHeight ? flat + (pin.end - pin.start) : flat;
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: "instant" });
  };
  const rebuild = (before: number) => {
    mm?.kill();
    build();
    ScrollTrigger.refresh();
    place(before);
  };

  let stopped = false;
  let unsubscribe = () => {};
  const begin = () => {
    if (stopped) return;
    // A reload or a deep link may already be scrolled past the hero.
    const y = window.scrollY;
    build();
    if (pin) {
      ScrollTrigger.refresh();
      place(y);
    }
    let ok = getMotionPrefs().ok;
    unsubscribe = subscribeMotion(() => {
      const next = getMotionPrefs().ok;
      if (next === ok) return;
      ok = next;
      rebuild(flatY());
    });
  };

  // Let the CSS entrance finish first: GSAP folds a running `translate` into its own transform
  // (and keeps it), so the scale tween must not parse Ping mid-settle.
  const settling = [figure, shadow].flatMap((el) => el.getAnimations());
  if (settling.length) {
    Promise.all(settling.map((a) => a.finished.catch(() => undefined))).then(begin);
  } else {
    begin();
  }

  const io = new IntersectionObserver(([entry]) => stage.set({ heroInView: !!entry?.isIntersecting }));
  io.observe(section);

  return () => {
    stopped = true;
    unsubscribe();
    io.disconnect();
    mm?.kill();
    mm = null;
    pin = null;
    setHandoff(false);
    stage.set({ heroProgress: 0, heroInView: false });
  };
}
