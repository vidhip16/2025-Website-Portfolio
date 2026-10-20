"use client";

import { useEffect, useRef, type Ref } from "react";
import { stage } from "@/lib/stage";
import { getAnchor } from "./roomStage";
import s from "./room.module.css";

/** Where the tail tip sits on [data-dots-anchor="contact"] (fractions of its box): the envelope's top right. */
const CONTACT_TIP = { x: 0.6, y: 0.1 };

function Bubble({ ref }: { ref: Ref<HTMLSpanElement> }) {
  return (
    <span ref={ref} aria-hidden="true" data-show="false" className={`${s.bubble} font-mono`}>
      <span data-text="" />
      <svg viewBox="0 0 12 11" aria-hidden="true" focusable="false" className={s.tail}>
        {/* Open path: the fill closes along the top and covers the border; the stroke draws the steps. */}
        <path
          d="M0 0V11H3V8.5H6V5.5H9V2.5H12V0"
          strokeWidth={1.5}
          strokeLinejoin="miter"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}

/**
 * The fixed shape box [data-dots-anchor="room"] (the renderer lays shapes 1–4 in its rect) and the
 * Departure Mono bubble beside the shape (PHASE5: the renderer draws nothing for stage.bubble).
 *
 * Two bubbles, one shown at a time, for the anchor in use:
 *   room     inside the fixed box, placed by CSS (desktop: above the shape's top left; phones: in the
 *            band beside the shape)
 *   contact  in an absolute layer, placed beside [data-dots-anchor="contact"] when it is shown
 * It only touches the DOM when stage.bubble or the anchor changes (never per frame), shows under
 * reduced motion too (without the pop), and is aria-hidden: the chips carry the same words.
 */
export function DotBubble() {
  const roomRef = useRef<HTMLSpanElement>(null);
  const contactRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const rb = roomRef.current;
    const cb = contactRef.current;
    const layer = cb?.parentElement?.parentElement;
    const room = layer?.closest("section");
    if (!rb || !cb || !layer || !room) return;
    let contactShown = false;

    /** Put the contact bubble's tail on the envelope. False if the anchor isn't laid out (phones). */
    const placeContact = (): boolean => {
      const anchor = document.querySelector<HTMLElement>('[data-dots-anchor="contact"]');
      const a = anchor?.getBoundingClientRect();
      if (!a || a.width === 0) return false;
      const r = room.getBoundingClientRect();
      const spot = cb.parentElement as HTMLElement;
      spot.style.left = `${Math.round(a.left - r.left + a.width * CONTACT_TIP.x)}px`;
      spot.style.top = `${Math.round(a.top - r.top + a.height * CONTACT_TIP.y)}px`;
      return true;
    };

    const show = (el: HTMLElement, text: string | null) => {
      const on = text !== null;
      if (on) {
        const t = el.querySelector<HTMLElement>("[data-text]");
        if (t && t.textContent !== text) t.textContent = text;
      }
      if (el.dataset.show !== String(on)) el.dataset.show = String(on);
    };

    const apply = () => {
      const st = stage.get();
      const text = st.bubble;
      const at = text ? getAnchor(st) : null;
      contactShown = at === "contact" && placeContact();
      show(rb, at === "room" ? text : null);
      show(cb, contactShown ? text : null);
    };
    const onResize = () => {
      if (contactShown) placeContact();
    };

    apply();
    const off = stage.subscribe((next, prev) => {
      if (next.bubble !== prev.bubble || getAnchor(next) !== getAnchor(prev)) apply();
    });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      off();
      window.removeEventListener("resize", onResize);
      show(rb, null);
      show(cb, null);
    };
  }, []);

  return (
    <>
      <div data-dots-anchor="room" aria-hidden="true" className={s.anchor}>
        <span className={s.spot}>
          <Bubble ref={roomRef} />
        </span>
      </div>
      <div aria-hidden="true" className={s.contactLayer}>
        <span className={s.spot}>
          <Bubble ref={contactRef} />
        </span>
      </div>
    </>
  );
}
