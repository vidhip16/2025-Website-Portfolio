import Image from "next/image";
import { EYES, PEEK_VIEWBOX, pupilRadius, pupilTravel } from "./peekGeometry";
import styles from "./work.module.css";

/**
 * The peeking mascot art: 575×600 px with blank eye domes (no pupils), so the
 * code-drawn pupils below are her only pupils. Its geometry is in peekGeometry.ts.
 */
export const PEEK_ART_SRC = "/ping/ping-peek.webp";
const PEEK_ART = { width: 575, height: 600 } as const;

/** The art is 78% of a tile wide (see .peekArt in work.module.css). */
const PEEK_SIZES = "(min-width: 1600px) 12vw, (min-width: 1024px) 16vw, 36vw";

/** Ping's rendered eyes: plum pupil, one white highlight at its upper left (§1.1). */
const PLUM = "#23162E";

/**
 * The easter egg on one solid tile: the mascot peeking over the bottom edge,
 * with two SVG pupils that follow the cursor. The lazy motion controller
 * (mosaicMotion.ts) moves each `data-pupil` group (disc and highlight together)
 * up to its `data-travel`. Decorative: the tile is aria-hidden, and the image
 * has an empty alt.
 */
export function PeekPing() {
  return (
    <div className={styles.peek} data-peek>
      <div className={styles.peekArt}>
        <Image src={PEEK_ART_SRC} width={PEEK_ART.width} height={PEEK_ART.height} alt="" sizes={PEEK_SIZES} />
        <svg
          viewBox={`0 0 ${PEEK_VIEWBOX.w} ${PEEK_VIEWBOX.h}`}
          aria-hidden="true"
          focusable="false"
          className={styles.peekEyes}
        >
          {EYES.map((e) => {
            const pr = pupilRadius(e.r);
            return (
              <g
                key={e.cx}
                data-pupil=""
                data-cx={e.cx}
                data-cy={e.cy}
                data-travel={pupilTravel(e.r).toFixed(2)}
              >
                <circle cx={e.cx} cy={e.cy} r={pr} fill={PLUM} />
                <circle cx={e.cx - pr * 0.35} cy={e.cy - pr * 0.42} r={pr * 0.27} fill="#fff" />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
