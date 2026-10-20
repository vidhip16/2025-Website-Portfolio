// Lazy hero scroll controller (blueprint §3.1 "Desktop scroll", PHASE4 "Hero scroll").
// HeroScroll loads it with import() after load + idle, so GSAP and ScrollTrigger never reach the
// first-load bundle.
//
// Desktop (≥ 1024 px) with ambient motion allowed: pin #home for +140vh, scrub 1.
//   0 → .45   "Vidhi" xPercent −14, both .name-patel +14, h1 → .3, Ping and shadow scale 1.06
//   0 → .45   front clip and shadow → .3; hidden in one frame at HANDOFF_AT (.48)
//   0 → .6    the copy (intro, status, links, wall label) fades out
//   ≥ .75     the page goes night: body paper + ink → night + moon in a short time-based fade
//             (components/room/palette.ts, never scrubbed: a scrubbed mix rests mid-way under 4.5 : 1
//             text contrast), and body[data-room="night"], so the global focus ring turns lilac
//   Every timeline update writes stage.heroProgress (the smoothed progress the visuals follow).
// Anything else (below 1024 px, reduced motion, Pause): no ScrollTrigger at all. heroProgress is
//   0 until Ping's top reaches the viewport top, then 1 (lib/stage contract).
// Always: stage.heroInView from an IntersectionObserver.
//
// Pause / Play and the 1024 px breakpoint rebuild it. The pin adds 140vh of spacing above
// everything after the hero, so a rebuild keeps the visitor on the same content, and so does a
// reload (positions are kept flat, as if the pin were not in the page: lib/heroPin). Cleanup
// reverts everything and is safe to re-run.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { fromFlatY, registerHeroPin, toFlatY } from "@/lib/heroPin";
import { DESKTOP_MQ, getMotionPrefs, subscribeMotion } from "@/lib/motion";
import { HANDOFF_AT, stage } from "@/lib/stage";
import { acquirePalette } from "@/components/room/palette";

/** Pin length as a fraction of the viewport height. */
const PIN = 1.4;
/** 0 → SPLIT: the name parts, the h1 dims, Ping grows. */
const SPLIT = 0.45;
const NAME_SHIFT = 14;
const DIM = 0.3;
const GROW = 1.06;
/** The copy is gone by this progress. */
const COPY_OUT = 0.6;
/** NIGHT → 1: the room goes dark (heroNight in components/room/roomShared.ts runs over the same span). */
const NIGHT = 0.5;
/** On #home from HANDOFF_AT on (hero.module.css): front clip and shadow hidden, "Patel" whole. */
const HANDOFF_ATTR = "data-handoff";
/**
 * From here on the page is night: the palette fades to night + moon and body carries
 * data-room="night" (globals.css swaps --focus orchid → lilac under it). The midpoint of NIGHT → 1,
 * so it is heroNight(p) ≥ NIGHT_AT in components/room, which the room uses for the same switch.
 */
const NIGHT_ROOM = NIGHT + (1 - NIGHT) / 2;

/** sessionStorage: the scrollY and the flat position at the last pagehide (takeReloadPosition). */
const RELOAD_KEY = "vp:hero-reload";

/**
 * A reload makes the browser restore the scrollY it recorded, into a page that has no pin yet (the
 * controller arrives after load + idle). That number was recorded with the pin in the page, so it
 * is one pin length too far down for anything past the hero. The flat position saved at pagehide
 * gives the visitor's place back, but only if the page is where that save put it: a deep link, a
 * different history entry or a scroll since then all mean the live scrollY is the truth. Read once.
 * (A position inside the pin comes back at the hero's top, as in a rebuild.)
 */
