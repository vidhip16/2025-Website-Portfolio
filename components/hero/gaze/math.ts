// Pure maths for the gaze engine. No DOM, no GSAP: safe to unit-test in Node.
// Angles are degrees in screen space: 0° = right, increasing clockwise (y down),
// always kept in [0, 360). Same convention as lib/gaze.ts and the QA helpers.

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Hermite smoothstep: 0 at `e0`, 1 at `e1`. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Any angle → [0, 360). */
export const wrap360 = (deg: number): number => ((deg % 360) + 360) % 360;

/** Signed shortest arc from `from` to `to`, in (-180, 180]. */
export function shortestArc(from: number, to: number): number {
  const d = wrap360(to - from);
  return d > 180 ? d - 360 : d;
}

/** Screen-space angle from (ax, ay) to (bx, by): `(atan2(dy, dx)·180/π + 360) % 360`. */
export const angleTo = (ax: number, ay: number, bx: number, by: number): number =>
  wrap360((Math.atan2(by - ay, bx - ax) * 180) / Math.PI);

/**
 * Frame-rate independent form of a per-tick lerp factor defined at 60 fps:
 * `k60` per 16.67 ms, whatever the real frame time `dtMs` is.
 */
export const lerpFactor = (k60: number, dtMs: number): number => 1 - Math.pow(1 - k60, dtMs / (1000 / 60));

/** Exponential ease toward a target with time constant `tauMs` (≈95% after 3τ). */
export const easeFactor = (tauMs: number, dtMs: number): number => 1 - Math.exp(-dtMs / tauMs);

/** Move angle `cur` toward `target` along the shortest arc by factor `k` (0..1). */
export const lerpAngle = (cur: number, target: number, k: number): number =>
  wrap360(cur + shortestArc(cur, target) * k);

/** QA probe cell: round(aim/5) % 72, or -1 for centre. */
export const cellOf = (aim: number | null): number => (aim === null ? -1 : Math.round(aim / 5) % 72);

/** Uniform random in [lo, hi). */
export const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

/** easeInOutSine, for the dizzy laps. */
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2;

/** One eye's drawn state: direction, and travel weight (0 = centred, 1 = full travel). */
export type Pose = { angle: number; weight: number };

/** Below this weight the pupil is effectively centred: re-aim at once instead of travelling. */
export const SNAP_BELOW = 0.02;
/** Swings wider than this cut straight across the eye instead of rolling round the rim. */
export const SWING_DEG = 100;

/**
 * Advance a pose one tick toward (angle, weight). `angle` null = look at the
 * visitor (keep the direction, ease the travel to `weight`, normally 0).
 * - Normal moves: angle lerps by `kAngle` along the shortest arc, weight eases by `kWeight`.
 * - Swings over SWING_DEG: the pupil offset (weight·cosθ, weight·sinθ) lerps as a vector
 *   by `kAngle`, so a 180° change crosses the eye in a straight line (a glance, not an
 *   eye-roll) and hands back to the arc lerp once the remaining turn is ≤ SWING_DEG.
 * - `snap` (reduced motion, dizzy laps): jump straight to the target angle.
 */
export function stepPose(p: Pose, angle: number | null, weight: number, kAngle: number, kWeight: number, snap: boolean): void {
  if (angle !== null) {
    if (snap || p.weight < SNAP_BELOW) {
      p.angle = angle;
    } else {
      const arc = shortestArc(p.angle, angle);
      if (Math.abs(arc) > SWING_DEG) {
        const a = (p.angle * Math.PI) / 180;
        const b = (angle * Math.PI) / 180;
        const x = p.weight * Math.cos(a) + (weight * Math.cos(b) - p.weight * Math.cos(a)) * kAngle;
        const y = p.weight * Math.sin(a) + (weight * Math.sin(b) - p.weight * Math.sin(a)) * kAngle;
        p.weight = Math.hypot(x, y);
        if (p.weight > 1e-6) p.angle = angleTo(0, 0, x, y);
        return;
      }
      p.angle = wrap360(p.angle + arc * kAngle);
    }
  }
  p.weight += (weight - p.weight) * kWeight;
  if (Math.abs(weight - p.weight) < 1e-4) p.weight = weight;
}
