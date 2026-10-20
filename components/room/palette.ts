// The page's paper ↔ night switch (blueprint §3.1 colour scrub, §3.2), shared by the hero pin and
// the projection room.
//
// Both used to scrub body --bg/--fg with the scroll. Text and ground were interpolated in sRGB, so
// somewhere in the middle of every tween they had the same luminance: between n .25 and .75 the
// contrast is under 4.5 : 1 (1.04 : 1 at .5), and the scrub eases toward the scroll position, so the
// page comes to rest inside that band whenever the visitor stops there (WCAG 1.4.3). Now there are
// two complete palettes, paper + ink and night + moon, and the change between them takes FADE_S of
// time, whatever the scroll does. The scroll only decides which one is wanted (night from n = .5,
// paletteMath.isNight), so the page can only rest on one of them.
//
//   desktop  body --bg runs between the two grounds over the fade; --fg flips at its midpoint (ink
//            or moon, whichever is on the nearer ground), so the worst moment of a fade is about
//            3.3 : 1 for a few frames instead of 1.04 : 1
//   phones   restyling the whole page on every frame cost the frame budget (DECISIONS 36), so body
//            flips once, at the midpoint, and a fixed veil's opacity carries the blend on the
//            compositor (paletteMath.phoneVeil)
//
// One state for every caller. The hero and the room each call set() whenever they sync, and
// acquire/release count them, so they cannot disagree about what the page looks like; the body is
// cleared when the last one lets go. A release followed at once by an acquire is a rebuild (Pause,
// the 1024 px breakpoint), not a teardown: it carries on without a flash of paper.
//
// Loaded only by the lazy controllers (it imports GSAP). Everything is undone by release().
import { gsap } from "gsap";
import { FADE_S, isNight, phoneVeil } from "./paletteMath";
import { paintBody, releaseBody, token } from "./roomStage";

export type Palette = {
  /** Which palette the page should have. A change fades over FADE_S; the same value only re-asserts it. */
  set(night: boolean): void;
  /** This caller is done. The last one to release leaves the body to its stylesheet. */
  release(): void;
};

/** A release and an acquire within this many ms are one rebuild. */
const REBUILD_MS = 100;

type Mix = (n: number) => string;

/** What the page shows: 0 paper … 1 night. Only the fade moves it between the two. */
const shown = { n: 0 };
let target: 0 | 1 = 0;
let tween: gsap.core.Tween | null = null;
let users = 0;
let phone = false;
let paper = "";
let nightColour = "";
let bgAt: Mix | null = null;
let fgAt: Mix | null = null;
let veil: HTMLDivElement | null = null;
let veilColour = "";
let veilOpacity = "";
let lastTarget: 0 | 1 = 0;
let lastAt = -Infinity;

function setVeil(colour: string, opacity: number) {
  if (!veil) {
    if (opacity === 0) return;
    veil = document.createElement("div");
    veil.setAttribute("aria-hidden", "true");
    veil.dataset.roomVeil = "";
    Object.assign(veil.style, {
      position: "fixed",
      inset: "0",
      zIndex: "-1",
      pointerEvents: "none",
      willChange: "opacity",
      contain: "strict",
    });
    document.body.prepend(veil);
  }
  const o = opacity.toFixed(3);
  if (colour !== veilColour) veil.style.backgroundColor = veilColour = colour;
  if (o !== veilOpacity) veil.style.opacity = veilOpacity = o;
}

/** Writes `shown` to the body (and, on phones, the veil). Writes only what changed. */
function paint() {
  if (!bgAt || !fgAt) return;
  const n = shown.n;
  if (!phone) {
    paintBody(bgAt(n), fgAt(isNight(n) ? 1 : 0));
    return;
  }
  const { night, opacity } = phoneVeil(n);
  paintBody(bgAt(night ? 1 : 0), fgAt(night ? 1 : 0));
  setVeil(night ? paper : nightColour, opacity);
}

function clear() {
  tween?.kill();
  tween = null;
  veil?.remove();
  veil = null;
  veilColour = veilOpacity = "";
  releaseBody();
  shown.n = target = 0;
  bgAt = fgAt = null;
}

/** `isPhone`: below 1024 px (veil blend); the hero pin is desktop only. */
export function acquirePalette(isPhone: boolean): Palette {
  if (users++ === 0) {
    paper = token("--paper");
    nightColour = token("--night");
    bgAt = gsap.utils.interpolate(paper, nightColour) as Mix;
    fgAt = gsap.utils.interpolate(token("--ink"), token("--moon")) as Mix;
    // A rebuild keeps the palette it had; a fade that was running is taken to its end.
    shown.n = target = performance.now() - lastAt < REBUILD_MS ? lastTarget : 0;
  }
  phone = isPhone;
  let live = true;
  return {
    set(night) {
      if (!live) return;
      const next = night ? 1 : 0;
      if (next === target) {
        // Someone else may have rewritten body (a revert, a refresh, the still controller's
        // release): put it back. paint() writes only what differs, and `shown` is mid-fade or at rest.
        paint();
        return;
      }
      target = next;
      tween?.kill();
      tween = gsap.to(shown, {
        n: next,
        duration: FADE_S,
        ease: "power1.inOut",
        overwrite: true,
        onUpdate: paint,
        onComplete: () => {
          tween = null;
          paint();
        },
      });
    },
    release() {
      if (!live) return;
      live = false;
      if (--users > 0) return;
      lastTarget = target;
      lastAt = performance.now();
      clear();
    },
  };
}
