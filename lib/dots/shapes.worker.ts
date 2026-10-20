// Dot-stage shape sampler (blueprint §5.1): the shared sampling core and the
// worker entry, in one dependency-free module.
//
// lib/dots/targets.ts spawns this file as a worker and re-exports the core; when
// Worker/OffscreenCanvas is missing it runs the same generator on the main thread
// in onIdle slices. The core lives here rather than in targets.ts so the worker's
// import graph never contains its own `new Worker(new URL(...))` spawn (a worker
// chunk that references itself).
//
// The message handler installs itself only inside a WorkerGlobalScope, so importing
// this module on the main thread or in Node (unit tests) has no side effects.

import {
  COLOR,
  DEPTH_PX,
  MAX_POINTS,
  PUPIL_POINTS,
  PUPILS_PER_EYE,
  SEED,
  TEX_WIDTH,
  TIER_POINTS,
  type DotTargets,
  type EyePair,
  type Mask,
  type PointTier,
  type ShapeSource,
  type ShapesRequest,
  type ShapesResponse,
} from "./types";

/** Long side Ping is drawn at before sampling. */
export const PING_SAMPLE_PX = 600;
/** Long side of the icon alpha masks. */
export const MASK_SAMPLE_PX = 512;
/** Pixels with alpha above this are inside the shape. */
export const ALPHA_MIN = 128;
/** Brightness-weighted acceptance: p = floor + (1 − floor) × luma, so dark fur still gets dots. */
export const WEIGHT_FLOOR = 0.1;
/** Weighted (Ping) points at or above this luma are highlights (~11% of Ping). */
export const HIGHLIGHT_LUMA = 0.82;
/** Mask (icon) points whose up-left neighbour this far away (× long side) is outside are a rim highlight. */
export const RIM = 0.008;
/** Pupil disc radius as a fraction of the box's shorter side (before scale). */
export const PUPIL_RADIUS = 0.04;

const Z_SPAN_PX = 40;
const Z_JITTER_PX = 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const ANGLE_STEPS = 1 << 20;
const INDEX_STEPS = MAX_POINTS; // 2^15: angle bucket × 2^15 + index stays an exact float64
// Work units between yields, sized so one unit stays well under 1 ms on a slow phone.
const SCAN_ROWS = 16;
const SAMPLE_BATCH = 512;
const POINT_BATCH = 2048;

/** Seeded PRNG (mulberry32): uniform floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tier for a point count: 12k and up is T2, anything less T1. */
export function tierFor(n: number): PointTier {
  return n >= TIER_POINTS.T2 ? "T2" : "T1";
}

/** Throws a RangeError unless n is an integer in (PUPIL_POINTS, MAX_POINTS]. */
export function assertPointCount(n: number): void {
  if (!Number.isInteger(n) || n <= PUPIL_POINTS || n > MAX_POINTS) {
    throw new RangeError(`dots: n must be an integer in (${PUPIL_POINTS}, ${MAX_POINTS}], got ${n}`);
  }
}

/** Size to draw an image at so its long side is `longSide` px. */
export function sampleDims(naturalW: number, naturalH: number, longSide: number): { w: number; h: number } {
  const k = longSide / Math.max(naturalW, naturalH);
  return { w: Math.max(1, Math.round(naturalW * k)), h: Math.max(1, Math.round(naturalH * k)) };
}

/** public/dots/shapes.json */
export type ShapesManifest = {
  order: readonly string[];
  shapes: Record<string, { src: string; eyes: string | readonly (readonly number[])[]; scale?: number }>;
};
/** The part of content/gaze.json the sampler reads: eye dome centres in % of the Ping box. */
export type GazeEyes = { eyes: readonly { c: readonly number[] }[] };

/**
 * Manifest → sources, in manifest order. Ping shapes (name "ping-*") sample the
 * body still at 600 px, brightness-weighted; icons sample their 512² alpha masks.
 * Eyes "gaze.json" take content/gaze.json's dome centres (% → 0..1).
 */
export function resolveSources(manifest: ShapesManifest, gaze: GazeEyes): ShapeSource[] {
  return manifest.order.map((name) => {
    const entry = manifest.shapes[name];
    if (!entry) throw new Error(`dots: shapes.json has no entry for "${name}"`);
    const ping = name.startsWith("ping");
    const raw =
      entry.eyes === "gaze.json"
        ? gaze.eyes.map((e) => [e.c[0] / 100, e.c[1] / 100])
        : typeof entry.eyes === "string"
          ? []
          : entry.eyes;
    if (raw.length !== 2 || raw.some((e) => e.length !== 2 || !e.every(Number.isFinite))) {
      throw new Error(`dots: "${name}" needs two [x, y] eye anchors`);
    }
    const eyes: EyePair = [
      [raw[0][0], raw[0][1]],
      [raw[1][0], raw[1][1]],
    ];
    return {
      name,
      url: entry.src,
      size: ping ? PING_SAMPLE_PX : MASK_SAMPLE_PX,
      weighted: ping,
      scale: entry.scale ?? 1,
      eyes,
    };
  });
}