function takeReloadPosition(): number | null {
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(RELOAD_KEY);
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type !== "reload" && nav?.type !== "back_forward") return null;
    const saved = JSON.parse(raw) as { y?: unknown; flat?: unknown };
    if (typeof saved.y !== "number" || typeof saved.flat !== "number") return null;
    const furthest = document.documentElement.scrollHeight - window.innerHeight;
    return Math.abs(window.scrollY - Math.min(saved.y, furthest)) <= 2 ? saved.flat : null;
  } catch {
    return null;
  }
}

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
  let night = false;

  const setHandoff = (on: boolean) => {
    if (on === handoff) return;
    handoff = on;
    section.toggleAttribute(HANDOFF_ATTR, on);
  };
  /** Writes only on change. Phase 5's room uses the same body hook, so the values agree. */
  const setNight = (on: boolean) => {
    if (on === night) return;
    night = on;
    if (on) document.body.dataset.room = "night";
    else delete document.body.dataset.room;
  };

  // ── Desktop: pin + scrub ─────────────────────────────────────────────
  const pinned = () => {
    const palette = acquirePalette();

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
        const dark = p >= NIGHT_ROOM;
        setNight(dark);
        palette.set(dark);
      },
    });

    tl.to(vidhi, { xPercent: -NAME_SHIFT }, 0)
      .to(patels, { xPercent: NAME_SHIFT }, 0)
      .to(h1, { opacity: DIM }, 0)
      .to([front, shadow], { opacity: DIM }, 0)
      .to([figure, shadow], { scale: GROW }, 0)
      .to(copy, { opacity: 0, duration: COPY_OUT }, 0)
      // The timeline is 1 long, so tl.progress() is the hero progress (the palette is not scrubbed).
      .set({}, {}, 1);

    pin = tl.scrollTrigger ?? null;
    return () => {
      // The context reverts the timeline, its ScrollTrigger and every inline style it wrote.
      pin = null;
      palette.release();
      setHandoff(false);
      setNight(false);
      stage.set({ heroProgress: 0 });
    };
  };

  // ── Everything else: no ScrollTrigger, progress 0/1 ──────────────────
  const flowing = () => {
    // 1 once figure.ping's top has passed the viewport top. The observer's root is everything
    // above that edge (a huge top margin, minus the whole viewport at the bottom), so
    // "intersecting" is exactly "top < 0", and a jump (nav link, deep link) still flips it. No
    // getBoundingClientRect per scroll frame: on phones that forced a layout every frame.
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (e) stage.set({ heroProgress: e.isIntersecting ? 1 : 0 });
      },
      { rootMargin: "100000px 0px -100% 0px" },
    );
    io.observe(figure);
    return () => {
      io.disconnect();
      stage.set({ heroProgress: 0 });
    };
  };

  // ── Pinned or flowing ────────────────────────────────────────────────
  // Not gsap.matchMedia: it flips the build by itself when the viewport crosses 1024 px, and then
  // nothing keeps the visitor's place (the pin adds or removes 140vh above everything after the
  // hero). The breakpoint is listened to here with the motion prefs, and both go through rebuild().
  const desktopMq = window.matchMedia(DESKTOP_MQ);
  const wantsPin = () => desktopMq.matches && getMotionPrefs().ok;

  let ctx: gsap.Context | null = null;
  const build = () => {
    ctx = gsap.context(() => (wantsPin() ? pinned() : flowing()));
  };

  // ── Keeping the visitor's place when the pin comes or goes ──────────
  // Positions are flat (lib/heroPin): as if the pin were not in the page. The Work island stores
  // and restores through the same registered pin.
  const unregisterPin = registerHeroPin(() =>
    pin ? { start: pin.start, end: pin.end, height: section.offsetHeight } : null,
  );
  const flatY = () => toFlatY(window.scrollY);
  /** Past the hero → shift by the pin the page has now; at the hero → stay (the pin picks it up). */
  const place = (flat: number) => {
    const y = fromFlatY(flat);
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: "instant" });
  };
  const rebuild = (before: number) => {
    // revert(), not kill(): kill leaves the inline styles and skips the cleanup function.
    ctx?.revert();
    build();
    ScrollTrigger.refresh();
    place(before);
  };

  let stopped = false;
  let unsubscribe = () => {};
  const begin = () => {
    if (stopped) return;
    // A deep link may already be scrolled past the hero, and so may a reload.
    const y = takeReloadPosition() ?? window.scrollY;
    build();
    if (pin) ScrollTrigger.refresh();
    place(y);

    let pinnedNow = wantsPin();
    const onChange = () => {
      const next = wantsPin();
      if (next === pinnedNow) return;
      pinnedNow = next;
      rebuild(flatY());
    };
    const offMotion = subscribeMotion(onChange);
    desktopMq.addEventListener("change", onChange);
    // The next load restores this scrollY into a page without the pin (takeReloadPosition).
    const remember = () => {
      try {
        sessionStorage.setItem(
          RELOAD_KEY,
          JSON.stringify({ y: Math.round(window.scrollY), flat: Math.round(flatY()) }),
        );
      } catch {
        /* storage blocked: a reload keeps the browser's position */
      }
    };
    window.addEventListener("pagehide", remember);
    unsubscribe = () => {
      offMotion();
      desktopMq.removeEventListener("change", onChange);
      window.removeEventListener("pagehide", remember);
    };
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
    unregisterPin();
    io.disconnect();
    ctx?.revert();
    ctx = null;
    pin = null;
    setHandoff(false);
    setNight(false);
    stage.set({ heroProgress: 0, heroInView: false });
  };
}
