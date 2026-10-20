// Opt-in gyroscope gaze (§4.4, "the first thing to cut"). LookAround asks for
// DeviceOrientationEvent permission inside its click handler (iOS requires the
// call to come from the gesture); this module only listens once enabled.
//
// The pupils behave like marbles: tilt the phone right and Ping looks right,
// tip its top edge away and she looks down. Tilt is read against a baseline
// that slowly follows the way the phone is held, so she reacts to movement and
// drifts back to looking at you when the phone is still.
import { angleTo, smoothstep } from "./math";

/** Baseline follow per reading (~1.5 s time constant at 60 Hz). */
const BASE_FOLLOW = 0.012;
/** Tilt (degrees) below which she looks straight ahead, and at which travel is full. */
const TILT_DEAD = 2;
const TILT_FULL = 14;

export type Gyro = {
  readonly enabled: boolean;
  /** A reading has arrived since enabling (some devices never send one). */
  readonly live: boolean;
  readonly aim: number | null;
  readonly weight: number;
  setEnabled(on: boolean): void;
  dispose(): void;
};

export function createGyro(): Gyro {
  let enabled = false;
  let live = false;
  let aim: number | null = null;
  let weight = 0;
  let base: { g: number; b: number } | null = null;

  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.gamma === null || e.beta === null) return;
    const g = e.gamma;
    const b = e.beta;
    if (!base) base = { g, b };
    base.g += (g - base.g) * BASE_FOLLOW;
    base.b += (b - base.b) * BASE_FOLLOW;
    // Device frame (portrait): +x = right, +y = down the screen.
    const px = g - base.g;
    const py = b - base.b;
    // Rotate into the current screen orientation.
    const rot = ((screen.orientation?.angle ?? 0) * Math.PI) / 180;
    const dx = px * Math.cos(rot) + py * Math.sin(rot);
    const dy = -px * Math.sin(rot) + py * Math.cos(rot);
    const mag = Math.hypot(dx, dy);
    live = true;
    weight = smoothstep(TILT_DEAD, TILT_FULL, mag);
    aim = mag < TILT_DEAD ? null : angleTo(0, 0, dx, dy);
  };

  const setEnabled = (on: boolean) => {
    if (on === enabled || typeof window === "undefined") return;
    enabled = on;
    if (on) {
      window.addEventListener("deviceorientation", onOrient, { passive: true });
    } else {
      window.removeEventListener("deviceorientation", onOrient);
      live = false;
      aim = null;
      weight = 0;
      base = null;
    }
  };

  return {
    get enabled() {
      return enabled;
    },
    get live() {
      return live;
    },
    get aim() {
      return aim;
    },
    get weight() {
      return weight;
    },
    setEnabled,
    dispose: () => setEnabled(false),
  };
}
