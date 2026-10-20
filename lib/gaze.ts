// Type-only contract for the hero gaze system (blueprint §4).
// Implementation: components/hero/PingGaze.tsx renders the procedural gaze
// (DECISIONS 21) behind `GazeRenderer`, so callers never care how eyes are drawn.

/** One eye in content/gaze.json (procedural mode). All lengths in % of the Ping box. */
export type GazeEye = {
  /** dome centre [x% of box width, y% of box height] */
  c: [number, number];
  /** dome semi-axes [% of box width, % of box height] */
  r: [number, number];
  /** dome ellipse rotation in degrees (from cv2.fitEllipse) */
  rot: number;
  /** max pupil-centre offset from the dome centre [% of width, % of height] */
  travel: [number, number];
  /** rendered pupil sprite size and its centre offset from the dome centre */
  pupil: { w: number; h: number; off: [number, number] };
};

/**
 * content/gaze.json. The atlas route failed calibration (DECISIONS 21), so v2 is
 * procedural: a blank-dome strip over the body still, with the master's real
 * pupil sprites moved inside each dome. 0° = right, angles increase clockwise
 * (screen space, y down), matching atan2(dy, dx).
 */
export type GazeData = {
  v: 2;
  mode: "procedural";
  stepDeg: 5;
  dir: "cw";
  /** natural pixel size of /ping/ping-body.png */
  box: { w: number; h: number };
  /** overlay strip rect (eyes-blank / blink / happy share it), % of the box */
  strip: { x: number; y: number; w: number; h: number };
  /** natural pixel size of the strip images */
  stripPx: { w: number; h: number };
  /** midpoint between the eyes, % of the box */
  eyeMid: [number, number];
  /** mean eye radius as a fraction of the box height (dead zone = 0.6 × this) */
  eyeR: number;
  /** mean pupil travel [ax, ay] as fractions of the box height */
  ellipse: [number, number];
  eyes: [GazeEye, GazeEye];
  sprites: {
    body: string;
    blank: string;
    pupilL: string;
    pupilR: string;
    blink: string;
    happy: string;
  };
};

/** What is driving the aim this tick. */
export type GazeSource = "pointer" | "scroll" | "idle" | "chip" | "gyro" | "dizzy" | "none";

/**
 * Aim: an angle in degrees [0, 360) in screen space (0 = right, 90 = down),
 * or null for "centre" (looking at the visitor).
 */
export type GazeAim = number | null;

export interface GazeRenderer {
  /**
   * Draw a gaze: pupils at `angleDeg`, pushed out by `circleWeight` (0 = centred,
   * looking at the visitor; 1 = full travel toward the angle).
   */
  draw(angleDeg: number, circleWeight: number): void;
  /** Show the blink strip for `ms`. */
  blink(ms: number): void;
  /** Show the happy strip for `ms`. */
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
