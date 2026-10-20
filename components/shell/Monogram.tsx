import { MONOGRAM_EAR, MONOGRAM_LETTERS, MONOGRAM_VIEWBOX } from "./monogram-paths";

/**
 * The "vp" monogram: real Fraunces 800 outlines plus Ping's folded ear rising
 * from the p stem (scripts/make_monogram.py, blueprint §1.5).
 * Decorative only (`aria-hidden`): the wrapping link carries the accessible
 * name. Letters use `currentColor`; the ear is lilac with a currentColor
 * outline. Sized by font-size (height 1.5em).
 */
export function Monogram({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-monogram
      viewBox={MONOGRAM_VIEWBOX}
      className={`inline-block h-[1.5em] w-auto overflow-visible ${className}`}
    >
      <path d={MONOGRAM_LETTERS} fill="currentColor" />
      <path
        d={MONOGRAM_EAR}
        fill="var(--lilac)"
        stroke="currentColor"
        strokeWidth={70}
        strokeLinejoin="round"
        className="forced-colors:fill-[CanvasText]"
      />
    </svg>
  );
}
