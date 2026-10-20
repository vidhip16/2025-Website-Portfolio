// Unit tests for the dot-stage sampling core (blueprint §5.1). Project "unit": pure
// Node, no browser, no canvas. Masks are synthetic RGBA buffers, so these pin the
// contract the renderer consumes (layout, counts, pupils, order, ranges) without
// decoding the real PNGs. The core is imported from lib/dots/shapes.worker (which
// targets.ts re-exports): targets.ts spawns the worker with import.meta.url, which
// this CommonJS-compiled runner cannot load.
import { expect, test } from "@playwright/test";
import gaze from "../../content/gaze.json";
import manifest from "../../public/dots/shapes.json";
import {
  ALPHA_MIN,
  HEAVY,
  HIGHLIGHT_LUMA,
  IDLE_RESERVE_MS,
  PUPIL_RADIUS,
  SLICE_MS,
  buildTargets,
  buildTargetsJob,
  mulberry32,
  resolveSources,
  runSliced,
  sampleDims,
  tierFor,
  type JobStep,
  type SliceDeadline,
} from "../../lib/dots/shapes.worker";
import {
  COLOR,
  DEPTH_PX,
  PUPIL_POINTS,
  PUPILS_PER_EYE,
  SEED,
  SHAPE_ORDER,
  TEX_WIDTH,
  type DotTargets,
  type Mask,
  type ShapeSource,
} from "../../lib/dots/types";

/** RGBA mask from a per-pixel [luma 0..1, alpha 0..255] function (sampled at pixel centres). */
function makeMask(w: number, h: number, px: (x: number, y: number) => [number, number]): Mask {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [l, a] = px(x + 0.5, y + 0.5);
      const o = (y * w + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = Math.round(l * 255);
      data[o + 3] = a;
    }
  }
  return { width: w, height: h, data };
}

const lumaAt = (m: Mask, x: number, y: number) => {
  const o = (y * m.width + x) * 4;
  return (0.2126 * m.data[o] + 0.7152 * m.data[o + 1] + 0.0722 * m.data[o + 2]) / 255;
};
const alphaAt = (m: Mask, x: number, y: number) => m.data[(y * m.width + x) * 4 + 3];

const DISC = makeMask(64, 64, (x, y) => (Math.hypot(x - 32, y - 32) < 24 ? [1, 255] : [0, 0]));
/** Ping-like: tall box, bright top half, dark bottom half, brightness-weighted, scale .6. */
const TALL = makeMask(60, 100, (x, y) =>
  ((x - 30) / 27) ** 2 + ((y - 50) / 46) ** 2 < 1 ? [y < 50 ? 0.95 : 0.3, 255] : [0, 0],
);
/** Ring with alpha 200 inside and 100 (below the threshold) outside. */
const RING = makeMask(80, 80, (x, y) => {
  const r = Math.hypot(x - 40, y - 40);
  return r > 20 && r < 34 ? [1, 200] : [1, 100];
});

const src = (name: string, weighted: boolean, scale: number, eyes: ShapeSource["eyes"]): ShapeSource => ({
  name,
  url: `/${name}.png`,
  size: 64,
  weighted,
  scale,
  eyes,
});
const SOURCES: ShapeSource[] = [
  src("disc", false, 1, [
    [0.4, 0.4],
    [0.6, 0.4],
  ]),
  src("ping-like", true, 0.6, [
    [0.3, 0.45],
    [0.65, 0.45],
  ]),
  src("ring", false, 1, [
    [0.45, 0.5],
    [0.55, 0.5],
  ]),
];
const MASKS = [DISC, TALL, RING];
const N = 1500;

const point = (t: DotTargets, shape: number, j: number) => {
  const o = (shape * t.n + j) * 4;
  return { x: t.data[o], y: t.data[o + 1], z: t.data[o + 2], w: t.data[o + 3] };
};
const bytes = (t: DotTargets) => Buffer.from(t.data.buffer, t.data.byteOffset, t.data.byteLength);

/** Pixel a stored body point came from, or null when it sits within 1e-3 px of a pixel edge. */
function sourcePixel(t: DotTargets, shape: number, j: number, mask: Mask) {
  const p = point(t, shape, j);
  const s = t.scales[shape];
  const fx = (p.x / s + 0.5) * mask.width;
  const fy = (p.y / s + 0.5) * mask.height;
  const ex = fx - Math.floor(fx);
  const ey = fy - Math.floor(fy);
  if (ex < 1e-3 || ex > 1 - 1e-3 || ey < 1e-3 || ey > 1 - 1e-3) return null;
  return { px: Math.floor(fx), py: Math.floor(fy) };
}

