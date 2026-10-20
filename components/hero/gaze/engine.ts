// The gaze engine (PHASE4 "Gaze loop", blueprint §4.2–§4.5). PingGaze loads it
// with import() after `load` (desktop) or load + idle (touch), so GSAP, the
// ticker and lib/scroll never reach first-load JS.
//
// One addTick loop. Input handlers only write state; the tick resolves one aim
// per frame, in priority order:
//   dizzy (hard flick) → scroll (+400 ms settle) → finger (touch, +1.2 s after
//   release) → gyroscope (opt-in) → pointer (until 4 s idle) → idle glances
//   (touch) → centre.
// Each eye aims from its own dome centre (mild convergence); both share one
// travel weight from the distance to the eye midpoint: centred inside
// 0.6 × eyeR, else smoothstep(0.6, 2.0, d / eyeR). For every source, angles
// lerp 0.18 per 60 Hz tick along the shortest arc, the weight eases over
// ~180 ms, and the canvas redraws only when a pupil moves.
// Reduced motion / Pause (lib/motion, live): the gaze still follows the pointer
// and the scroll but snaps; no blinks, squash, idle glances or dizzy.
import { getMotionPrefs, subscribeMotion } from "@/lib/motion";
import { getScrollVelocity } from "@/lib/scroll";
import { stage } from "@/lib/stage";
import { addTick } from "@/lib/ticker";
import type { GazeAim, GazeData, GazeProbe, GazeSource } from "@/lib/gaze";
import { buildGeometry } from "./geometry";
import { createGyro } from "./gyro";
import {
  angleTo,
  cellOf,
  clamp,
  easeFactor,
  easeInOutSine,
  lerpFactor,
  rand,
  smoothstep,
  stepPose,
  wrap360,
  type Pose,
} from "./math";
import { CanvasGazeRenderer } from "./renderer";
import { createSquash } from "./squash";
import { loadCore, loadOptional, releaseSprite } from "./sprites";

const QA = process.env.NEXT_PUBLIC_QA === "1";

// Pointer
const IDLE_MS = 4000;
const DEAD_ZONE = 0.6; // × eyeR_px: inside it the pupils centre
const FULL_AT = 2.0; // × eyeR_px: full travel from here out
const RECT_MAX_AGE = 500;
// Easing
const ANGLE_LERP = 0.18; // per 60 Hz tick, shortest arc
const WEIGHT_TAU = 60; // ms: ~180 ms to 95%
// Scroll (§4.3)
const SCROLL_DIV = 12;
const SCROLL_MIN = 0.08;
const SCROLL_SETTLE_MS = 400;
const DIZZY_V = 30;
const DIZZY_REARM_V = 20;
const DIZZY_MS = 700;
const DIZZY_LAPS = 2;
const DIZZY_COOLDOWN_MS = 1500;
// Expressions
const BLINK_MS = 110;
const BLINK_EVERY: [number, number] = [4000, 7000];
const HAPPY_MS = 600;
const HELLO_DELAY_MS = 280;
const HELLO_KEY = "vp:ping-hello";
// Touch (§4.4)
const GLANCE_EVERY: [number, number] = [1500, 3000];
const GLANCE_WEIGHT: [number, number] = [0.7, 1];
/** Turn between two held glances, in degrees: a look aside, never a roll round the rim. */
const GLANCE_TURN: [number, number] = [45, 120];
const RELEASE_MS = 1200;

const TOUCH_MQ = "(hover: none)";

/**
 * The "hello" blink belongs to the once-per-session entrance (PHASE4 Hero
 * scroll), not to every engine start: an <Activity> hide/show or any remount
 * restarts the engine and decodes the sprites again. The flag lives in
 * sessionStorage, so a reload in the same session stays quiet like the
 * entrance does. It is also kept in this module, which outlives the engine,
 * for when storage is blocked. Returns true once; the caller plays the blink.
 */
let helloClaimed = false;
function claimHello(): boolean {
  if (helloClaimed) return false;
  helloClaimed = true;
  try {
    if (window.sessionStorage.getItem(HELLO_KEY)) return false;
    window.sessionStorage.setItem(HELLO_KEY, "1");
  } catch {
    /* storage blocked: once per page load */
  }
  return true;
}

export type GazeHandle = {
  /** Boop: happy face for 600 ms + squash (the bubble is PingGaze's). */
  boop(): void;
  /** Gyroscope on/off (permission is already granted by LookAround). */
  setGyro(on: boolean): void;
  dispose(): void;
};

type Target = {
  source: GazeSource;
  /** Mid-angle for the probe, or null for centre. */
  aim: GazeAim;
  /** Per-eye angle (null = keep the current angle) and travel weight. */
  angle: [number | null, number | null];
  weight: [number, number];
  /** Skip the lerp (dizzy laps are the motion themselves). */
  snap: boolean;
};

