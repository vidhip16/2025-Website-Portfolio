// Dot-stage geometry and timing (blueprint §5.2–§5.5), as pure functions so they run in Node
// (components/dots/unit/*.spec.ts) and are shared by the WebGL stage and the T0 halftones.
// No DOM, no three: every input is plain numbers.
//
// Coordinates are client CSS px, y down (the stage camera is (0, vw, 0, vh)). A shape is laid
// out in a `Rect` (centre + size) exactly as lib/dots/types.ts describes: point (x, y) of shape
// k lands at (cx + x·w, cy + y·h), with w / h = aspects[k] for an undistorted shape.

/** A shape's box on screen: centre and size, CSS px. */
export type Rect = { cx: number; cy: number; w: number; h: number };
/** What getBoundingClientRect returns (the parts we use). */
export type BoxLike = { left: number; top: number; width: number; height: number };

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);

/** Last shape index (K − 1): 0 ping-hero, 1 ping-seat, 2 braces, 3 db-net, 4 terminal, 5 envelope. */
export const LAST_SHAPE = 5;

// ── Timing ──────────────────────────────────────────────────────────────────

/** One 60 Hz tick, ms: the blueprint's per-tick rates are defined at this rate. */
export const TICK_MS = 1000 / 60;

/** Frame-rate independent lerp factor for a rate given "per 60 Hz tick". */
export function tickRate(perTick: number, dtMs: number): number {
  if (perTick >= 1) return 1;
  return 1 - Math.pow(1 - perTick, Math.max(0, dtMs) / TICK_MS);
}

// ── Cursor hole (§5.3) ──────────────────────────────────────────────────────

export const HOLE = { min: 70, max: 120, perVw: 0.0625, open: 0.35, close: 0.09 } as const;

/** R = clamp(70, .0625·vw, 120) px. */
export function holeRadius(vw: number): number {
  return clamp(HOLE.perVw * vw, HOLE.min, HOLE.max);
}

/** One tick of uHoleR toward `target`: opens at .35/tick, closes at .09/tick (four times slower). */
export function stepHole(current: number, target: number, dtMs: number): number {
  const rate = tickRate(target > current ? HOLE.open : HOLE.close, dtMs);
  const next = current + (target - current) * rate;
  return Math.abs(next - target) < 0.05 ? target : next;
}

// ── Touch ripple (§5.3) ─────────────────────────────────────────────────────

export const RIPPLE = { ms: 600, amp: 24, radius: 220 } as const;

/** Ripple ring at `ageMs` after the tap: radius grows to 220 px, amplitude 24 px fades out. */
export function rippleAt(ageMs: number): { radius: number; amp: number } | null {
  if (!(ageMs >= 0) || ageMs >= RIPPLE.ms) return null;
  const t = ageMs / RIPPLE.ms;
  const out = 1 - Math.pow(1 - t, 3); // ease-out ring
  return { radius: RIPPLE.radius * out, amp: RIPPLE.amp * (1 - t) };
}

// ── Hero release (§3.1, §5.3) ───────────────────────────────────────────────

/** Hero progress where the release starts; it ends at 1 (the dots settle into shape 1). */
export const RELEASE_FROM = 0.5;
/** z-index 2 (above the name) while hero progress is below this, else 0 (§5.2). */
export const RAISED_UNTIL = 0.6;

/** Release target 0..1 for a hero progress (0 until .5, then linear to 1 at p = 1). */
export function releaseTarget(heroProgress: number): number {
  return clamp01((heroProgress - RELEASE_FROM) / (1 - RELEASE_FROM));
}

/**
 * One tick of the smoothed release: an exponential approach (tau) that never moves faster than
 * `maxPerSec`. On desktop the hero scrub (scrub: 1) already smooths progress, so this barely lags;
 * on phones hero progress jumps 0 → 1 when Ping's top reaches the viewport top, and the cap turns
 * that jump into a ~1.1 s release instead of a one-frame teleport.
 */
export function stepRelease(current: number, target: number, dtMs: number, tauMs = 90, maxPerSec = 0.9): number {
  const dt = Math.max(0, dtMs);
  const eased = current + (target - current) * (1 - Math.exp(-dt / tauMs));
  const cap = (maxPerSec * dt) / 1000;
  const next = clamp(eased, current - cap, current + cap);
  return Math.abs(target - next) < 1e-4 ? target : next;
}

