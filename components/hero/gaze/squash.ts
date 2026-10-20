// Ping's squash on span.ping-squash (transform-origin bottom centre).
//
// Two sources multiply into one CSS `scale` (the individual transform
// property, so it composes with any `transform` the hero sets on the same
// element and never fights the pin's scale tween on figure.ping):
//  - scroll (§4.3): gsap.quickTo toward scaleY .97 / scaleX 1.02 at full
//    speed, springing back over 450 ms (back.out gives the small overshoot);
//  - boop (§4.2): scaleY .96 / scaleX 1.03, elastic.out(1, .4) over 500 ms.
// The tweens animate plain proxies; apply() writes the product once per tick,
// and only when it changed, so the two never overwrite each other.
import { gsap } from "gsap";

const SCROLL = { sy: 0.97, sx: 1.02, duration: 0.45, ease: "back.out(1.6)" } as const;
const BOOP = { sy: 0.96, sx: 1.03, duration: 0.5, ease: "elastic.out(1,0.4)" } as const;

export type Squash = {
  /** Scroll squash amount, 0 (rest) .. 1 (full speed). */
  scroll(amount: number): void;
  boop(): void;
  /** Back to rest at once (motion turned off). */
  reset(): void;
  /** Write the combined scale to the element if it changed; returns scaleY. */
  apply(): number;
  dispose(): void;
};

export function createSquash(el: HTMLElement | null): Squash {
  const scrollV = { sx: 1, sy: 1 };
  const boopV = { sx: 1, sy: 1 };
  const toSX = gsap.quickTo(scrollV, "sx", { duration: SCROLL.duration, ease: SCROLL.ease });
  const toSY = gsap.quickTo(scrollV, "sy", { duration: SCROLL.duration, ease: SCROLL.ease });
  let boopTween: gsap.core.Tween | null = null;
  let amount = 0;
  let written = "";
  const prevOrigin = el?.style.transformOrigin ?? "";
  if (el) el.style.transformOrigin = "50% 100%";

  const write = (sx: number, sy: number) => {
    const next = Math.abs(sx - 1) < 5e-5 && Math.abs(sy - 1) < 5e-5 ? "" : `${sx.toFixed(4)} ${sy.toFixed(4)}`;
    if (next === written) return;
    written = next;
    if (el) el.style.scale = next;
  };

  return {
    scroll(a) {
      const next = Math.min(Math.max(a, 0), 1);
      if (Math.abs(next - amount) < 0.002 && !(next === 0 && amount !== 0)) return;
      amount = next;
      toSX(1 + (SCROLL.sx - 1) * next);
      toSY(1 + (SCROLL.sy - 1) * next);
    },
    boop() {
      boopTween?.kill();
      boopV.sx = BOOP.sx;
      boopV.sy = BOOP.sy;
      boopTween = gsap.to(boopV, { sx: 1, sy: 1, duration: BOOP.duration, ease: BOOP.ease });
    },
    reset() {
      boopTween?.kill();
      boopTween = null;
      amount = 0;
      scrollV.sx = scrollV.sy = boopV.sx = boopV.sy = 1;
      toSX(1, 1);
      toSY(1, 1);
      write(1, 1);
    },
    apply() {
      const sy = scrollV.sy * boopV.sy;
      write(scrollV.sx * boopV.sx, sy);
      return sy;
    },
    dispose() {
      boopTween?.kill();
      toSX.tween.kill();
      toSY.tween.kill();
      written = "";
      if (el) {
        el.style.scale = "";
        el.style.transformOrigin = prevOrigin;
      }
    },
  };
}