/** Decode every source once (ping-hero and ping-seat share one decode). */
export function decodeAll(
  sources: readonly ShapeSource[],
  decode: (url: string, longSide: number) => Promise<Mask>,
): Promise<Mask[]> {
  const seen = new Map<string, Promise<Mask>>();
  return Promise.all(
    sources.map((s) => {
      const key = `${s.size}|${s.url}`;
      let p = seen.get(key);
      if (!p) {
        p = decode(s.url, s.size);
        seen.set(key, p);
      }
      return p;
    }),
  );
}

const clampHalf = (v: number) => (v < -0.5 ? -0.5 : v > 0.5 ? 0.5 : v);

/** Indices of the pixels with alpha > ALPHA_MIN, row-major. */
function* scanMask(mask: Mask): Generator<void, Int32Array, void> {
  const { width: w, height: h, data } = mask;
  if (!(w > 0 && h > 0) || data.length < w * h * 4) throw new Error("dots: mask data does not match its size");
  const out = new Int32Array(w * h);
  let count = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) if (data[(row + x) * 4 + 3] > ALPHA_MIN) out[count++] = row + x;
    if ((y + 1) % SCAN_ROWS === 0) yield;
  }
  return out.slice(0, count);
}

/**
 * Sample one shape into `out` at texel offset `base`: n − 240 body points
 * (rejection-sampled, angle-sorted) then 2 × 120 pupils. Returns the eye anchors
 * in centred box space.
 */
function* sampleShape(
  out: Float32Array,
  base: number,
  n: number,
  mask: Mask,
  inside: Int32Array,
  src: ShapeSource,
  rng: () => number,
): Generator<void, EyePair, void> {
  const { width: w, height: h, data } = mask;
  if (inside.length === 0) throw new Error(`dots: "${src.name}" has no pixels with alpha > ${ALPHA_MIN}`);
  const bodyN = n - PUPIL_POINTS;
  const s = src.scale;
  const rim = Math.max(1, Math.round(RIM * Math.max(w, h)));
  const xs = new Float32Array(bodyN);
  const ys = new Float32Array(bodyN);
  const zs = new Float32Array(bodyN);
  const cs = new Uint8Array(bodyN);

  // Rejection sampling over the in-mask pixels: pick uniformly, accept by brightness (Ping).
  let got = 0;
  let tries = 0;
  while (got < bodyN) {
    if (++tries % SAMPLE_BATCH === 0) yield;
    const p = inside[Math.floor(rng() * inside.length)];
    const o = p * 4;
    const luma = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    if (src.weighted && rng() >= WEIGHT_FLOOR + (1 - WEIGHT_FLOOR) * luma) continue;
    const px = p % w;
    const py = (p - px) / w;
    xs[got] = ((px + rng()) / w - 0.5) * s;
    ys[got] = ((py + rng()) / h - 0.5) * s;
    zs[got] = ((luma - 0.5) * Z_SPAN_PX + (rng() * 2 - 1) * Z_JITTER_PX) / DEPTH_PX;
    let lit: boolean;
    if (src.weighted) {
      lit = luma >= HIGHLIGHT_LUMA;
    } else {
      const rx = px - rim;
      const ry = py - rim;
      lit = rx < 0 || ry < 0 || data[(ry * w + rx) * 4 + 3] <= ALPHA_MIN;
    }
    cs[got] = lit ? COLOR.highlight : COLOR.body;
    got++;
  }

  // Sort by angle around the centroid, measured in the box's own proportions
  // (x × aspect) so the order matches the shape as drawn. Key = angle bucket ×
  // 2^15 + index: one native Float64Array sort, ties broken by sample order.
  const aspect = w / h;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < bodyN; i++) {
    cx += xs[i];
    cy += ys[i];
  }
  cx /= bodyN;
  cy /= bodyN;
  const keys = new Float64Array(bodyN);
  for (let i = 0; i < bodyN; i++) {
    if ((i + 1) % POINT_BATCH === 0) yield;
    const a = Math.atan2(ys[i] - cy, (xs[i] - cx) * aspect);
    const q = Math.min(ANGLE_STEPS - 1, Math.max(0, Math.floor(((a + Math.PI) / (2 * Math.PI)) * ANGLE_STEPS)));
    keys[i] = q * INDEX_STEPS + i;
  }
  yield;
  keys.sort();
  yield;
  for (let j = 0; j < bodyN; j++) {
    if ((j + 1) % POINT_BATCH === 0) yield;
    const i = keys[j] % INDEX_STEPS;
    const o = (base + j) * 4;
    out[o] = xs[i];
    out[o + 1] = ys[i];
    out[o + 2] = zs[i];
    out[o + 3] = cs[i];
  }

  // Pupils: a Vogel (golden-angle) disc per eye, the same layout in every shape,
  // so pupil morphs are rigid moves. Round in px: radius 4% of the shorter side.
  const minSide = Math.min(w, h);
  const prx = ((PUPIL_RADIUS * minSide) / w) * s;
  const pry = ((PUPIL_RADIUS * minSide) / h) * s;
  const eyes: EyePair = [
    [0, 0],
    [0, 0],
  ];
  for (let e = 0; e < 2; e++) {
    const ax = (src.eyes[e][0] - 0.5) * s;
    const ay = (src.eyes[e][1] - 0.5) * s;
    eyes[e] = [ax, ay];
    for (let i = 0; i < PUPILS_PER_EYE; i++) {
      const r = Math.sqrt((i + 0.5) / PUPILS_PER_EYE);
      const t = i * GOLDEN_ANGLE;
      const o = (base + bodyN + e * PUPILS_PER_EYE + i) * 4;
      out[o] = clampHalf(ax + prx * r * Math.cos(t));
      out[o + 1] = clampHalf(ay + pry * r * Math.sin(t));
      out[o + 2] = 0.5; // front-most (+22 px): pupils win any depth test and draw last
      out[o + 3] = COLOR.pupil;
    }
  }
  return eyes;
}

