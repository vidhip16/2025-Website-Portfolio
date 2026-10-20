// Dot-stage targets (blueprint §5.1, §5.5): `loadTargets({ n })` samples every
// shape in public/dots/shapes.json into one packed float texture (layout in
// lib/dots/types.ts) and caches it per n (T2 12000, T1 4000).
//
// Worker first (lib/dots/shapes.worker.ts: fetch → createImageBitmap →
// OffscreenCanvas → core). If Worker or OffscreenCanvas 2D is missing, or the
// worker fails, the same core runs on the main thread. Images decode with
// HTMLImageElement.decode(); each drawImage and each getImageData gets an onIdle
// task of its own. The sampling generator runs through runSliced (shapes.worker.ts)
// in requestIdleCallback slices that honour the IdleDeadline and a 4 ms cap.
//
// No three import, no GSAP: the renderer chunk stays small. Browser only.

import gaze from "../../content/gaze.json";
import shapes from "../../public/dots/shapes.json";
import { onIdle } from "../idle";
import {
  assertPointCount,
  buildTargetsJob,
  decodeAll,
  resolveSources,
  runSliced,
  sampleDims,
  type SliceScheduler,
} from "./shapes.worker";
import { SEED, type DotTargets, type Mask, type ShapeSource, type ShapesRequest, type ShapesResponse } from "./types";

export * from "./types";
export {
  buildTargets,
  buildTargetsJob,
  mulberry32,
  resolveSources,
  sampleDims,
  tierFor,
} from "./shapes.worker";

/** Main-thread fallback without requestIdleCallback: gap between slices on a plain timer. */
const TIMER_GAP_MS = 16;

const cache = new Map<number, Promise<DotTargets>>();
let nextId = 1;

/**
 * Targets for n points per shape (TIER_POINTS.T2 or .T1), sampled once per n and
 * cached for the page's lifetime (Activity re-mounts get the same object). The
 * worker is terminated as soon as it answers; nothing is left for the caller to
 * clean up. Treat `data` as read-only: every caller shares it.
 */
export async function loadTargets({ n }: { n: number }): Promise<DotTargets> {
  let pending = cache.get(n);
  if (!pending) {
    const p = load(n);
    pending = p;
    cache.set(n, p);
    p.catch(() => {
      if (cache.get(n) === p) cache.delete(n); // let a later call retry
    });
  }
  return pending;
}

async function load(n: number): Promise<DotTargets> {
  assertPointCount(n);
  if (typeof window === "undefined") throw new Error("dots: loadTargets runs in the browser only");
  const sources = resolveSources(shapes, gaze).map((s) => ({ ...s, url: new URL(s.url, document.baseURI).href }));
  if (canUseWorker()) {
    try {
      return await viaWorker(n, sources);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.warn("dots: sampler worker failed, sampling on the main thread", err);
    }
  }
  return onMainThread(n, sources);
}

function canUseWorker(): boolean {
  if (typeof Worker !== "function" || typeof OffscreenCanvas !== "function" || typeof createImageBitmap !== "function") {
    return false;
  }
  try {
    return new OffscreenCanvas(1, 1).getContext("2d") !== null;
  } catch {
    return false;
  }
}

function viaWorker(n: number, sources: ShapeSource[]): Promise<DotTargets> {
  return new Promise<DotTargets>((resolve, reject) => {
    const id = nextId++;
    const worker = new Worker(new URL("./shapes.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<ShapesResponse>) => {
      const r = event.data;
      if (r.id !== id) return;
      worker.terminate();
      if (!r.ok) {
        reject(new Error(r.error));
        return;
      }
      resolve({
        tier: r.tier,
        n: r.n,
        k: r.k,
        width: r.width,
        height: r.height,
        data: r.data,
        names: r.names,
        eyes: r.eyes,
        aspects: r.aspects,
        scales: r.scales,
        pupilStart: r.pupilStart,
      });
    };
    worker.onerror = (event) => {
      event.preventDefault();
      worker.terminate();
      reject(new Error(event.message || "dots: sampler worker error"));
    };
    worker.onmessageerror = () => {
      worker.terminate();
      reject(new Error("dots: sampler worker message could not be read"));
    };
    const request: ShapesRequest = { id, n, seed: SEED, sources };
    worker.postMessage(request);
  });
}

// ---------------------------------------------------------------------------
// Main-thread fallback.

const idle = () => new Promise<void>((resolve) => onIdle(resolve));

/**
 * lib/idle's onIdle, except the slice receives its IdleDeadline (onIdle's callback
 * takes no arguments). Without requestIdleCallback (Safari) the first slice waits
 * 200 ms like onIdle does, and later slices run TIMER_GAP_MS apart with no deadline,
 * so runSliced falls back to its 4 ms cap.
 */
const scheduleSlice: SliceScheduler = (slice, first) => {
  if (typeof requestIdleCallback === "function") requestIdleCallback(slice, { timeout: 2000 });
  else setTimeout(() => slice(null), first ? 200 : TIMER_GAP_MS);
};

async function onMainThread(n: number, sources: ShapeSource[]): Promise<DotTargets> {
  const masks = await decodeAll(sources, decodeOnMain);
  return runSliced(buildTargetsJob(masks, sources, n, SEED), scheduleSlice);
}

async function decodeOnMain(url: string, longSide: number): Promise<Mask> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode(); // off the main thread
  const { w, h } = sampleDims(img.naturalWidth, img.naturalHeight, longSide);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("dots: no 2d canvas context");
  ctx.imageSmoothingQuality = "high";
  await idle(); // the resampling draw gets an idle task of its own…
  ctx.drawImage(img, 0, 0, w, h);
  await idle(); // …and so does the pixel read
  const { data } = ctx.getImageData(0, 0, w, h);
  canvas.width = canvas.height = 0; // release the backing store
  return { width: w, height: h, data, aspect: img.naturalWidth / img.naturalHeight };
}