/** Hero progress as the renderer sees it: the release mapped back onto .5 → 1 once handed off. */
export function effectiveHeroProgress(handedOff: boolean, heroProgress: number, release: number): number {
  return handedOff ? RELEASE_FROM + (1 - RELEASE_FROM) * release : heroProgress;
}

/**
 * The shape the renderer draws. The renderer never writes `dots.shape`: the hero's release
 * (0 → 1, from hero progress) and the room/contact scrubs (`stage.dots.shape`, written by
 * workstream R) are composed here. While the release runs, any room progress past shape 1 is
 * added on top, so the value stays continuous whatever order the two arrive in.
 */
export function effectiveShape(release: number, stageShape: number): number {
  const s = Number.isFinite(stageShape) ? clamp(stageShape, 0, LAST_SHAPE) : 0;
  const r = clamp01(release);
  return clamp(r < 1 ? r + Math.max(0, s - 1) : Math.max(1, s), 0, LAST_SHAPE);
}

/** Disperse while handed off: 0 → 1 over the first half of the release, then held (sin(πk) settles it). */
export function effectiveDisperse(handedOff: boolean, release: number, stageDisperse: number): number {
  if (!handedOff) return 0;
  return clamp01(Math.max(release * 2, Number.isFinite(stageDisperse) ? stageDisperse : 0));
}

/** Per-particle morph progress (§5.2): smoothstep(r·.35, r·.35 + .65, f), then cubic in-out. */
export function particleProgress(f: number, delay: number): number {
  const lo = delay * 0.35;
  const t = clamp01((clamp01(f) - lo) / 0.65);
  const s = t * t * (3 - 2 * t);
  return s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
}

// ── Layout ──────────────────────────────────────────────────────────────────

/** Where the room shapes sit: a square region (centre + side), CSS px. */
export type Region = { cx: number; cy: number; side: number };

/** Desktop room: centred at 72vw / 50vh (§3.2), inside the right part of the viewport. */
export const ROOM = { x: 0.72, y: 0.5, maxVw: 0.4, maxVh: 0.66, maxPx: 600 } as const;
/** Phones: a band 42svh tall at the top (§3.2 Mobile). */
export const BAND = { vh: 0.42, fill: 0.86, maxVw: 0.82 } as const;
/** Ping's seated shape (ping-seat, scale .6) fills this much of the region's height. */
export const SEAT_FILL = 0.9;
/** The halftones draw each source fitted in 86% of the 640² frame (scripts/render_halftones.py). */
export const HALFTONE_FIT = 0.86;

/** The room region for a viewport. `anchor` ([data-dots-anchor="room"], if the room provides one) wins. */
export function roomRegion(vw: number, vh: number, mobile: boolean, anchor?: BoxLike | null): Region {
  if (anchor && anchor.width > 1 && anchor.height > 1) {
    return {
      cx: anchor.left + anchor.width / 2,
      cy: anchor.top + anchor.height / 2,
      side: Math.min(anchor.width, anchor.height),
    };
  }
  if (mobile) {
    const band = BAND.vh * vh;
    return { cx: vw / 2, cy: band / 2, side: Math.min(band * BAND.fill, vw * BAND.maxVw) };
  }
  return {
    cx: vw * ROOM.x,
    cy: vh * ROOM.y,
    side: Math.min(vw * ROOM.maxVw, vh * ROOM.maxVh, ROOM.maxPx),
  };
}

/** The contact region: the envelope sits over `[data-dots-anchor="contact"]`, a little larger (its mask is padded). */
export function contactRegion(anchor: BoxLike | null | undefined): Region | null {
  if (!anchor || anchor.width < 2 || anchor.height < 2) return null;
  return {
    cx: anchor.left + anchor.width / 2,
    cy: anchor.top + anchor.height / 2,
    side: Math.min(anchor.width, anchor.height) * 1.15,
  };
}

/**
 * Shape k's box in a region. The visible extent is box × scale (ping-seat .6 is baked into the
 * points), so Ping's box is sized for her seated height and icons fill the region's side.
 */
