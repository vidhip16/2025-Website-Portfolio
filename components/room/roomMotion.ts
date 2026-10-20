// Lazy room + contact scroll controller (blueprint §3.2 "Morph timing" / "Exit", §3.5, §5.4).
// RoomScroll loads it with import() after load + idle, and only while ambient motion is allowed, so
// GSAP and ScrollTrigger never reach the first-load bundle. Everything runs inside gsap.matchMedia
// (desktop ≥ 1024 px / phones, motionOK only); reduced motion and Pause use roomStill.ts instead.
//
// ScrollTriggers (no animations; each one reports its progress into a channel):
//   enter      #about "top bottom" → "top 40%"        paper → night from its midpoint (phones; on
//                                                       desktop the hero pin has already done it)
//   morph k    one per chapter boundary, over the middle 40% between the two chapter midpoints
//              (midpoint = the scroll position that puts the chapter's centre at the viewport centre)
//   exit       #about "bottom bottom" → "bottom 70%"  the last 30vh: dots fade out, night → paper
//                                                       from its midpoint
//   contact    [data-dots-anchor="contact"] "top bottom" → "top 60%" (desktop only): the 40vh in
//              which the anchor comes on screen. Scatter → envelope: shape 4 → 5 with disperse 1
//              (the curl noise peaks mid-morph), opacity 0 → 1 over its first 35%.
// One ticker callback eases every channel toward its trigger's progress (≈ scrub: 1) and then writes
// the whole state at once in sync(), so the result never depends on which trigger updated last. It
// also re-syncs when heroProgress moves (heroNight feeds the colour and the glow) and after every
// ScrollTrigger refresh (see onRefresh).
//
// State written while the room or contact zone is active:
//   page palette    night while n = max(heroNight, enter) × (1 − exit) ≥ .5, else paper. heroNight
//                    follows the hero's own span (heroProgress .5 → 1, desktop), so the two writers
//                    always agree. A change is a short time-based fade between the two complete
//                    palettes (palette.ts, shared with the hero), never a scrubbed mix: a mix of text
//                    and ground rests mid-way under 4.5 : 1 contrast (WCAG 1.4.3). The same switch
//                    sets body[data-room="night"] (the lilac focus ring).
//   stage.dots       room:    shape 1 + Σ morph_k, disperse 1, opacity 1 − exit, glow n
//                    contact: shape 4 → 5 (then the success sequence), disperse 1, glow 0
//   stage.anchor     "room" | "contact" (roomStage.ts; a sharedRequest until lib/stage declares it)
// Above the room (the hero zone, roomShared HERO_REST): the palette is the hero's (the room asks
// for the same one, heroNight ≥ .5); stage.dots goes back to lib/stage's initial values (shape 0, disperse 0, opacity 1),
// with glow = heroNight. The renderer derives the hero release from heroProgress, and the way back
// up finds shape 0 for the reverse hand-off.
// On "contact:success" (desktop) the renderer streams the envelope right and reforms Ping seated on
// its own clock (DECISIONS 33); the room keeps stage.dots.shape unchanged and shows mascot.boopLine.
//
// Cleanup (matchMedia revert, Pause, an Activity-hidden route) kills every trigger and tween and
// undoes every write. Safe to re-run.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DESKTOP_MQ, getMotionPrefs } from "@/lib/motion";
import { stage } from "@/lib/stage";
import { addTick } from "@/lib/ticker";
import {
  BOOP_HOLD_MS,
  CONTACT_SHAPE,
  HERO_REST,
  SEAT_SHAPE,
  heroNight,
  visible,
} from "./roomShared";
import { acquirePalette } from "./palette";
import { isNight } from "./paletteMath";
import {
  getAnchor,
  releaseBubble,
  setAnchor,
  setBubble,
  setNight,
  writeDots,
} from "./roomStage";

