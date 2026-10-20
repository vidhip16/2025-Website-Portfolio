// Dot-stage target contract (blueprint §5.1, §5.5). Types and constants only, no
// runtime dependencies: shared by the sampler worker, the main-thread fallback
// (lib/dots/targets.ts) and the renderer (components/dots/*).
//
// Coordinate space of every target point and eye anchor ("centred box space"):
//   x, y   the shape's source box mapped to [-0.5, 0.5] PER AXIS (x across the box
//          width, y down the box height, y DOWN like CSS px and the stage camera),
//          then multiplied by the shape's manifest scale (ping-seat .6 → [-0.3, 0.3]).
//          To place shape k in a rect (cx, cy, w, h): px = cx + x·w, py = cy + y·h;
//          keep w / h = aspects[k] for an undistorted shape.
//   z      depth / DEPTH_PX, in [-0.5, 0.5] (z_px = z × 44, so ±22 px).
//   w      colour index: COLOR.body 0, COLOR.highlight 1, COLOR.pupil 2.

import type { Tier } from "../quality";

/** Shape order = texture slot k (lib/stage.ts `dots.shape`). Mirrors public/dots/shapes.json. */
export const SHAPE_ORDER = ["ping-hero", "ping-seat", "braces", "db-net", "terminal", "envelope"] as const;
export type ShapeName = (typeof SHAPE_ORDER)[number];
/** K: shapes packed into one texture. */
export const SHAPE_COUNT = SHAPE_ORDER.length;

/** mulberry32 seed for every sampling run. */
export const SEED = 1729;
/** Texture width in texels; height = ceil(n·k / TEX_WIDTH). */
export const TEX_WIDTH = 1024;
/** Pupil points per eye, the last 2 × 120 points of every shape. */
export const PUPILS_PER_EYE = 120;
/** Pupil points per shape (2 eyes). Shape-local indices [n − 240, n) are pupils. */
export const PUPIL_POINTS = 2 * PUPILS_PER_EYE;
/** z is stored as z_px / DEPTH_PX: (luma − .5) × 40 px ± 2 px jitter → ±22 px → ±0.5. */
export const DEPTH_PX = 44;
/** Colour index stored in the texture's w (alpha) channel. */
export const COLOR = { body: 0, highlight: 1, pupil: 2 } as const;
export type ColorIndex = (typeof COLOR)[keyof typeof COLOR];
/** Points per shape by tier (§5.5). T0 is the static halftone and has no targets. */
export const TIER_POINTS = { T2: 12000, T1: 4000 } as const;
/** Upper bound for n (the angle sort keeps point indices in 16 bits). */
export const MAX_POINTS = 32768;

/** The two point tiers that have targets. */
export type PointTier = Exclude<Tier, "T0">;
export type Vec2 = [number, number];
/** [left eye, right eye] as they appear on screen. */
export type EyePair = [Vec2, Vec2];

/** Decoded RGBA pixels, ImageData-compatible (non-premultiplied, row-major). */
export type Mask = {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
  /** Natural width / height of the source image (defaults to width / height). */
  aspect?: number;
};

/** One shape to sample, resolved from public/dots/shapes.json (+ content/gaze.json for Ping). */
export type ShapeSource = {
  name: string;
  /** Image URL (root-relative in the manifest; made absolute before it reaches the worker). */
  url: string;
  /** Long side, in px, to draw the image at before sampling (Ping 600, icon masks 512). */
  size: number;
  /** Brightness-weighted rejection sampling + luma highlights (Ping); plain alpha mask otherwise. */
  weighted: boolean;
  /** Uniform scale about the box centre, baked into x/y (ping-seat .6). */
  scale: number;
  /** Eye anchors, 0..1 of the source box (y down), as in the manifest. */
  eyes: EyePair;
};

/** What the renderer consumes: one packed float texture of every shape's targets. */
export type DotTargets = {
  tier: PointTier;
  /** N: points per shape. */
  n: number;
  /** K: shapes. */
  k: number;
  /** Texture width (TEX_WIDTH). */
  width: number;
  /** Texture height: ceil(n·k / width). */
  height: number;
  /**
   * RGBA float texels, length width × height × 4. Point j of shape s is texel
   * i = s·n + j at (i % width, floor(i / width)); texels past n·k are zero.
   * Body points [0, n − 240) are angle-sorted around the shape's centroid;
   * pupils follow: eye 0 at [n − 240, n − 120), eye 1 at [n − 120, n).
   */
  data: Float32Array<ArrayBuffer>;
  /** Shape names, index = slot k. */
  names: string[];
  /** Per shape eye anchors in centred box space (same space as the points, scale applied). */
  eyes: EyePair[];
  /** Per shape box aspect ratio (natural width / height of the source image). */
  aspects: number[];
  /** Per shape scale already baked into x/y (1 except ping-seat .6). */
  scales: number[];
  /** n − PUPIL_POINTS: the first pupil index inside each shape. */
  pupilStart: number;
};

/** Main thread → worker. */
export type ShapesRequest = { id: number; n: number; seed: number; sources: ShapeSource[] };
/** Worker → main thread (`data` is transferred). */
export type ShapesResponse =
  | ({ id: number; ok: true } & DotTargets)
  | { id: number; ok: false; error: string };