test.describe("dot targets: sampling core", () => {
  test("same seed gives identical output, another seed does not", () => {
    const a = buildTargets(MASKS, SOURCES, N);
    const b = buildTargets(MASKS, SOURCES, N, SEED);
    expect(bytes(a).equals(bytes(b))).toBe(true);
    expect(b.eyes).toEqual(a.eyes);
    const c = buildTargets(MASKS, SOURCES, N, SEED + 1);
    expect(bytes(a).equals(bytes(c))).toBe(false);

    const r1 = mulberry32(SEED);
    const r2 = mulberry32(SEED);
    let sum = 0;
    let mismatched = 0;
    let outOfRange = 0;
    for (let i = 0; i < 10000; i++) {
      const v = r1();
      if (v !== r2()) mismatched++;
      if (!(v >= 0 && v < 1)) outOfRange++;
      sum += v;
    }
    expect([mismatched, outOfRange]).toEqual([0, 0]);
    expect(sum / 10000).toBeGreaterThan(0.48);
    expect(sum / 10000).toBeLessThan(0.52);
  });

  test("packs K shapes of exactly N points into a 1024-wide RGBA float texture", () => {
    const t = buildTargets(MASKS, SOURCES, N);
    const k = SOURCES.length;
    expect(t.n).toBe(N);
    expect(t.k).toBe(k);
    expect(t.width).toBe(TEX_WIDTH);
    expect(t.width).toBe(1024);
    expect(t.height).toBe(Math.ceil((N * k) / 1024));
    expect(t.data).toBeInstanceOf(Float32Array);
    expect(t.data.length).toBe(t.width * t.height * 4);
    expect(t.pupilStart).toBe(N - PUPIL_POINTS);
    expect(t.names).toEqual(["disc", "ping-like", "ring"]);
    expect(t.scales).toEqual([1, 0.6, 1]);
    expect(t.aspects).toEqual([1, 0.6, 1]);
    expect(t.tier).toBe("T1");

    for (let s = 0; s < k; s++) {
      // [body, highlight, pupil] counts in the body range and in the pupil range.
      const bodyRange = [0, 0, 0];
      const pupilRange = [0, 0, 0];
      let other = 0;
      for (let j = 0; j < N; j++) {
        const { w } = point(t, s, j);
        if (w !== COLOR.body && w !== COLOR.highlight && w !== COLOR.pupil) other++;
        else (j < N - PUPIL_POINTS ? bodyRange : pupilRange)[w]++;
      }
      expect(other).toBe(0);
      expect(bodyRange[COLOR.body] + bodyRange[COLOR.highlight]).toBe(N - PUPIL_POINTS);
      expect(bodyRange[COLOR.pupil]).toBe(0);
      expect(pupilRange).toEqual([0, 0, PUPIL_POINTS]);
    }
    // Texels past n·k are padding.
    expect(t.data.subarray(N * k * 4).every((v) => v === 0)).toBe(true);

    // Production sizes: T2 12000 × 6 → 71 rows, T1 4000 × 6 → 24 rows.
    const six = Array.from({ length: 6 }, (_, i) => src(`s${i}`, false, 1, SOURCES[0].eyes));
    const t2 = buildTargets(Array(6).fill(DISC), six, 12000);
    expect([t2.tier, t2.width, t2.height, t2.data.length]).toEqual(["T2", 1024, 71, 1024 * 71 * 4]);
    const t1 = buildTargets(Array(6).fill(DISC), six, 4000);
    expect([t1.tier, t1.width, t1.height]).toEqual(["T1", 1024, 24]);
  });

  test("every coordinate lies in [-0.5, 0.5]; the manifest scale is baked in", () => {
    const t = buildTargets(MASKS, SOURCES, N);
    expect(t.data.every(Number.isFinite)).toBe(true);
    for (let s = 0; s < t.k; s++) {
      let maxXY = 0;
      let maxZ = 0;
      for (let j = 0; j < N; j++) {
        const p = point(t, s, j);
        maxXY = Math.max(maxXY, Math.abs(p.x), Math.abs(p.y));
        maxZ = Math.max(maxZ, Math.abs(p.z));
      }
      expect(maxXY).toBeLessThanOrEqual(0.5 * t.scales[s] + 1e-6);
      expect(maxXY).toBeGreaterThan(0.3 * t.scales[s]); // the shape fills its box
      expect(maxZ).toBeLessThanOrEqual(0.5);
    }
  });

  test("body points land inside the mask and z = (luma − .5) × 40 px ± 2", () => {
    const t = buildTargets(MASKS, SOURCES, N);
    let checked = 0;
    let outside = 0;
    let zOff = 0;
    for (let s = 0; s < t.k; s++) {
      const mask = MASKS[s];
      for (let j = 0; j < t.pupilStart; j++) {
        const pix = sourcePixel(t, s, j, mask);
        if (!pix) continue;
        checked++;
        if (alphaAt(mask, pix.px, pix.py) <= ALPHA_MIN) outside++;
        const zPx = point(t, s, j).z * DEPTH_PX;
        const expected = (lumaAt(mask, pix.px, pix.py) - 0.5) * 40;
        if (Math.abs(zPx - expected) > 2 + 1e-3) zOff++;
      }
    }
    expect([outside, zOff]).toEqual([0, 0]);
    expect(checked).toBeGreaterThan(t.k * t.pupilStart * 0.95);
  });

  test("brightness weighting favours bright pixels; highlights follow luma (Ping) or the top-left rim (masks)", () => {
    const SPLIT = makeMask(40, 40, (x) => [x < 20 ? 1 : 0.1, 255]);
    const eyes = SOURCES[0].eyes;
    const n = 2240;
    const t = buildTargets([SPLIT, SPLIT], [src("w", true, 1, eyes), src("m", false, 1, eyes)], n);

    const sides = [
      [0, 0],
      [0, 0],
    ];
    const wrongColour = [0, 0];
    const highlights = [0, 0];
    for (let s = 0; s < 2; s++) {
      for (let j = 0; j < t.pupilStart; j++) {
        const pix = sourcePixel(t, s, j, SPLIT);
        if (!pix) continue;
        const lit = point(t, s, j).w === COLOR.highlight;
        sides[s][pix.px < 20 ? 0 : 1]++;
        if (lit) highlights[s]++;
        // Ping: luma ≥ HIGHLIGHT_LUMA. Mask: in a fully opaque square only the left
        // column and top row lack an up-left neighbour inside the shape.
        const want = s === 0 ? lumaAt(SPLIT, pix.px, pix.py) >= HIGHLIGHT_LUMA : pix.px === 0 || pix.py === 0;
        if (lit !== want) wrongColour[s]++;
      }
    }
    expect(wrongColour).toEqual([0, 0]);
    expect(highlights[0]).toBeGreaterThan(0);
    expect(highlights[1]).toBeGreaterThan(0);
    // Acceptance 1.0 vs 0.1 + 0.9 × 0.1 = 0.19 → about 5.3× more points on the bright half.
    const weighted = sides[0][0] / sides[0][1];
    expect(weighted).toBeGreaterThan(3.5);
    expect(weighted).toBeLessThan(8);
    const plain = sides[1][0] / sides[1][1];
    expect(plain).toBeGreaterThan(0.8);
    expect(plain).toBeLessThan(1.25);
  });

  test("the last 240 points are pupils, 120 per eye, clustered at the eye anchors", () => {
    const t = buildTargets(MASKS, SOURCES, N);
    const rel: number[][][] = [];
    for (let s = 0; s < t.k; s++) {
      const { width: w, height: h } = MASKS[s];
      const sc = t.scales[s];
      const prx = ((PUPIL_RADIUS * Math.min(w, h)) / w) * sc;
      const pry = ((PUPIL_RADIUS * Math.min(w, h)) / h) * sc;
      rel.push([]);
      for (let e = 0; e < 2; e++) {
        const [ax, ay] = t.eyes[s][e];
        expect(ax).toBeCloseTo((SOURCES[s].eyes[e][0] - 0.5) * sc, 6);
        expect(ay).toBeCloseTo((SOURCES[s].eyes[e][1] - 0.5) * sc, 6);
        let mx = 0;
        let my = 0;
        let bad = 0;
        let maxR2 = 0;
        for (let i = 0; i < PUPILS_PER_EYE; i++) {
          const p = point(t, s, t.pupilStart + e * PUPILS_PER_EYE + i);
          if (p.w !== COLOR.pupil || p.z !== 0.5) bad++;
          const u = (p.x - ax) / prx;
          const v = (p.y - ay) / pry;
          maxR2 = Math.max(maxR2, u * u + v * v);
          mx += p.x;
          my += p.y;
          if (e === 0) rel[s].push([u, v]);
        }
        expect(bad).toBe(0);
        expect(maxR2).toBeLessThanOrEqual(1 + 1e-3); // inside the 4% disc
        expect(maxR2).toBeGreaterThan(0.9); // and filling it
        expect(Math.abs(mx / PUPILS_PER_EYE - ax)).toBeLessThan(0.15 * prx);
        expect(Math.abs(my / PUPILS_PER_EYE - ay)).toBeLessThan(0.15 * pry);
      }
    }
    // Same disc layout in every shape (relative to its radius), so pupil morphs are rigid moves.
    let drift = 0;
    for (let i = 0; i < PUPILS_PER_EYE; i++) {
      for (let s = 1; s < t.k; s++) {
        drift = Math.max(drift, Math.abs(rel[s][i][0] - rel[0][i][0]), Math.abs(rel[s][i][1] - rel[0][i][1]));
      }
    }
    expect(drift).toBeLessThan(1e-3);
  });

  test("body points are sorted by angle around the shape's centroid", () => {
    const t = buildTargets(MASKS, SOURCES, N);
    for (let s = 0; s < t.k; s++) {
      const aspect = t.aspects[s];
      let cx = 0;
      let cy = 0;
      for (let j = 0; j < t.pupilStart; j++) {
        const p = point(t, s, j);
        cx += p.x;
        cy += p.y;
      }
      cx /= t.pupilStart;
      cy /= t.pupilStart;
      const angles: number[] = [];
      let descents = 0;
      for (let j = 0; j < t.pupilStart; j++) {
        const p = point(t, s, j);
        const a = Math.atan2(p.y - cy, (p.x - cx) * aspect);
        if (j > 0 && a < angles[j - 1] - 1e-4) descents++;
        angles.push(a);
      }
      expect(descents).toBe(0);
      // A full sweep: these shapes surround their centroid.
      expect(angles[0]).toBeLessThan(-Math.PI + 0.2);
      expect(angles[angles.length - 1]).toBeGreaterThan(Math.PI - 0.2);
    }
  });

  test("the job yields in small units, flags big allocations HEAVY, and matches the synchronous result", () => {
    const job = buildTargetsJob(MASKS, SOURCES, 4000);
    const values: JobStep[] = [];
    let step = job.next();
    while (!step.done) {
      values.push(step.value);
      step = job.next();
    }
    expect(values.length).toBeGreaterThan(30);
    expect(values.filter((v) => v !== undefined && v !== HEAVY)).toEqual([]);
    // One HEAVY before the texture (the very first yield), one per distinct mask's pixel list.
    expect(values[0]).toBe(HEAVY);
    expect(values.filter((v) => v === HEAVY).length).toBe(1 + new Set(MASKS).size);
    expect(bytes(step.value).equals(bytes(buildTargets(MASKS, SOURCES, 4000)))).toBe(true);
  });

  test("rejects bad input", () => {
    expect(() => buildTargets(MASKS, SOURCES, PUPIL_POINTS)).toThrow(RangeError);
    expect(() => buildTargets(MASKS, SOURCES, 1000.5)).toThrow(RangeError);
    expect(() => buildTargets(MASKS.slice(0, 2), SOURCES, N)).toThrow(/one decoded mask per shape/);
    const empty = makeMask(8, 8, () => [1, ALPHA_MIN]);
    expect(() => buildTargets([empty], [SOURCES[0]], N)).toThrow(/"disc" has no pixels/);
    expect(tierFor(12000)).toBe("T2");
    expect(tierFor(4000)).toBe("T1");
  });
});