export function shapeRect(region: Region, aspect: number, scale: number, ping: boolean): Rect {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const s = scale > 0 && Number.isFinite(scale) ? scale : 1;
  const long = (region.side * (ping ? SEAT_FILL : 1)) / s;
  const w = a >= 1 ? long : long * a;
  const h = a >= 1 ? long / a : long;
  return { cx: region.cx, cy: region.cy, w, h };
}

/** A rect from a DOM box (the hand-off reads figure.ping's). */
export function rectOf(box: BoxLike): Rect {
  return { cx: box.left + box.width / 2, cy: box.top + box.height / 2, w: box.width, h: box.height };
}

/** The halftone frame (640² image) that lines up with a shape box: same centre, long side / .86. */
export function halftoneFrame(rect: Rect): { left: number; top: number; size: number } {
  const size = Math.max(rect.w, rect.h) / HALFTONE_FIT;
  return { left: rect.cx - size / 2, top: rect.cy - size / 2, size };
}

/** Point of a shape (centred box space) on screen. */
export function place(rect: Rect, x: number, y: number): [number, number] {
  return [rect.cx + x * rect.w, rect.cy + y * rect.h];
}

/** Hole zone: a shape's visible extent (box × scale) grown by R. */
export function inZone(rect: Rect, scale: number, x: number, y: number, grow: number): boolean {
  const hw = (rect.w * scale) / 2 + grow;
  const hh = (rect.h * scale) / 2 + grow;
  return Math.abs(x - rect.cx) <= hw && Math.abs(y - rect.cy) <= hh;
}

// ── Pupils (§5.1, §4.3) ─────────────────────────────────────────────────────

/** Dot pupils sit at anchor + 6 px × the look direction. */
export const PUPIL_PX = 6;
/** Scroll gaze (§4.3): sv = clamp(v / 12, −1, 1), active above .08, held 400 ms after scrolling stops. */
export const SCROLL_GAZE = { div: 12, min: 0.08, holdMs: 400 } as const;

/** Unit direction and weight from the eyes to a point: weight eases in over the first 40 px (a dead zone at the eyes). */
export function lookToward(from: [number, number], to: [number, number]): { x: number; y: number; w: number } {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const d = Math.hypot(dx, dy);
  if (d < 1e-3) return { x: 0, y: 0, w: 0 };
  const t = clamp01((d - 4) / 36);
  return { x: dx / d, y: dy / d, w: t * t * (3 - 2 * t) };
}

/** Screen-space angle in degrees [0, 360), 0 = right, 90 = down (lib/gaze convention). */
export function angleOf(x: number, y: number): number {
  return (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360;
}

// ── Governor (§5.5) ─────────────────────────────────────────────────────────

/**
 * p90 frame interval over 90 rendered frames; above 20 ms → drop a tier (never back up).
 * Intervals over `stallMs` (a tab switch, a GC pause, a resume after an off-screen pause) are
 * not frames the stage rendered late, so they are skipped.
 */
export class FrameGovernor {
  readonly frames: number;
  readonly limitMs: number;
  readonly percentile: number;
  readonly stallMs: number;
  /** Frames ignored after start, a resume or a tier swap (shader compile, texture upload). */
  readonly warmup: number;
  private readonly samples: Float64Array;
  private count = 0;
  private skip: number;

  constructor(frames = 90, limitMs = 20, percentile = 0.9, stallMs = 250, warmup = 30) {
    this.frames = frames;
    this.limitMs = limitMs;
    this.percentile = percentile;
    this.stallMs = stallMs;
    this.warmup = warmup;
    this.samples = new Float64Array(frames);
    this.skip = warmup;
  }

  /** Record one rendered frame's interval. True when a full window's p90 is over the limit (the window then restarts). */
  push(dtMs: number): boolean {
    if (!(dtMs > 0) || dtMs > this.stallMs) return false;
    if (this.skip > 0) {
      this.skip--;
      return false;
    }
    this.samples[this.count++] = dtMs;
    if (this.count < this.frames) return false;
    this.count = 0;
    return this.p90() > this.limitMs;
  }

  /** Start a fresh window after a warm-up (resume, tier swap). */
  reset(): void {
    this.count = 0;
    this.skip = this.warmup;
  }

  private p90(): number {
    const sorted = Array.from(this.samples).sort((a, b) => a - b);
    const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(this.percentile * sorted.length) - 1));
    return sorted[rank];
  }
}

