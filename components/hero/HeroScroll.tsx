"use client";

import { useLayoutEffect } from "react";
import { afterLoadIdle } from "@/lib/idle";
import { registerPingFigure } from "@/lib/stage";

type Controller = typeof import("./heroScrollMotion");

/** Kept once loaded, so a re-shown route (Activity) can rebuild the pin before paint. */
let controller: Controller | null = null;

/**
 * The hero's first-load island (renders nothing). It registers figure.ping for the Phase 5
 * hand-off and starts the scroll controller, which pulls in GSAP + ScrollTrigger and so is only
 * reached through import() after load + idle (never in first-load JS).
 *
 * A layout effect, because when Cache Components re-shows this route from <Activity mode="hidden">
 * the pin (and its 140vh of spacing) must exist again before Work restores the scroll position in
 * its own layout effect, which runs after this one. On first load the controller is still lazy.
 * Cleanup reverts everything (pin, tweens, body colours, listeners) and is safe to re-run.
 */
export function HeroScroll() {
  useLayoutEffect(() => {
    const section = document.getElementById("home");
    if (!section) return;
    const figure = section.querySelector<HTMLElement>("figure.ping");
    registerPingFigure(figure);

    // The entrance plays once per session (html:not([data-entered]), set pre-paint from
    // sessionStorage). Mark it done as soon as it ends or is cancelled, so neither a re-shown
    // route nor Play after Pause replays it.
    const entrance = [section, figure, section.querySelector(".ping-shadow")].flatMap((el) =>
      el ? el.getAnimations() : [],
    );
    const entered = () => document.documentElement.setAttribute("data-entered", "1");
    if (entrance.length) Promise.allSettled(entrance.map((a) => a.finished)).then(entered);
    else entered();

    let stop: (() => void) | undefined;
    let cancelled = false;
    let off = () => {};
    if (controller) {
      stop = controller.startHeroScroll(section);
    } else {
      off = afterLoadIdle(() => {
        import("./heroScrollMotion")
          .then((m) => {
            controller = m;
            if (!cancelled) stop = m.startHeroScroll(section);
          })
          .catch(() => {
            /* chunk failed to load: the hero stays static, which is a complete state */
          });
      });
    }

    return () => {
      cancelled = true;
      off();
      stop?.();
      registerPingFigure(null);
    };
  }, []);

  return null;
}