// ---------------------------------------------------------------------------
// runSliced (main-thread fallback) on a fake clock: fake units advance the clock
// by a set number of ms, and the scheduler queue is drained by hand.

type Unit = { ms: number; heavy?: boolean };
type SliceLog = { start: number; end: number; units: number; left: number | null };
type MakeDeadline = (clock: { t: number }, start: number) => SliceDeadline | null;

const noDeadline: MakeDeadline = () => null;
/** An idle period of `ms` from the slice's start. */
const idleFor =
  (ms: number): MakeDeadline =>
  (clock, start) => ({ didTimeout: false, timeRemaining: () => Math.max(0, start + ms - clock.t) });
/** rIC fired on its timeout: the browser is busy, timeRemaining() is 0. */
const timedOut: MakeDeadline = () => ({ didTimeout: true, timeRemaining: () => 0 });

function* fakeJob(clock: { t: number }, units: Unit[], starts: number[], failAt: number): Generator<JobStep, number, void> {
  for (let k = 0; k < units.length; k++) {
    starts.push(clock.t);
    if (k === failAt) throw new Error(`unit ${k} failed`);
    clock.t += units[k].ms;
    if (k + 1 < units.length) yield units[k + 1].heavy ? HEAVY : undefined;
  }
  return units.length;
}

