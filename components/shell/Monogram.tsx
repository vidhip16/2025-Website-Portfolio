/**
 * The "vp" monogram.
 *
 * Placeholder: a Fraunces 800 wordmark. Phase 6 replaces the inside of this
 * component with the real SVG (Fraunces outlines plus Ping's folded ear,
 * blueprint §1.5). Keep the outer contract: decorative only (`aria-hidden`),
 * sized by font-size via `em`, coloured by `currentColor`, so the link that
 * wraps it carries the accessible name and the colour.
 */
export function Monogram({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-monogram
      className={`font-display font-extrabold leading-none tracking-[-0.04em] ${className}`}
    >
      vp
    </span>
  );
}