/**
 * The sampling job as a generator: it yields between small units of work so the
 * main-thread fallback can slice it into onIdle tasks; the worker just runs it
 * through. masks[i] is the decoded image for sources[i]. Same seed, same output.
 */
export function* buildTargetsJob(
  masks: readonly Mask[],
  sources: readonly ShapeSource[],
  n: number,
  seed: number = SEED,
): Generator<void, DotTargets, void> {
  assertPointCount(n);
  if (sources.length === 0 || masks.length !== sources.length) {
    throw new Error("dots: need one decoded mask per shape source");
  }
  const k = sources.length;
  const height = Math.ceil((n * k) / TEX_WIDTH);
  const data = new Float32Array(TEX_WIDTH * height * 4);
  const rng = mulberry32(seed);
  const insideOf = new Map<Mask, Int32Array>();
  const eyes: EyePair[] = [];
  const aspects: number[] = [];
  for (let i = 0; i < k; i++) {
    const mask = masks[i];
    let inside = insideOf.get(mask);
    if (!inside) {
      inside = yield* scanMask(mask);
      insideOf.set(mask, inside);
    }
    eyes.push(yield* sampleShape(data, i * n, n, mask, inside, sources[i], rng));
    aspects.push(mask.aspect ?? mask.width / mask.height);
  }
  return {
    tier: tierFor(n),
    n,
    k,
    width: TEX_WIDTH,
    height,
    data,
    names: sources.map((s) => s.name),
    eyes,
    aspects,
    scales: sources.map((s) => s.scale),
    pupilStart: n - PUPIL_POINTS,
  };
}

/** Run the whole job synchronously (worker, tests). */
export function buildTargets(
  masks: readonly Mask[],
  sources: readonly ShapeSource[],
  n: number,
  seed: number = SEED,
): DotTargets {
  const job = buildTargetsJob(masks, sources, n, seed);
  for (;;) {
    const step = job.next();
    if (step.done) return step.value;
  }
}

// ---------------------------------------------------------------------------
// Worker entry: fetch → createImageBitmap → OffscreenCanvas → core → post.

async function decodeInWorker(url: string, longSide: number): Promise<Mask> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`dots: ${res.status} for ${url}`);
  const bitmap = await createImageBitmap(await res.blob());
  try {
    const { w, h } = sampleDims(bitmap.width, bitmap.height, longSide);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("dots: no OffscreenCanvas 2d context");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    return { width: w, height: h, data: ctx.getImageData(0, 0, w, h).data, aspect: bitmap.width / bitmap.height };
  } finally {
    bitmap.close();
  }
}

type WorkerScope = {
  addEventListener(type: "message", listener: (event: MessageEvent<ShapesRequest>) => void): void;
  postMessage(message: ShapesResponse, options?: StructuredSerializeOptions): void;
};

if (typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope === "function") {
  const scope = globalThis as unknown as WorkerScope;
  scope.addEventListener("message", (event) => {
    const { id, n, seed, sources } = event.data;
    decodeAll(sources, decodeInWorker)
      .then((masks) => buildTargets(masks, sources, n, seed))
      .then(
        (t) => scope.postMessage({ id, ok: true, ...t }, { transfer: [t.data.buffer] }),
        (err: unknown) => scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
  });
}
