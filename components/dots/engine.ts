// The WebGL dot stage (blueprint §5.2–§5.5, PHASE5 "Workstream D"). DotStage.tsx starts it in an
// effect and the returned function tears everything down (Activity-safe: safe to re-run).
//
// Plain WebGL2 through components/dots/gl.ts (no three.js: §8 "all JS after a full scroll"). One
// POINTS draw with the program from components/dots/shaders.ts; every point reads its targets from
// the packed float texture that lib/dots/targets builds. The renderer only READS lib/stage
// (heroProgress, dots, look) and writes nothing but `handoff`. The frame runs on the shared gsap
// ticker (lib/ticker, loaded with import() so GSAP and Lenis never land in this chunk); "pausing"
// removes the tick, the equivalent of setAnimationLoop(null) for a stage that shares the page's one
// loop.
import gaze from "@/content/gaze.json";
import shapes from "@/public/dots/shapes.json";
import { loadTargets, mulberry32, TIER_POINTS, type DotTargets, type PointTier } from "@/lib/dots/targets";
import { DESKTOP_MQ } from "@/lib/motion";
import type { Tier, TierReason } from "@/lib/quality";
import { HANDOFF_AT, getPingFigure, stage } from "@/lib/stage";
import {
  FrameGovernor,
  LAST_SHAPE,
  PUPIL_PX,
  RAISED_UNTIL,
  SCROLL_GAZE,
  TICK_MS,
  angleOf,
  clamp,
  clamp01,
  contactRegion,
  coverSize,
  densityRanks,
  effectiveDisperse,
  effectiveHeroProgress,
  effectiveShape,
  holeRadius,
  inZone,
  lookToward,
  occupancy,
  particleProgress,
  place,
  rectOf,
  releaseTarget,
  rippleAt,
  roomRegion,
  shapeRect,
  stepHole,
  stepRelease,
  tickRate,
  type BoxLike,
  type Rect,
} from "./layout";
import {
  bindTexture,
  clear,
  createContext,
  createFloatTexture,
  createImageTexture,
  createPoints,
  createProgram,
  cssCamera,
  deletePoints,
  drawPoints,
  initState,
  loseContext,
  resize,
  type GL,
  type PointBuffer,
  type Program,
} from "./gl";
import { fragmentShader, vertexShader } from "./shaders";

const QA = process.env.NEXT_PUBLIC_QA === "1";
const DEV = process.env.NODE_ENV !== "production";

/** Attribute location of `position` (bound before the link). */
const POSITION = 0;
/** Texture units: the targets, the density ranks, the Ping still. */
const UNIT = { targets: 0, ranks: 1, ping: 2 } as const;

/** DPR cap per tier (§5.5). */
const DPR_CAP: Record<PointTier, number> = { T2: 1.75, T1: 1.5 };
/** Dot size, CSS px (§5.2): 2.2 with a fine pointer, 2.6 on touch. */
const SIZE_FINE = 2.2;
const SIZE_TOUCH = 2.6;
/** Largest hand-off cover size, CSS px. */
const COVER_MAX = 16;
/** Idle shimmer amplitude, px. */
const SHIMMER_PX = 0.6;
/** Pupils glide toward their target at this rate per 60 Hz tick. */
const PUPIL_LERP = 0.25;
/** Paper → night colour and blending slide, ms time constant. */
const NIGHT_TAU = 350;
/** Contact success: stream (max delay .4 s + 900 ms), then reform over the same shape of timing. */
const STREAM_S = 1.3;
/** Taps shorter and stiller than this send a ripple (touch). */
const TAP_MS = 350;
const TAP_PX = 12;

const COARSE_MQ = "(hover: none), (pointer: coarse)";

/** On figure.ping while this stage has its still hidden (opacity 0); hero.module.css reads it. */
const STILL_HIDDEN = "data-still-hidden";

/** A tier the governor dropped stays dropped for the page's life (Activity re-mounts included). */
let tierFloor: PointTier | null = null;

export type DotStageOptions = {
  /** Starting tier: T2 (desktop) or T1 (phones, coarse pointers). */
  tier: PointTier;
  /** The stage can't (or shouldn't) draw: switch to the T0 halftones for good. */
  onFallback: (reason: TierReason) => void;
};

