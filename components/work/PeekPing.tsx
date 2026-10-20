import { EYE_R, EYES, PEEK_VIEWBOX, PUPIL_R } from "./peekGeometry";
import styles from "./work.module.css";

/**
 * Mascot art for the peeking tile. null = the neutral lilac placeholder head
 * drawn below. When the mascot art exists, set this to its public path (a
 * head cut-out at 200:150, bottom edge flush) and the code-drawn eyes keep
 * working on top of it (move EYES in peekGeometry.ts to match the art).
 * TODO(lead): swap in the mascot art after CP1 / H7.
 */
export const PEEK_ART_SRC: string | null = null;

/**
 * The easter egg on one solid tile: the mascot peeking over the bottom edge,
 * with two SVG pupil discs that follow the cursor. The lazy motion controller
 * (mosaicMotion.ts) moves the pupils through `data-pupil`.
 */
export function PeekPing() {
  return (
    <div className={styles.peek} data-peek>
      <svg
        viewBox={`0 0 ${PEEK_VIEWBOX.w} ${PEEK_VIEWBOX.h}`}
        width={PEEK_VIEWBOX.w}
        height={PEEK_VIEWBOX.h}
        aria-hidden="true"
        focusable="false"
      >
        {PEEK_ART_SRC ? (
          <image href={PEEK_ART_SRC} width={PEEK_VIEWBOX.w} height={PEEK_VIEWBOX.h} />
        ) : (
          <>
            <path d="M14 150 C14 66 54 22 100 22 C146 22 186 66 186 150 Z" fill="var(--lilac)" />
            <ellipse cx="52" cy="116" rx="13" ry="8" fill="var(--bubblegum)" opacity="0.55" />
            <ellipse cx="148" cy="116" rx="13" ry="8" fill="var(--bubblegum)" opacity="0.55" />
          </>
        )}
        {EYES.map((e) => (
          <g key={e.cx}>
            <circle cx={e.cx} cy={e.cy} r={EYE_R} fill="#fff" />
            <circle data-pupil data-cx={e.cx} data-cy={e.cy} cx={e.cx} cy={e.cy} r={PUPIL_R} fill="var(--ink)" />
            {/* One fixed highlight, upper left (§1.1). */}
            <circle cx={e.cx - 7} cy={e.cy - 8} r="3.5" fill="#fff" opacity="0.9" />
          </g>
        ))}
      </svg>
    </div>
  );
}