/** Each morph runs over the middle 40% of the gap between two chapter midpoints. */
const MORPH_FROM = 0.3;
const MORPH_TO = 0.7;
/** Easing time constant (s) toward the scroll position: ≈ GSAP scrub: 1 (99% after one second). */
const TAU = 0.2;
const SNAP = 0.0005;
/** The contact dots fade in over the first part of their scrub. */
const CONTACT_FADE = 0.35;
/** The success sequence (s). */
const BOOP_AT = 1.5;

type Channel = { target: number; value: number };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Scroll position that puts the element's centre at the viewport centre. */
const midScroll = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.top + window.scrollY + r.height / 2 - window.innerHeight / 2;
};

function build(room: HTMLElement, desktop: boolean, boopLine: string): () => void {
  const chapters = Array.from(room.querySelectorAll<HTMLElement>("[data-chapter]"));
  if (!chapters.length) return () => {};
  const shapes = chapters.map((el) => Number(el.dataset.shape) || SEAT_SHAPE);
  const lastShape = shapes[shapes.length - 1];
  const anchor = desktop ? document.querySelector<HTMLElement>('[data-dots-anchor="contact"]') : null;

  // The page palette is shared with the hero (palette.ts): this only says which one is wanted.
  const palette = acquirePalette(!desktop);

  const channel = (): Channel => ({ target: 0, value: 0 });
  const enter = channel();
  const exit = channel();
  const contact = channel();
  const morphs = chapters.slice(1).map(channel);
  const channels = [enter, exit, contact, ...morphs];
  const triggers: ScrollTrigger[] = [];

  const track = (c: Channel, vars: ScrollTrigger.Vars) => {
    const st = ScrollTrigger.create({
      ...vars,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        c.target = self.progress;
      },
      onRefresh: (self) => {
        c.target = self.progress;
      },
    });
    c.target = st.progress;
    triggers.push(st);
  };

  track(enter, { trigger: room, start: "top bottom", end: "top 40%" });
  morphs.forEach((c, i) => {
    const a = chapters[i];
    const b = chapters[i + 1];
    const at = (f: number) => () => {
      const s0 = midScroll(a);
      return s0 + f * (midScroll(b) - s0);
    };
    track(c, { trigger: b, start: at(MORPH_FROM), end: at(MORPH_TO) });
  });
  track(exit, { trigger: room, start: "bottom bottom", end: "bottom 70%" });
  if (anchor && visible(anchor)) {
    track(contact, { trigger: anchor, start: "top bottom", end: "top 60%" });
  }

  // ── The contact "send" ───────────────────────────────────────────────
  /** Time-driven drive values, multiplied into / replacing the scrubbed contact state. */
  const sent = { done: false, shape: CONTACT_SHAPE, stream: 0, fade: 1 };
  let seq: gsap.core.Timeline | null = null;
  let boopTimer = 0;
  let dirty = true;

  const contactShape = () => (sent.done ? sent.shape : lastShape + contact.value * (CONTACT_SHAPE - lastShape));

  // The renderer owns the send animation (lead decision, DECISIONS 33): on "contact:success" it
  // streams the envelope off and reforms the seated Ping by itself, as long as stage.dots.shape is
  // left unchanged. So the room only holds the contact state and shows the boop line.
  const onSent = () => {
    if (!anchor || !visible(anchor)) return;
    seq?.kill();
    window.clearTimeout(boopTimer);
    releaseBubble(boopLine);
    sent.shape = contactShape();
    sent.done = true;
    sent.stream = 0;
    sent.fade = 1;
    dirty = true;
    seq = gsap.timeline().call(
      () => {
        if (getAnchor() !== "contact") return;
        setBubble(boopLine);
        boopTimer = window.setTimeout(() => releaseBubble(boopLine), BOOP_HOLD_MS);
      },
      undefined,
      BOOP_AT,
    );
  };
  window.addEventListener("contact:success", onSent);

  // ── One write per frame ──────────────────────────────────────────────
  /** heroProgress at the last sync (the tick re-syncs when it moves). */
  let lastHero = Number.NaN;

  const sync = () => {
    dirty = false;
    lastHero = stage.get().heroProgress;
    // heroNight: the hero's own tween is the writer above the room (desktop pin only).
    const hn = heroNight(lastHero, desktop);
    const roomOn = enter.value > 0 || exit.value > 0 || morphs.some((c) => c.value > 0);
    const contactOn = contact.value > 0;
    if (!roomOn && !contactOn) {
      // The hero zone. Leave the body to the hero's tween and hand the stage back (roomShared
      // HERO_REST), otherwise a visit to the room leaves seated, dispersed, glowing Ping behind.
      // Glow keeps following the hero's night amount, so it meets the room's glow without a jump
      // and is 0 again before the hand-off.
      releaseBubble(boopLine);
      if (getAnchor() !== "room") setAnchor("room");
      palette.set(isNight(hn));
      writeDots({ ...HERO_REST, glow: hn });
      return;
    }

    const n = Math.max(hn, enter.value) * (1 - exit.value);
    const dark = isNight(n);
    palette.set(dark);
    setNight(dark);

    if (contactOn) {
      setAnchor("contact");
      writeDots({
        shape: contactShape(),
        disperse: 1,
        opacity: clamp01(contact.value / CONTACT_FADE) * sent.fade,
        glow: 0,
        stream: sent.stream,
      });
    } else {
      // The boop line belongs beside the envelope; never let it follow the dots back to the room box.
      releaseBubble(boopLine);
      setAnchor("room");
      const shape = morphs.reduce((sum, c, i) => sum + c.value * (shapes[i + 1] - shapes[i]), shapes[0]);
      writeDots({ shape, disperse: 1, opacity: 1 - exit.value, glow: n, stream: 0 });
    }
  };

  const off = addTick((_time, deltaMs) => {
    const k = 1 - Math.exp(-Math.min(deltaMs, 100) / 1000 / TAU);
    let moved = false;
    for (const c of channels) {
      if (c.value === c.target) continue;
      const d = c.target - c.value;
      c.value = Math.abs(d) < SNAP ? c.target : c.value + d * k;
      moved = true;
    }
    if (moved || dirty || stage.get().heroProgress !== lastHero) sync();
  });

  // Any ScrollTrigger.refresh() (resize, zoom, the hero's rebuild, a matchMedia flip) reverts and
  // re-renders every invalidateOnRefresh animation, and the hero's revert can take body's inline
  // palette with it. The channels don't move on a refresh, so the tick wouldn't notice. Re-assert
  // the whole state here instead ("refresh" is dispatched at the end of the refresh, synchronously,
  // so no frame of the wrong palette paints). palette.set() with the palette already wanted only
  // rewrites what differs from the inline values.
  const onRefresh = () => sync();
  ScrollTrigger.addEventListener("refresh", onRefresh);

  // A reload or deep link may start anywhere: begin at the scroll position, not at 0.
  channels.forEach((c) => (c.value = c.target));
  sync();

  return () => {
    off();
    ScrollTrigger.removeEventListener("refresh", onRefresh);
    triggers.forEach((t) => t.kill());
    seq?.kill();
    window.removeEventListener("contact:success", onSent);
    window.clearTimeout(boopTimer);
    releaseBubble(boopLine);
    palette.release();
    if (getAnchor() !== "room") setAnchor("room");
    writeDots({ stream: 0 });
  };
}

export function startRoomMotion(room: HTMLElement, boopLine: string): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const mm = gsap.matchMedia();
  mm.add(
    { desktop: DESKTOP_MQ, motionOK: "(prefers-reduced-motion: no-preference)" },
    (ctx) => {
      const { desktop, motionOK } = ctx.conditions ?? {};
      if (!motionOK || getMotionPrefs().paused) return;
      return build(room, !!desktop, boopLine);
    },
  );
  return () => mm.revert();
}