const centre = (source: GazeSource): Target => ({
  source,
  aim: null,
  angle: [null, null],
  weight: [0, 0],
  snap: false,
});

const toward = (source: GazeSource, aim: number, weight: number, snap = false): Target => ({
  source,
  aim,
  angle: [aim, aim],
  weight: [weight, weight],
  snap,
});

export function startGaze(canvas: HTMLCanvasElement, data: GazeData): GazeHandle {
  const geo = buildGeometry(data);
  const figure = canvas.closest<HTMLElement>("figure.ping") ?? canvas.parentElement ?? canvas;
  const squashEl = canvas.closest<HTMLElement>(".ping-squash");
  const hero = figure.closest<HTMLElement>("#home") ?? document.getElementById("home");
  const touchMq = window.matchMedia(TOUCH_MQ);

  const renderer = new CanvasGazeRenderer(canvas, geo);
  const squash = createSquash(squashEl);
  const gyro = createGyro();
  const ac = new AbortController();
  const { signal } = ac;
  let disposed = false;

  // ── State written by events ───────────────────────────────────────────────
  let ok = getMotionPrefs().ok;
  let isTouch = touchMq.matches;
  let heroVisible = true;
  let roomVisible = stage.get().roomInView;
  const mouse = { x: 0, y: 0, at: -Infinity, seen: false };
  const finger = { x: 0, y: 0, down: false, releasedAt: -Infinity };
  let rect: DOMRect | null = null;
  let rectAt = -Infinity;
  let rectDirty = true;

  // ── State owned by the tick ───────────────────────────────────────────────
  const pose: [Pose, Pose] = [
    { angle: 0, weight: 0 },
    { angle: 0, weight: 0 },
  ];
  let lastScrollAt = -Infinity;
  let scrollAim = 90;
  let dizzy: { t0: number; from: number; dir: 1 | -1 } | null = null;
  let dizzyArmed = true;
  let dizzyCooldownUntil = 0;
  let nextBlinkAt = Infinity;
  let helloAt = 0;
  const glance = { aim: null as number | null, weight: 0, next: performance.now() + rand(...GLANCE_EVERY), count: 0 };
  let everDriven = false;

  const probe: GazeProbe = { aim: null, cell: -1, scaleY: 1, source: "none" };
  if (QA) window.__gaze = probe;

  /** QA probe write. The aim is rounded to 0.1° and kept in [0, 360), so 359.97 → 0, not 360. */
  const writeProbe = (aim: GazeAim, scaleY: number, source: GazeSource) => {
    probe.aim = aim === null ? null : wrap360(Math.round(aim * 10) / 10);
    probe.cell = cellOf(probe.aim);
    probe.scaleY = Math.round(scaleY * 10000) / 10000;
    probe.source = source;
  };

  const scheduleBlink = (now: number) => {
    nextBlinkAt = now + rand(...BLINK_EVERY);
  };

  // ── Inputs ────────────────────────────────────────────────────────────────
  const markRect = () => {
    rectDirty = true;
  };
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") {
        if (!finger.down) return;
        finger.x = e.clientX;
        finger.y = e.clientY;
      } else {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.at = performance.now();
        mouse.seen = true;
      }
    },
    { passive: true, signal },
  );
  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType !== "touch") return;
      finger.down = true;
      finger.x = e.clientX;
      finger.y = e.clientY;
    },
    { passive: true, signal },
  );
  const onFingerUp = (e: PointerEvent) => {
    if (e.pointerType !== "touch" || !finger.down) return;
    finger.down = false;
    finger.releasedAt = performance.now();
  };
  window.addEventListener("pointerup", onFingerUp, { passive: true, signal });
  window.addEventListener("pointercancel", onFingerUp, { passive: true, signal });
  window.addEventListener("scroll", markRect, { passive: true, signal });
  touchMq.addEventListener(
    "change",
    () => {
      isTouch = touchMq.matches;
    },
    { signal },
  );

  // Canvas backing store (device pixels when the browser reports them) + figure rect.
  let cssSize = { w: 0, h: 0 };
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target !== canvas) {
        markRect();
        continue;
      }
      const box = entry.contentBoxSize?.[0];
      const dev = entry.devicePixelContentBoxSize?.[0];
      cssSize = box ? { w: box.inlineSize, h: box.blockSize } : { w: entry.contentRect.width, h: entry.contentRect.height };
      renderer.resize(cssSize.w, cssSize.h, dev?.inlineSize, dev?.blockSize);
    }
  });
  try {
    ro.observe(canvas, { box: "device-pixel-content-box" });
  } catch {
    ro.observe(canvas); // Safari: no device-pixel-content-box
  }
  if (figure !== canvas) ro.observe(figure);
  window.addEventListener(
    "resize",
    () => {
      markRect();
      // A dpr change (zoom, another screen) may not resize the canvas box.
      if (cssSize.w > 0) renderer.resize(cssSize.w, cssSize.h);
    },
    { passive: true, signal },
  );

  // Scroll reaction only while the hero (or the projection room) is in view.
  let io: IntersectionObserver | null = null;
  if (hero) {
    io = new IntersectionObserver((entries) => {
      const visible = entries[entries.length - 1]?.isIntersecting ?? true;
      if (visible && !heroVisible) renderer.invalidate();
      heroVisible = visible;
      markRect();
    });
    io.observe(hero);
  }
  const offStage = stage.subscribe((s, prev) => {
    roomVisible = s.roomInView;
    if (s.heroProgress !== prev.heroProgress) markRect(); // the pin scales figure.ping
  });

  const offMotion = subscribeMotion(() => {
    const next = getMotionPrefs().ok;
    if (next === ok) return;
    ok = next;
    if (!ok) {
      dizzy = null;
      helloAt = 0;
      nextBlinkAt = Infinity;
      glance.aim = null;
      squash.reset();
    } else if (renderer.ready) {
      scheduleBlink(performance.now());
    }
  });

  // ── Sprites (nothing is drawn until the core three have decoded) ──────────
  loadCore(data.sprites, signal).then(
    (core) => {
      if (disposed) {
        releaseSprite(core.blank);
        releaseSprite(core.pupilL);
        releaseSprite(core.pupilR);
        return;
      }
      renderer.setCore(core);
      // First frame = centred = the baked eyes; the pupils then ease to the current aim.
      pose[0].weight = pose[1].weight = 0;
      const now = performance.now();
      renderer.setEyes(pose[0].angle, 0, pose[1].angle, 0);
      renderer.frame(now);
      if (ok) {
        if (claimHello()) helloAt = now + HELLO_DELAY_MS;
        scheduleBlink(now);
      }
    },
    () => {
      /* sprites unavailable: the still's baked eyes stay (no-JS look) */
    },
  );
  for (const kind of ["blink", "happy"] as const) {
    loadOptional(data.sprites[kind], signal).then((s) => {
      if (!s) return;
      if (disposed) releaseSprite(s);
      else renderer.setStrip(kind, s);
    });
  }

  // ── Aim resolution ────────────────────────────────────────────────────────
  const figureRect = (now: number): DOMRect | null => {
    if (rectDirty || now - rectAt > RECT_MAX_AGE) {
      // Measured lazily (at most once per frame, only while a pointer drives):
      // the pin moves figure.ping without scrolling it, so a cached rect plus
      // the scroll offset would drift; scroll/resize/stage events mark it stale.
      rect = figure.getBoundingClientRect();
      rectAt = now;
      rectDirty = false;
    }
    return rect && rect.height > 0 ? rect : null;
  };

  const atPoint = (source: GazeSource, x: number, y: number, now: number): Target => {
    const r = figureRect(now);
    if (!r) return centre(source);
    const eyeR = geo.eyeR * r.height;
    const mx = r.left + geo.midX * r.width;
    const my = r.top + geo.midY * r.height;
    const d = Math.hypot(x - mx, y - my);
    if (d < DEAD_ZONE * eyeR) return centre(source);
    const w = smoothstep(DEAD_ZONE, FULL_AT, d / eyeR);
    const [l, rt] = geo.eyes;
    return {
      source,
      aim: angleTo(mx, my, x, y),
      // Per eye: θ from that eye's own dome centre (mild convergence); one shared weight.
      angle: [
        angleTo(r.left + l.fx * r.width, r.top + l.fy * r.height, x, y),
        angleTo(r.left + rt.fx * r.width, r.top + rt.fy * r.height, x, y),
      ],
      weight: [w, w],
      snap: false,
    };
  };

  const idleGlance = (now: number): Target => {
    if (now >= glance.next) {
      glance.count += 1;
      if (glance.count % 3 === 0) {
        // Every third glance: back to the visitor, and blink.
        glance.aim = null;
        if (renderer.ready && heroVisible) renderer.blink(BLINK_MS);
      } else {
        const from = glance.aim ?? rand(0, 360);
        glance.aim = wrap360(from + (Math.random() < 0.5 ? -1 : 1) * rand(...GLANCE_TURN));
        glance.weight = rand(...GLANCE_WEIGHT);
      }
      glance.next = now + rand(...GLANCE_EVERY);
    }
    return glance.aim === null ? centre("idle") : toward("idle", glance.aim, glance.weight);
  };

  const resolve = (now: number, sv: number): Target => {
    if (dizzy) {
      const p = (now - dizzy.t0) / DIZZY_MS;
      if (p < 1) return toward("dizzy", wrap360(dizzy.from + dizzy.dir * 360 * DIZZY_LAPS * easeInOutSine(p)), 1, true);
      dizzy = null;
      dizzyCooldownUntil = now + DIZZY_COOLDOWN_MS;
      if (renderer.ready) renderer.blink(BLINK_MS);
      scheduleBlink(now);
    }
    if (now - lastScrollAt < SCROLL_SETTLE_MS) {
      return toward("scroll", scrollAim, Math.abs(sv));
    }
    if (finger.down || now - finger.releasedAt < RELEASE_MS) {
      return atPoint("pointer", finger.x, finger.y, now);
    }
    if (gyro.enabled && gyro.live) {
      return gyro.aim === null ? centre("gyro") : toward("gyro", gyro.aim, gyro.weight);
    }
    if (mouse.seen && now - mouse.at < IDLE_MS) {
      return atPoint("pointer", mouse.x, mouse.y, now);
    }
    if (isTouch && ok && heroVisible) return idleGlance(now);
    return centre(everDriven ? "idle" : "none");
  };

  // ── The loop ──────────────────────────────────────────────────────────────
  const tick = (_time: number, deltaTime: number) => {
    const now = performance.now();
    const dt = clamp(deltaTime, 0, 100);
    const reactScroll = heroVisible || roomVisible;
    if (!reactScroll) {
      // Nothing of Ping is on screen: let a squash settle and skip the rest.
      // The probe stays live: nothing drives the gaze, and scaleY springs back.
      if (ok) squash.scroll(0);
      const scaleY = squash.apply();
      if (QA) writeProbe(null, scaleY, "none");
      return;
    }
    const v = getScrollVelocity();
    const sv = clamp(v / SCROLL_DIV, -1, 1);
    const scrolling = Math.abs(sv) > SCROLL_MIN;
    if (scrolling) {
      lastScrollAt = now;
      scrollAim = sv > 0 ? 90 : 270; // down the page / up the page
    }

    // Hard flick → dizzy: two laps in 700 ms, then a blink.
    if (Math.abs(v) < DIZZY_REARM_V) dizzyArmed = true;
    if (ok && !dizzy && dizzyArmed && Math.abs(v) > DIZZY_V && now >= dizzyCooldownUntil) {
      dizzy = { t0: now, from: pose[0].angle, dir: v > 0 ? 1 : -1 };
      dizzyArmed = false;
    }

    const t = resolve(now, sv);
    if (t.source !== "none" && t.source !== "idle") everDriven = true;

    const kAngle = ok ? lerpFactor(ANGLE_LERP, dt) : 1;
    const kWeight = ok ? easeFactor(WEIGHT_TAU, dt) : 1;
    for (let i = 0; i < 2; i++) stepPose(pose[i], t.angle[i], t.weight[i], kAngle, kWeight, t.snap || !ok);

    // Blinks: random 4–7 s, and the "hello" once the sprites are in.
    if (ok && renderer.ready && heroVisible && !dizzy) {
      if (helloAt && now >= helloAt) {
        helloAt = 0;
        renderer.blink(BLINK_MS);
        scheduleBlink(now);
      } else if (now >= nextBlinkAt) {
        renderer.blink(BLINK_MS);
        scheduleBlink(now);
      }
    }

    renderer.setEyes(pose[0].angle, pose[0].weight, pose[1].angle, pose[1].weight);
    if (heroVisible) renderer.frame(now);

    // With motion off, squash.reset() left both proxies at rest, so apply() returns 1.
    if (ok) squash.scroll(scrolling ? Math.abs(sv) : 0);
    const scaleY = squash.apply();

    if (QA) writeProbe(t.aim, scaleY, t.source);
  };
  const offTick = addTick(tick);

  return {
    boop() {
      if (disposed) return;
      const now = performance.now();
      if (renderer.ready) renderer.happy(HAPPY_MS);
      if (ok) {
        squash.boop();
        if (nextBlinkAt < now + HAPPY_MS + 400) nextBlinkAt = now + HAPPY_MS + 400;
      }
    },
    setGyro(on) {
      if (!disposed) gyro.setEnabled(on);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      offTick();
      ac.abort();
      ro.disconnect();
      io?.disconnect();
      offStage();
      offMotion();
      gyro.dispose();
      squash.dispose();
      renderer.dispose();
      if (QA && window.__gaze === probe) delete window.__gaze;
    },
  };
}