async function drive(units: Unit[], deadline: MakeDeadline = noDeadline, failAt = -1) {
  const clock = { t: 0 };
  const starts: number[] = [];
  const queue: ((d: SliceDeadline | null) => void)[] = [];
  const firsts: boolean[] = [];
  const done = runSliced(
    fakeJob(clock, units, starts, failAt),
    (slice, first) => {
      queue.push(slice);
      firsts.push(first);
    },
    () => clock.t,
  );
  const slices: SliceLog[] = [];
  while (queue.length > 0) {
    const slice = queue.shift()!;
    clock.t += 10; // the page does other things between slices
    const start = clock.t;
    const before = starts.length;
    const d = deadline(clock, start);
    slice(d);
    slices.push({ start, end: clock.t, units: starts.length - before, left: d && !d.didTimeout ? d.timeRemaining() : null });
  }
  return { done, slices, starts, firsts };
}

const repeat = (count: number, ms: number): Unit[] => Array.from({ length: count }, () => ({ ms }));
const longest = (slices: SliceLog[]) => Math.max(...slices.map((s) => s.end - s.start));

test.describe("dot targets: main-thread slicing", () => {
  test("a slice stops before a unit that could take it past SLICE_MS, at any unit speed", async () => {
    expect(SLICE_MS).toBe(4);
    // Desktop-sized units: 8 per slice, never past 4 ms.
    const fast = await drive(repeat(40, 0.5));
    expect(await fast.done).toBe(40);
    expect(longest(fast.slices)).toBeLessThanOrEqual(SLICE_MS);
    expect(fast.slices.slice(0, -1).every((s) => s.units === 8)).toBe(true);
    expect(fast.firsts).toEqual([true, ...Array(fast.slices.length - 1).fill(false)]);

    // The same job on a phone 3.2× slower: the estimate follows the real unit time.
    const slow = await drive(repeat(20, 1.6));
    expect(await slow.done).toBe(20);
    expect(longest(slow.slices)).toBeLessThanOrEqual(SLICE_MS);
    expect(slow.slices.every((s) => s.units === 2)).toBe(true);
  });

  test("a HEAVY unit always opens a fresh slice and does not inflate the estimate", async () => {
    const units: Unit[] = [...repeat(5, 0.5), { ms: 3, heavy: true }, ...repeat(6, 0.5), { ms: 2.5, heavy: true }, ...repeat(3, 0.5)];
    const { done, slices, starts } = await drive(units);
    expect(await done).toBe(units.length);
    const sliceStarts = new Set(slices.map((s) => s.start));
    units.forEach((u, k) => {
      if (u.heavy) expect(sliceStarts.has(starts[k])).toBe(true);
    });
    // After the 3 ms heavy unit the slice still fits two 0.5 ms units (3 + 0.5 + 0.5 = 4).
    const heavySlice = slices.find((s) => s.start === starts[5])!;
    expect(heavySlice.units).toBe(3);
    expect(longest(slices)).toBeLessThanOrEqual(SLICE_MS);
  });

  test("mixed unit sizes never produce a task over 8 ms", async () => {
    const rnd = mulberry32(7);
    const units: Unit[] = Array.from({ length: 400 }, () =>
      rnd() < 0.05 ? { ms: 0.5 + rnd() * 3, heavy: true } : { ms: 0.02 + rnd() * rnd() * 2 },
    );
    const maxLight = Math.max(...units.filter((u) => !u.heavy).map((u) => u.ms));
    for (const deadline of [noDeadline, idleFor(50), idleFor(6), timedOut]) {
      const { done, slices } = await drive(units, deadline);
      expect(await done).toBe(units.length);
      expect(longest(slices)).toBeLessThanOrEqual(SLICE_MS + maxLight);
      expect(longest(slices)).toBeLessThanOrEqual(8);
    }
  });

  test("honours the IdleDeadline: leaves IDLE_RESERVE_MS unused, yet always makes progress", async () => {
    expect(IDLE_RESERVE_MS).toBe(2);
    const short = await drive(repeat(30, 0.5), idleFor(3));
    expect(await short.done).toBe(30);
    // 3 ms of idle: 0.5 + 0.5, then 2 ms left − 0.5 would dip under the reserve.
    for (const s of short.slices.slice(0, -1)) {
      expect(s.units).toBe(2);
      expect(s.left!).toBeGreaterThanOrEqual(IDLE_RESERVE_MS);
    }
    // No idle time at all (not a timeout): one unit per slice, still finishes.
    const none = await drive(repeat(12, 0.5), idleFor(0));
    expect(await none.done).toBe(12);
    expect(none.slices.every((s) => s.units === 1)).toBe(true);
    // rIC fired on its timeout: the deadline is ignored and the 4 ms cap applies.
    const late = await drive(repeat(40, 0.5), timedOut);
    expect(await late.done).toBe(40);
    expect(late.slices.slice(0, -1).every((s) => s.units === 8)).toBe(true);
  });

  test("a failing unit rejects and schedules nothing more", async () => {
    const { done, slices, starts } = await drive(repeat(30, 0.5), noDeadline, 13);
    await expect(done).rejects.toThrow(/unit 13 failed/);
    expect(starts.length).toBe(14);
    expect(slices.length).toBe(2); // units 0–7, then 8–13 (throws)
  });

  test("the real sampling job through runSliced matches buildTargets", async () => {
    const queue: ((d: SliceDeadline | null) => void)[] = [];
    const done = runSliced(buildTargetsJob(MASKS, SOURCES, N), (slice) => queue.push(slice));
    let slices = 0;
    while (queue.length > 0) {
      queue.shift()!(null);
      slices++;
    }
    const t = await done;
    expect(slices).toBeGreaterThanOrEqual(1 + 1 + new Set(MASKS).size); // every HEAVY opens a slice
    expect(bytes(t).equals(bytes(buildTargets(MASKS, SOURCES, N)))).toBe(true);
  });
});