// ── Per-shape point statistics (computed once per target set) ───────────────

const GRID = 40;

/**
 * Density rank 0..1 of every target point inside its own shape (§5.2 glow ramp "by density
 * rank"): body points are binned on a 40 × 40 grid over the box, and each point gets the
 * mid-rank of its cell's count among the shape's points. Pupils rank 1. The result is laid out
 * like the target texture (texel i = s·n + j), one float per texel, length width × height.
 */
export function densityRanks(
  data: Float32Array,
  n: number,
  k: number,
  pupilStart: number,
  texels: number,
): Float32Array<ArrayBuffer> {
  const out = new Float32Array(texels);
  const cellOf = new Int32Array(n);
  const counts = new Int32Array(GRID * GRID);
  for (let s = 0; s < k; s++) {
    counts.fill(0);
    const base = s * n;
    // Normalise by the shape's own extent (ping-seat spans ±.3), so every shape uses the whole grid.
    let ext = 1e-6;
    for (let j = 0; j < pupilStart; j++) {
      const o = (base + j) * 4;
      ext = Math.max(ext, Math.abs(data[o]), Math.abs(data[o + 1]));
    }
    for (let j = 0; j < pupilStart; j++) {
      const o = (base + j) * 4;
      const gx = Math.min(GRID - 1, Math.max(0, Math.floor((data[o] / ext / 2 + 0.5) * GRID)));
      const gy = Math.min(GRID - 1, Math.max(0, Math.floor((data[o + 1] / ext / 2 + 0.5) * GRID)));
      const c = gy * GRID + gx;
      cellOf[j] = c;
      counts[c]++;
    }
    // Histogram of per-point densities → cumulative mid-ranks.
    let max = 0;
    for (let c = 0; c < counts.length; c++) max = Math.max(max, counts[c]);
    const hist = new Float64Array(max + 1);
    for (let j = 0; j < pupilStart; j++) hist[counts[cellOf[j]]]++;
    const rankOf = new Float32Array(max + 1);
    let below = 0;
    for (let d = 0; d <= max; d++) {
      rankOf[d] = pupilStart > 0 ? (below + hist[d] / 2) / pupilStart : 0;
      below += hist[d];
    }
    for (let j = 0; j < pupilStart; j++) out[base + j] = rankOf[counts[cellOf[j]]];
    for (let j = pupilStart; j < n; j++) out[base + j] = 1;
  }
  return out;
}

/**
 * Fraction of shape s's box its body points occupy: the silhouette's area as a share of the box,
 * which sets the hand-off point size. The grid has ~4 points per filled cell (16..48 a side), so
 * a sparse tier doesn't leave holes that read as empty silhouette.
 */
export function occupancy(data: Float32Array, n: number, s: number, pupilStart: number, scale = 1): number {
  const G = Math.round(clamp(Math.sqrt(pupilStart / 4), 16, 48));
  const seen = new Uint8Array(G * G);
  let hit = 0;
  const base = s * n;
  for (let j = 0; j < pupilStart; j++) {
    const o = (base + j) * 4;
    const gx = Math.min(G - 1, Math.max(0, Math.floor((data[o] / scale + 0.5) * G)));
    const gy = Math.min(G - 1, Math.max(0, Math.floor((data[o + 1] / scale + 0.5) * G)));
    const c = gy * G + gx;
    if (!seen[c]) {
      seen[c] = 1;
      hit++;
    }
  }
  return hit / (G * G);
}

/**
 * Point size (CSS px) at which `count` random points over `occ × w × h` px² cover ~95% of it.
 * The soft round dot integrates to ≈ .53·S² of alpha, and random points cover
 * 1 − exp(−λ·.53·S²), so 95% needs S² ≈ 5.6 / λ. The hand-off frame draws shape 0 at this size so
 * it reads as the still itself (§5.3: "the first frame is a dot version of the still").
 */
export function coverSize(occ: number, w: number, h: number, count: number, min: number, max = 16): number {
  if (!(count > 0) || !(w > 0) || !(h > 0) || !(occ > 0)) return min;
  const lambda = count / (occ * w * h);
  return clamp(Math.sqrt(5.6 / lambda), min, max);
}
