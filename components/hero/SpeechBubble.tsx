import type { Ref } from "react";

/**
 * Ping's speech bubble ("pong!" after a boop), drawn as a soft outlined bubble
 * with a stepped pixel tail that matches Departure Mono. It sits above Ping's
 * right ear (positions are % of the Ping box) with the tail pointing at the gap
 * between her ears, and squashes with her because it lives in span.ping-squash.
 *
 * PingGaze drives it without re-rendering: `data-show="true|false"` toggles it
 * and `data-armed` (set after `load`) un-hides the text, so Departure Mono is
 * only fetched after the page has loaded, never on the LCP path. The live
 * region beside it carries the line for screen readers (the bubble itself is
 * decorative); it deliberately has no role="status", which the contact form
 * owns in the QA selector contract.
 */
export function SpeechBubble({
  text,
  ref,
  liveRef,
}: {
  text: string;
  ref?: Ref<HTMLSpanElement>;
  liveRef?: Ref<HTMLSpanElement>;
}) {
  return (
    <>
      <span
        ref={ref}
        aria-hidden="true"
        data-show="false"
        className={[
          "pointer-events-none absolute bottom-[87%] left-1/2 z-[1] hidden origin-bottom-left data-armed:flex",
          "items-center whitespace-nowrap rounded-[0.85em] border-[1.5px] border-ink bg-glow px-[0.75em] pb-[0.4em] pt-[0.45em]",
          "font-mono text-[clamp(0.95rem,2.1svh,1.3rem)] leading-none text-ink",
          "shadow-[0_0.5em_1.1em_-0.55em_rgb(35_22_46/0.45)]",
          // Out: quick fade. In: a small pop from the tail (back-out overshoot).
          "translate-y-[0.25em] scale-[0.6] opacity-0 transition-[opacity,scale,translate] duration-150 ease-in",
          "data-[show=true]:translate-y-0 data-[show=true]:scale-100 data-[show=true]:opacity-100",
          "data-[show=true]:duration-[260ms] data-[show=true]:ease-[cubic-bezier(.34,1.56,.64,1)]",
          "[html[data-motion=off]_&]:transition-none",
          "forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText] forced-colors:shadow-none",
        ].join(" ")}
      >
        {text}
        <svg
          viewBox="0 0 12 11"
          aria-hidden="true"
          focusable="false"
          className="absolute left-[0.9em] top-[calc(100%-1.5px)] h-[0.68em] w-[0.75em] overflow-visible"
        >
          {/* Open path: the fill closes along the top and covers the bubble's border; the stroke draws the steps. */}
          <path
            d="M0 0V11H3V8.5H6V5.5H9V2.5H12V0"
            className="fill-glow stroke-ink forced-colors:fill-[Canvas] forced-colors:stroke-[CanvasText]"
            strokeWidth={1.5}
            strokeLinejoin="miter"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
      <span ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only-soft" />
    </>
  );
}