test.describe("dot targets: manifest", () => {
  test("resolveSources follows shapes.json order with gaze.json eyes for Ping", () => {
    const sources = resolveSources(manifest, gaze);
    expect(sources.map((s) => s.name)).toEqual([...SHAPE_ORDER]);
    const pingEyes = gaze.eyes.map((e) => [e.c[0] / 100, e.c[1] / 100]);
    for (const s of sources) {
      const entry = (manifest.shapes as Record<string, { src: string; eyes: unknown; scale?: number }>)[s.name];
      expect(s.url).toBe(entry.src);
      if (s.name.startsWith("ping")) {
        expect(s).toMatchObject({ weighted: true, size: 600 });
        expect(s.eyes).toEqual(pingEyes);
      } else {
        expect(s).toMatchObject({ weighted: false, size: 512, scale: 1 });
        expect(s.eyes).toEqual(entry.eyes);
      }
    }
    expect(sources[0].scale).toBe(1);
    expect(sources[1].scale).toBe(0.6);
    expect(() =>
      resolveSources({ order: ["x"], shapes: { x: { src: "/x.png", eyes: [[0.5, 0.5]] } } }, gaze),
    ).toThrow(/two \[x, y\] eye anchors/);
    expect(() => resolveSources({ order: ["y"], shapes: {} }, gaze)).toThrow(/no entry for "y"/);
  });

  test("sampleDims draws Ping at 600 px on the long side and masks at 512", () => {
    expect(sampleDims(gaze.box.w, gaze.box.h, 600)).toEqual({ w: 367, h: 600 });
    expect(sampleDims(512, 512, 512)).toEqual({ w: 512, h: 512 });
  });
});