type Rgb = [number, number, number];

const FALLBACK_COLOURS: Record<string, string> = {
  "--lilac": "#b7a3f0",
  "--orchid": "#6a3fd3",
  "--bubblegum": "#ff86b5",
  "--glow": "#fff0fa",
  "--ink": "#23162e",
};

/** Palette token → sRGB 0..1 (shaders work in display space; no colour management). */
function token(style: CSSStyleDeclaration, name: string): Rgb {
  const raw = style.getPropertyValue(name).trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(raw)?.[1] ?? FALLBACK_COLOURS[name].slice(1);
  const v = parseInt(hex, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  return img.decode().then(() => img);
}

/** GPU-side resources for one target set (rebuilt when the governor drops T2 → T1). */
type Gpu = {
  targets: DotTargets;
  /** `position` per point: (index j, rnd, rnd2). */
  points: PointBuffer;
  /** RGBA32F targets (lib/dots/types.ts layout). */
  targetTex: WebGLTexture;
  /** R32F density ranks, same layout. */
  rankTex: WebGLTexture;
  /** Share of shape 0's box its silhouette covers (sets the hand-off dot size). */
  occ0: number;
};

/** Uploads one target set now (idle time, right after sampling), not in the hand-off frame. */
function buildGpu(gl: GL, t: DotTargets): Gpu {
  const attr = new Float32Array(t.n * 3);
  const rnd = mulberry32(0x5eed + t.n);
  for (let j = 0; j < t.n; j++) {
    attr[j * 3] = j;
    attr[j * 3 + 1] = rnd();
    attr[j * 3 + 2] = rnd();
  }
  const points = createPoints(gl, POSITION, attr, 3);
  const targetTex = createFloatTexture(gl, t.data, t.width, t.height, "rgba32f");
  const ranks = densityRanks(t.data, t.n, t.k, t.pupilStart, t.width * t.height);
  const rankTex = createFloatTexture(gl, ranks, t.width, t.height, "r32f");
  return { targets: t, points, targetTex, rankTex, occ0: occupancy(t.data, t.n, 0, t.pupilStart, t.scales[0]) };
}

/** Frees one target set's buffer and textures (the context lives on). */
function disposeGpu(gl: GL, g: Gpu) {
  deletePoints(gl, g.points);
  gl.deleteTexture(g.targetTex);
  gl.deleteTexture(g.rankTex);
}

/** loadTargets' options plus the cancel signal lib/dots is asked to honour (terminate the worker). */
type LoadOptions = Parameters<typeof loadTargets>[0] & { signal?: AbortSignal };

const isAbort = (err: unknown) => (err as { name?: unknown } | null)?.name === "AbortError";

export function startDotStage({ tier: requested, onFallback }: DotStageOptions): () => void {
  // Safety net: a stage that hid the still and never got to restore it (it only ever writes
  // opacity 0 there) must not leave Ping, the hero's LCP image, invisible on a re-shown route.
  getPingFigure()?.style.removeProperty("opacity");
  getPingFigure()?.removeAttribute(STILL_HIDDEN);

  let disposed = false;
  /** Cancels this stage's in-flight target sampling (first load and the T2 → T1 reload). */
  const loads = new AbortController();
  const sample = (n: number) => {
    const options: LoadOptions = { n, signal: loads.signal };
    return loadTargets(options);
  };
  let tier: PointTier = tierFloor === "T1" || requested === "T1" ? "T1" : "T2";
  const coarse = window.matchMedia(COARSE_MQ).matches;
  const desktopMq = window.matchMedia(DESKTOP_MQ);
  const baseSize = coarse ? SIZE_TOUCH : SIZE_FINE;

  // ── Canvas: first child of body, fixed, behind main once the dots have dispersed (§5.2) ──
  const canvas = document.createElement("canvas");
  canvas.setAttribute("data-dots", "");
  canvas.setAttribute("aria-hidden", "true");
  const cs = canvas.style;
  cs.position = "fixed";
  cs.left = "0";
  cs.top = "0";
  cs.width = "100%";
  cs.height = "100vh";
  cs.height = "100lvh"; // ignored where unsupported; never resizes as a phone's URL bar slides
  cs.display = "block";
  cs.pointerEvents = "none";
  cs.zIndex = "2";
  cs.opacity = "0";
  document.body.prepend(canvas);

  const context = createContext(canvas);
  const fail = (reason: TierReason) => {
    if (disposed) return;
    dispose();
    onFallback(reason);
  };
  if (!context) {
    canvas.remove();
    disposed = true;
    queueMicrotask(() => onFallback("no-webgl2"));
    return () => {};
  }
  const gl: GL = context;

  // The program compiles from here on (in parallel where the driver can); its link status and
  // uniforms are read once the targets are in, or at the latest in the first visible frame.
  let program: Program;
  try {
    program = createProgram(gl, vertexShader, fragmentShader, { position: POSITION });
    initState(gl);
  } catch {
    loseContext(gl);
    canvas.remove();
    disposed = true;
    queueMicrotask(() => onFallback("no-webgl2"));
    return () => {};
  }
  const maxPoint = Number((gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null)?.[1]) || 64;

  // ── Camera: CSS px, y down, (0, vw, 0, vh, −1000, 1000) ─────────────────
  const projection = new Float32Array(16);

  const root = getComputedStyle(document.documentElement);
  const lilac = token(root, "--lilac");
  const orchid = token(root, "--orchid");
  const bubblegum = token(root, "--bubblegum");
  const glowC = token(root, "--glow");
  const ink = token(root, "--ink");

  const rects = new Float32Array(6 * 4);
  const scales = new Float32Array(6).fill(1);
  const mouse = new Float32Array([-1e4, -1e4]);
  const ripple = new Float32Array(4);
  const pupilOff = new Float32Array(2);
  const pupilOff0 = new Float32Array(2);
  const viewU = new Float32Array(2);
  // Uniform values, uploaded in every rendered frame (each setter skips a value that didn't change).
  const ints = { uN: 0, uPupilStart: 0 };
  const floats = {
    uShape: 0,
    uDisperse: 0,
    uTime: 0,
    uShimmer: SHIMMER_PX,
    uHoleR: 0,
    uSize: baseSize,
    uCover: baseSize,
    uDpr: 1,
    uOpacity: 1,
    uGlow: 0,
    uNight: 0,
    uStreamT: -1,
    uReformT: 99,
  };
  const vectors = {
    uProjection: projection,
    uRects: rects,
    uScales: scales,
    uMouse: mouse,
    uRipple: ripple,
    uPupil: pupilOff,
    uPupil0: pupilOff0,
    uView: viewU,
    // Icon body: a deeper lilac that reads on paper, plain lilac (added light) on night.
    uBody: new Float32Array([...mixRgb(lilac, orchid, 0.35), ...lilac]),
    uHigh: new Float32Array([...bubblegum, ...glowC]),
    // Pupil cores: ink on paper (and always inside Ping's white eye domes), glow on night for the
    // icons; pupils always blend normally (shaders.ts colourOf).
    uEye: new Float32Array([...ink, ...glowC]),
    uRamp: new Float32Array([...lilac, ...bubblegum, ...glowC]),
  };
  const intNames = Object.keys(ints) as (keyof typeof ints)[];
  const floatNames = Object.keys(floats) as (keyof typeof floats)[];
  const vectorNames = Object.keys(vectors) as (keyof typeof vectors)[];

  let gpu: Gpu | null = null;
  let pingTex: WebGLTexture | null = null;
  let addTickFn: ((fn: () => void) => () => void) | null = null;
  let scrollVelocity: () => number = () => 0;

  /**
   * The link check and uniform lookup, once (it blocks only if the driver is still compiling).
   * False while the stage can't draw: a lost context (whose event fails the stage) or a program
   * that didn't link, which drops to T0 the way a missing WebGL2 does.
   */
  const linked = (): boolean => {
    try {
      return program.link();
    } catch (err) {
      if (DEV) console.error(err);
      fail("no-webgl2");
      return false;
    }
  };

  const install = (g: Gpu) => {
    const old = gpu;
    gpu = g;
    const t = g.targets;
    ints.uN = t.n;
    ints.uPupilStart = t.pupilStart;
    for (let k = 0; k < 6; k++) scales[k] = t.scales[k] ?? 1;
    if (old) disposeGpu(gl, old);
    applySize();
    // The textures went up in buildGpu. Finish the program now too, while idle, not in the hand-off
    // frame (unless the driver is still compiling it in parallel: the first draw waits for it then).
    if (program.ready()) linked();
  };

  /** One frame, as three's renderer.render(scene, camera) drew it (autoClear first). False if nothing was drawn. */
  const render = (g: Gpu): boolean => {
    clear(gl);
    if (!linked()) return false;
    program.use();
    bindTexture(gl, UNIT.targets, g.targetTex);
    bindTexture(gl, UNIT.ranks, g.rankTex);
    bindTexture(gl, UNIT.ping, pingTex);
    program.setInt("uTargets", UNIT.targets);
    program.setInt("uRanks", UNIT.ranks);
    program.setInt("uPing", UNIT.ping);
    for (const k of intNames) program.setInt(k, ints[k]);
    for (const k of floatNames) program.setFloat(k, floats[k]);
    for (const k of vectorNames) program.setVector(k, vectors[k]);
    drawPoints(gl, g.points);
    return true;
  };

  // ── Viewport ─────────────────────────────────────────────────────────────
  let viewW = 1;
  let viewH = 1;
  let mobile = !desktopMq.matches;
  let roomAnchor: HTMLElement | null = null;
  let contactAnchor: HTMLElement | null = null;
  // The room anchor is position: fixed, so its box only changes with the viewport. Measuring it
  // every frame forced a full layout after the other tickers' style writes (≈ +16 ms a frame at
  // 4× CPU on phones). It is re-read only when marked stale: resize, its own size, the room
  // coming on screen.
  let roomBox: BoxLike | null = null;
  let roomBoxStale = true;
  const roomRo = new ResizeObserver(() => {
    roomBoxStale = true;
  });

  const findAnchors = () => {
    const room = document.querySelector<HTMLElement>('[data-dots-anchor="room"]');
    if (room !== roomAnchor) {
      roomRo.disconnect();
      if (room) roomRo.observe(room);
      roomAnchor = room;
    }
    roomBoxStale = true;
    // Below 1024 px the contact anchor is display: none (Contact.tsx lg:block, which must match
    // DESKTOP_MQ), so reading it while #contact is on screen only forced a layout to learn it has
    // no box. Phones fade the envelope out instead.
    contactAnchor = mobile ? null : document.querySelector<HTMLElement>('[data-dots-anchor="contact"]');
  };
  const applySize = () => {
    viewW = canvas.clientWidth || window.innerWidth;
    viewH = canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP[tier]);
    resize(gl, viewW, viewH, dpr);
    cssCamera(viewW, viewH, projection);
    floats.uDpr = dpr;
    floats.uSize = Math.min(baseSize, maxPoint / dpr);
    viewU[0] = viewW;
    viewU[1] = viewH;
    mobile = !desktopMq.matches;
    findAnchors();
  };
  applySize();

  // ── Inputs ───────────────────────────────────────────────────────────────
  const pointer = { x: 0, y: 0, fine: false, inside: false };
  let tap: { x: number; y: number; t: number } | null = null;
  let rippleFrom: { x: number; y: number; t: number } | null = null;

  const onMove = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.fine = e.pointerType === "mouse" || e.pointerType === "pen";
    pointer.inside = true;
  };
  const onOut = (e: MouseEvent) => {
    if (!e.relatedTarget) pointer.inside = false;
  };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "touch") tap = { x: e.clientX, y: e.clientY, t: performance.now() };
    else onMove(e);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== "touch" || !tap) return;
    const quick = performance.now() - tap.t < TAP_MS;
    const still = Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < TAP_PX;
    if (quick && still) rippleFrom = { x: e.clientX, y: e.clientY, t: performance.now() };
    tap = null;
  };
  const onCancel = () => {
    tap = null;
  };

  // contact:success (components/contact/ContactForm): the envelope streams right, then reforms.
  let successAt: number | null = null;
  let shapeAtSuccess = 0;
  const onSuccess = () => {
    if (!handedOff || !contactRegion(contactAnchor?.getBoundingClientRect())) return;
    successAt = performance.now();
    shapeAtSuccess = stage.get().dots.shape;
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onCancel, { passive: true });
  document.addEventListener("mouseout", onOut, { passive: true });
  window.addEventListener("resize", applySize, { passive: true });
  window.addEventListener("contact:success", onSuccess);
  const onLost = () => fail("context-lost");
  canvas.addEventListener("webglcontextlost", onLost);

  // ── Which sections are on screen (pause when none of them is) ────────────
  // Half a viewport of margin: the contact scrub assembles the envelope over the 40vh before
  // #contact, before the section itself intersects.
  const inView = { home: false, about: false, contact: false };
  const sections = (["home", "about", "contact"] as const)
    .map((id) => [id, document.getElementById(id)] as const)
    .filter((e): e is readonly ["home" | "about" | "contact", HTMLElement] => e[1] !== null);
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).id as keyof typeof inView;
        if (id in inView) inView[id] = e.isIntersecting;
        if (id === "about" && e.isIntersecting) roomBoxStale = true;
      }
      if (!inView.contact) successAt = null;
      updateRunning();
    },
    { rootMargin: "50% 0px 50% 0px" },
  );
  for (const [, el] of sections) io.observe(el);
  const onVisibility = () => updateRunning();
  document.addEventListener("visibilitychange", onVisibility);

  // ── Frame state ──────────────────────────────────────────────────────────
  let release = 0;
  let handedOff = false;
  let ownHandoffAttr = false;
  let zIndex = "2";
  let holeR = 0;
  const pupil = { x: 0, y: 0 };
  let pupilDir = 0;
  let scrollDir = 0;
  let scrollW = 0;
  let lastScrollAt = -Infinity;
  let night = 0;
  let lastNow = 0;
  let drewVisible = false;
  let renderedLast = false;
  let reloading = false;
  const governor = new FrameGovernor();
  const travel = {
    x: (gaze.eyes[0].travel[0] + gaze.eyes[1].travel[0]) / 200,
    y: (gaze.eyes[0].travel[1] + gaze.eyes[1].travel[1]) / 200,
  };
  const rect0: Rect = { cx: 0, cy: 0, w: 1, h: 1 };
  const shapeRects: Rect[] = Array.from({ length: 6 }, () => ({ cx: 0, cy: 0, w: 1, h: 1 }));
  const probe = { shape: 0, holeR: 0, pupilDir: 0, tier: tier as Tier, eyes: [0, 0] as [number, number] };
  const home = document.getElementById("home");

  /**
   * The figure.ping element this stage hid. It is restored by reference, never re-queried: when
   * an Activity hides the route, the hero's layout-effect cleanup unregisters the figure
   * (registerPingFigure(null)) before this stage's passive cleanup runs, and the kept DOM would
   * otherwise come back with Ping still at opacity 0.
   */
  let hiddenFigure: HTMLElement | null = null;
  const showStill = () => {
    hiddenFigure?.style.removeProperty("opacity");
    hiddenFigure?.removeAttribute(STILL_HIDDEN);
    hiddenFigure = null;
  };
  const hideStill = (el: HTMLElement | null) => {
    if (el === hiddenFigure) return;
    showStill();
    hiddenFigure = el;
    el?.style.setProperty("opacity", "0");
    // hero.module.css takes the boop and look-around buttons out of the tab order and out of reach
    // while the still is invisible: a focus ring on an invisible control fails WCAG 2.4.7.
    el?.setAttribute(STILL_HIDDEN, "");
  };

  /**
   * #home[data-handoff] (front clip and shadow out, "Patel" whole) must hold for as long as the
   * dots do. The pinned hero sets it from HANDOFF_AT itself; below 1024 px it never does, and on
   * the way back the dots hold past HANDOFF_AT until they have reassembled. The stage adds it then,
   * and only removes what it added (and not while the pinned hero still wants it).
   */
  const holdHandoffAttr = () => {
    if (!home || home.hasAttribute("data-handoff")) return;
    home.setAttribute("data-handoff", "");
    ownHandoffAttr = true;
  };
  const releaseHandoffAttr = () => {
    if (!ownHandoffAttr) return;
    ownHandoffAttr = false;
    const heroWantsIt = !mobile && stage.get().heroProgress >= HANDOFF_AT;
    if (!heroWantsIt) home?.removeAttribute("data-handoff");
  };

  /** The hand-off (§5.3): in one frame the still goes to opacity 0 and the canvas to 1, or back. */
  const setHandoff = (on: boolean) => {
    handedOff = on;
    if (on) hideStill(getPingFigure());
    else showStill();
    cs.opacity = on ? "1" : "0";
    if (on) holdHandoffAttr();
    else releaseHandoffAttr();
    stage.set({ handoff: on ? "dots" : "still" });
  };

  const readRect = (el: HTMLElement | null): BoxLike | null => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 ? r : null;
  };
  const roomRect = (): BoxLike | null => {
    if (roomBoxStale) {
      roomBox = readRect(roomAnchor);
      roomBoxStale = false;
    }
    return roomBox;
  };

  // A NaN box part would send every dot of that shape to NaN: write a neutral value instead.
  const finite = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
  const writeRect = (k: number, r: Rect) => {
    shapeRects[k] = r;
    rects[k * 4] = finite(r.cx, 0);
    rects[k * 4 + 1] = finite(r.cy, 0);
    rects[k * 4 + 2] = finite(r.w, 1);
    rects[k * 4 + 3] = finite(r.h, 1);
  };

  const dropTier = () => {
    if (tier === "T2") {
      if (reloading) return;
      tierFloor = "T1";
      reloading = true;
      sample(TIER_POINTS.T1).then(
        (t) => {
          reloading = false;
          if (disposed) return;
          tier = "T1";
          probe.tier = "T1";
          install(buildGpu(gl, t));
          governor.reset();
        },
        (err: unknown) => {
          reloading = false;
          if (disposed || isAbort(err)) return; // torn down mid-sampling, not a governor drop
          fail("governor");
        },
      );
      return;
    }
    fail("governor");
  };

  const tick = () => {
    if (disposed || !gpu) return;
    const now = performance.now();
    const rawDt = lastNow ? now - lastNow : 0;
    const dt = Math.min(100, rawDt || TICK_MS);
    lastNow = now;
    const st = stage.get();
    const t = gpu.targets;

    // Hero release and the hand-off. On the way back the dots hold until they have reassembled
    // (the release is smoothed, and on phones progress jumps 1 → 0 while the release takes ~1.1 s):
    // shape 0 reads figure.ping's box every frame meanwhile, so the swap back lands on an aligned
    // frame instead of the cloud vanishing mid-flight.
    release = stepRelease(release, releaseTarget(st.heroProgress), dt);
    const wantHandoff = st.heroProgress >= HANDOFF_AT || (handedOff && release > 1e-3);
    if (wantHandoff !== handedOff) setHandoff(wantHandoff);
    if (handedOff) {
      // Keep the still hidden and the front clip out for the whole hold, also if the hero
      // re-registered its figure or (pinned, on the way back) already dropped the attribute.
      const figure = getPingFigure();
      if (figure && figure !== hiddenFigure) hideStill(figure);
      holdHandoffAttr();
    }
    const z = effectiveHeroProgress(handedOff, st.heroProgress, release) < RAISED_UNTIL ? "2" : "0";
    if (z !== zIndex) cs.zIndex = zIndex = z;

    // Contact success: stream (shape 5), then reform as shape 1 beside the form.
    let override: number | null = null;
    let streamT = -1;
    let reformT = 99;
    if (successAt !== null) {
      const s = (now - successAt) / 1000;
      if (s < STREAM_S) {
        override = LAST_SHAPE;
        streamT = s;
      } else {
        reformT = s - STREAM_S;
        const unchanged = Math.abs(st.dots.shape - shapeAtSuccess) < 1e-3 || Math.abs(st.dots.shape - 1) < 1e-3;
        if (unchanged) override = 1;
      }
    }
    const shape = override ?? effectiveShape(release, st.dots.shape);
    const s0 = Math.min(Math.floor(shape), LAST_SHAPE);
    const s1 = Math.min(s0 + 1, LAST_SHAPE);
    const f = s0 === LAST_SHAPE ? 0 : shape - s0;

    // Layout: shape 0 inside figure.ping (read every frame while it is on screen), the room
    // shapes in the room region, the envelope over the contact anchor.
    const figBox = handedOff && s0 === 0 ? readRect(getPingFigure()) : null;
    if (figBox) Object.assign(rect0, rectOf(figBox));
    else if (!(rect0.w > 1)) Object.assign(rect0, shapeRect(roomRegion(viewW, viewH, mobile), t.aspects[0], 1, false));
    writeRect(0, rect0);
    const region = roomRegion(viewW, viewH, mobile, inView.about ? roomRect() : null);
    for (let k = 1; k <= 4; k++) writeRect(k, shapeRect(region, t.aspects[k], t.scales[k], k === 1));
    const contact = inView.contact || successAt !== null ? contactRegion(readRect(contactAnchor)) : null;
    writeRect(5, contact ? shapeRect(contact, t.aspects[5], t.scales[5], false) : shapeRects[4]);
    if (contact && successAt !== null) writeRect(1, shapeRect(contact, t.aspects[1], t.scales[1], true));

    // Opacity: the scrubs' value; with no contact anchor (phones) the envelope fades out instead.
    const envelopeFade = contact ? 1 : 1 - clamp01(shape - 4);
    const opacity = clamp01(st.dots.opacity) * envelopeFade;
    const visible = handedOff && opacity > 0.002;

    // Eyes and pupils (§5.1, §4.3).
    const km = particleProgress(f, 0.5);
    const e0 = t.eyes[s0];
    const e1 = t.eyes[s1];
    const r0 = shapeRects[s0];
    const r1 = shapeRects[s1];
    const a0 = place(r0, (e0[0][0] + e0[1][0]) / 2, (e0[0][1] + e0[1][1]) / 2);
    const a1 = place(r1, (e1[0][0] + e1[1][0]) / 2, (e1[0][1] + e1[1][1]) / 2);
    const eyes: [number, number] = [a0[0] + (a1[0] - a0[0]) * km, a0[1] + (a1[1] - a0[1]) * km];

    const sv = clamp(scrollVelocity() / SCROLL_GAZE.div, -1, 1);
    if (Math.abs(sv) > SCROLL_GAZE.min && (inView.home || inView.about)) {
      scrollDir = Math.sign(sv);
      scrollW = Math.abs(sv);
      lastScrollAt = now;
    }
    let tx = 0;
    let ty = 0;
    if (st.look) {
      const l = lookToward(eyes, [st.look.x, st.look.y]);
      tx = l.x * l.w;
      ty = l.y * l.w;
    } else if (now - lastScrollAt < SCROLL_GAZE.holdMs) {
      ty = scrollDir * scrollW;
    } else if (pointer.inside && pointer.fine) {
      const l = lookToward(eyes, [pointer.x, pointer.y]);
      tx = l.x * l.w;
      ty = l.y * l.w;
    }
    const pr = tickRate(PUPIL_LERP, dt);
    pupil.x += (tx - pupil.x) * pr;
    pupil.y += (ty - pupil.y) * pr;
    if (Math.hypot(pupil.x, pupil.y) > 0.02) pupilDir = angleOf(pupil.x, pupil.y);
    pupilOff[0] = pupil.x * PUPIL_PX;
    pupilOff[1] = pupil.y * PUPIL_PX;
    pupilOff0[0] = pupil.x * travel.x * rect0.w;
    pupilOff0[1] = pupil.y * travel.y * rect0.h;

    // Cursor hole: open while a fine pointer is over the shape (§5.3).
    const R = holeRadius(viewW);
    const over =
      visible &&
      pointer.inside &&
      pointer.fine &&
      (inZone(r0, t.scales[s0], pointer.x, pointer.y, R) || inZone(r1, t.scales[s1], pointer.x, pointer.y, R));
    holeR = stepHole(holeR, over ? R : 0, dt);
    mouse[0] = pointer.x;
    mouse[1] = pointer.y;

    // Touch ripple.
    const rip = rippleFrom ? rippleAt(now - rippleFrom.t) : null;
    if (rippleFrom && !rip) rippleFrom = null;
    ripple[0] = rippleFrom?.x ?? 0;
    ripple[1] = rippleFrom?.y ?? 0;
    ripple[2] = rip?.radius ?? 0;
    ripple[3] = rip?.amp ?? 0;

    // Paper → night: colours and additive blending, once the dots have fully dispersed.
    const disperse = effectiveDisperse(handedOff, release, st.dots.disperse);
    const nightTarget = document.body.dataset.room === "night" && disperse >= 0.999 ? 1 : 0;
    night += (nightTarget - night) * (1 - Math.exp(-dt / NIGHT_TAU));

    floats.uShape = shape;
    floats.uDisperse = disperse;
    floats.uTime = now / 1000;
    floats.uHoleR = holeR;
    floats.uOpacity = opacity;
    floats.uGlow = clamp01(st.dots.glow);
    floats.uNight = night;
    floats.uStreamT = streamT;
    floats.uReformT = reformT;
    floats.uCover = Math.min(
      coverSize(gpu.occ0, rect0.w, rect0.h, t.pupilStart, baseSize, COVER_MAX),
      maxPoint / floats.uDpr,
    );

    if (visible) {
      if (!render(gpu)) return; // lost context (its event fails the stage) or already failed
      drewVisible = true;
      // QA builds can hold the tier: gate 7 measures T2/T1 themselves, and headless Chromium's
      // software GL stalls on the night glow's fill rate, which a real GPU does not.
      if (renderedLast && governor.push(rawDt) && !(QA && window.__dotsHoldTier)) dropTier();
      renderedLast = true;
    } else {
      if (drewVisible) clear(gl);
      drewVisible = false;
      renderedLast = false;
    }

    if (QA) {
      probe.shape = shape;
      probe.holeR = holeR;
      probe.pupilDir = pupilDir;
      probe.tier = tier;
      probe.eyes[0] = eyes[0];
      probe.eyes[1] = eyes[1];
      window.__dots = probe;
    }
  };

  // ── Loop: on while the hero, the room or contact is on screen and the tab is visible ──
  let removeTick: (() => void) | null = null;
  function updateRunning() {
    if (disposed) return;
    const anyInView = sections.length === 0 || inView.home || inView.about || inView.contact;
    const run = !!gpu && !!addTickFn && anyInView && document.visibilityState !== "hidden";
    if (run && !removeTick && addTickFn) {
      lastNow = 0;
      renderedLast = false;
      governor.reset(); // the first frames after a resume aren't the stage's steady state
      removeTick = addTickFn(tick);
    } else if (!run && removeTick) {
      removeTick();
      removeTick = null;
      // Nothing may linger on the fixed canvas while the stage sleeps.
      if (drewVisible) clear(gl);
      drewVisible = false;
    }
  }

  // ── Load: targets (worker), the Ping still's colours, the shared ticker and scroll velocity ──
  const pingSrc = shapes.shapes["ping-hero"].src;
  Promise.all([sample(TIER_POINTS[tier]), loadImage(pingSrc), import("@/lib/ticker"), import("@/lib/scroll")]).then(
    ([targets, img, ticker, scroll]) => {
      if (disposed) return;
      pingTex = createImageTexture(gl, img);
      install(buildGpu(gl, targets));
      addTickFn = ticker.addTick;
      scrollVelocity = scroll.getScrollVelocity;
      updateRunning();
    },
    (err: unknown) => {
      if (disposed || isAbort(err)) return; // torn down while loading: nothing to report
      if (process.env.NODE_ENV !== "production") console.warn("dots: the stage could not load", err);
      fail("context-lost");
    },
  );

  // ── Teardown (Activity-safe: everything this stage created or changed) ───
  function dispose() {
    if (disposed) return;
    disposed = true;
    loads.abort(); // stop sampling this stage no longer needs (lib/dots terminates the worker)
    removeTick?.();
    removeTick = null;
    io.disconnect();
    roomRo.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    document.removeEventListener("mouseout", onOut);
    window.removeEventListener("resize", applySize);
    window.removeEventListener("contact:success", onSuccess);
    canvas.removeEventListener("webglcontextlost", onLost);
    // Restore the element this stage hid (not getPingFigure(): under an Activity hide the hero has
    // already unregistered it), and drop the attribute only if this stage added it.
    if (handedOff) setHandoff(false);
    showStill();
    releaseHandoffAttr();
    if (gpu) disposeGpu(gl, gpu);
    gpu = null;
    if (pingTex) gl.deleteTexture(pingTex);
    pingTex = null;
    program.dispose();
    loseContext(gl); // final teardown only: a T2 → T1 swap keeps the context
    canvas.remove();
    if (QA && window.__dots === probe) delete window.__dots;
  }

  return dispose;
}
