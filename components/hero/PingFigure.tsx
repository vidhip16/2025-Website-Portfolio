import Image from "next/image";
import { mascot } from "@/content/site";
import type { GazeData } from "@/lib/gaze";
import { PingGaze } from "./PingGaze";
import s from "./hero.module.css";

/**
 * Ping's rendered width: 76svh × 929/1520 ≈ 46.4vh on desktop (capped at 550px), and
 * 52svh × 929/1520 ≈ 31.8vh below 1024px. Both copies of the still use the same `sizes`, so the
 * browser picks one candidate and the shadow reuses the preloaded bytes.
 */
const PING_SIZES = "(min-width: 1024px) 47vh, 32vh";

/**
 * Ping's cast shadow (z2) and the figure (z3). Server component: the boop button carries no
 * handler here; the lazy gaze engine (PingGaze) finds it with
 * `figure.querySelector("button.ping-boop")`. No figure inside a button (valid HTML): the button
 * is a transparent overlay inside the figure.
 */
export function PingFigure({ gaze }: { gaze: GazeData }) {
  const { body } = gaze.sprites;
  const { w, h } = gaze.box;
  return (
    <>
      <span className={`ping-shadow ${s.shadow}`} aria-hidden="true">
        {/* fetchPriority too: React's server renderer preloads the first eager <img> it meets, and
            that is this copy. Without the hint the shared preload goes out at Low priority and
            dedupes the body's high-priority one (same srcSet and sizes). */}
        <Image
          src={body}
          width={w}
          height={h}
          sizes={PING_SIZES}
          alt=""
          loading="eager"
          fetchPriority="high"
          draggable={false}
          className={s.shadowImg}
        />
      </span>
      <figure className={`ping ${s.ping}`}>
        <span className={`ping-squash ${s.squash}`}>
          {/* The LCP element and the no-JS state (centred eyes). `preload` is Next 16's name
              for the deprecated `priority`. */}
          <Image
            src={body}
            width={w}
            height={h}
            sizes={PING_SIZES}
            alt={mascot.alt}
            preload
            fetchPriority="high"
            draggable={false}
            className={s.body}
          />
          <PingGaze data={gaze} />
        </span>
        <button type="button" className={`ping-boop ${s.boop}`} aria-label={mascot.boopLabel} />
      </figure>
    </>
  );
}
