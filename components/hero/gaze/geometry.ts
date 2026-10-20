// content/gaze.json (all % of the Ping box) → the two spaces the engine works in:
//  - strip space: natural pixels of the eyes strip (stripPx), where the renderer draws;
//  - box fractions: 0..1 of the figure rect, for aiming in client coordinates.
// The box keeps the 929×1520 aspect in CSS, so one uniform scale maps natural px
// to CSS px and the % → px conversions below stay exact.
import type { GazeData } from "@/lib/gaze";

/** The pupil clip is the dome ellipse shrunk by 2% (PHASE4 "Gaze renderer"). */
const CLIP_SHRINK = 0.98;

export type EyeGeo = {
  /** Dome centre, strip px. */
  cx: number;
  cy: number;
  /** Clip ellipse semi-axes (strip px) and rotation (radians, clockwise). */
  rx: number;
  ry: number;
  rot: number;
  /** Max pupil-centre travel from the dome centre, strip px. */
  tx: number;
  ty: number;
  /** Pupil sprite size, and its centre's offset from the dome centre, strip px. */
  pw: number;
  ph: number;
  ox: number;
  oy: number;
  /** Dome centre as fractions of the Ping box. */
  fx: number;
  fy: number;
};

export type Geometry = {
  /** Strip size in natural px (the strip images' own size). */
  sw: number;
  sh: number;
  eyes: [EyeGeo, EyeGeo];
  /** Midpoint between the eyes, fractions of the box. */
  midX: number;
  midY: number;
  /** Mean eye radius as a fraction of the box height. */
  eyeR: number;
};

export function buildGeometry(d: GazeData): Geometry {
  const { w: BW, h: BH } = d.box;
  const X = (pct: number) => (pct / 100) * BW;
  const Y = (pct: number) => (pct / 100) * BH;
  const sx = X(d.strip.x);
  const sy = Y(d.strip.y);
  const eye = (e: GazeData["eyes"][number]): EyeGeo => ({
    cx: X(e.c[0]) - sx,
    cy: Y(e.c[1]) - sy,
    // r = [a/2 as % of width, b/2 as % of height] (cv2.fitEllipse axes before rotation).
    rx: X(e.r[0]) * CLIP_SHRINK,
    ry: Y(e.r[1]) * CLIP_SHRINK,
    rot: (e.rot * Math.PI) / 180,
    tx: X(e.travel[0]),
    ty: Y(e.travel[1]),
    pw: X(e.pupil.w),
    ph: Y(e.pupil.h),
    ox: X(e.pupil.off[0]),
    oy: Y(e.pupil.off[1]),
    fx: e.c[0] / 100,
    fy: e.c[1] / 100,
  });
  return {
    sw: d.stripPx.w,
    sh: d.stripPx.h,
    eyes: [eye(d.eyes[0]), eye(d.eyes[1])],
    midX: d.eyeMid[0] / 100,
    midY: d.eyeMid[1] / 100,
    eyeR: d.eyeR,
  };
}

/**
 * Top-left of a pupil sprite in strip px for a gaze at `angleDeg` with travel
 * weight `w` (0 = centred). At w = 0 this is `c + pupil.off − size/2`, exactly
 * where the sprite was cut from the master, so the centred frame reproduces the
 * eyes baked into ping-body.png.
 */
export function pupilTopLeft(e: EyeGeo, angleDeg: number, w: number): [number, number] {
  const th = (angleDeg * Math.PI) / 180;
  return [e.cx + e.ox + e.tx * Math.cos(th) * w - e.pw / 2, e.cy + e.oy + e.ty * Math.sin(th) * w - e.ph / 2];
}
