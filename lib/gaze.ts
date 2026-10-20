// Type-only contract for the hero gaze system (blueprint §4).
// Implementations: components/hero/PingGaze.tsx (atlas) and the procedural
// SVG-pupil fallback. Both sit behind `GazeRenderer`, so nothing else changes.

/** content/gaze.json */
export type GazeData = {
  v: 1;
  stepDeg: 5;
  /** 72 atlas cell indices, one per 5° bin (0° = right, clockwise, screen coords). */
  lut: number[];
  center: number;
  blink: number;
  happy: number;
  /** atlas grid [cols, rows]; cell size = bitmap size / grid at runtime */
  grid: [number, number];
  /** eye strip rect, in % of the Ping box */
  strip: { x: number; y: number; w: number; h: number };
  /** midpoint between the eyes, in % of the Ping box */
  eyeMid: [number, number];
  /** eye radius as a fraction of the Ping box height */
  eyeR: number;
  /** pupil travel ellipse [ax, ay] (procedural fallback only), fraction of box height */
  ellipse: [number, number];
  dir: "cw";
};

/** What is driving the aim this tick. */
export type GazeSource = "pointer" | "scroll" | "idle" | "chip" | "gyro" | "dizzy" | "none";

/**
 * Aim: an angle in degrees [0, 360) in screen space (0 = right, 90 = down),
 * or null for "centre" (looking at the visitor).
 */
export type GazeAim = number | null;

export interface GazeRenderer {
  /** Draw a gaze; `circleWeight` 0..1 crossfades centre → circle cell. */
  draw(angleDeg: number, circleWeight: number): void;
  /** Show the blink cell for `ms`. */
  blink(ms: number): void;
  /** Show the happy cell for `ms`. */
  happy(ms: number): void;
  resize(): void;
  dispose(): void;
}

/** QA probe exposed as window.__gaze when NEXT_PUBLIC_QA=1. */
export type GazeProbe = {
  aim: GazeAim;
  cell: number;
  scaleY: number;
  source: GazeSource;
};

/** QA probe exposed as window.__dots when NEXT_PUBLIC_QA=1. */
export type DotsProbe = {
  shape: number;
  holeR: number;
  /** pupil direction in degrees (screen space) */
  pupilDir: number;
  tier: "T0" | "T1" | "T2";
};

/** Frame-time probe exposed as window.__perf when NEXT_PUBLIC_QA=1. */
export type PerfProbe = {
  frames: number[];
  reset(): void;
};

declare global {
  interface Window {
    __gaze?: GazeProbe;
    __dots?: DotsProbe;
    __perf?: PerfProbe;
  }
}
