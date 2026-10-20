import { devices, expect, test, type CDPSession, type Page } from "@playwright/test";
import {
  expectProbe,
  gotoAndSettle,
  mergeEvidence,
  percentile,
  settleApp,
  skipUnlessQaBuild,
  waitForScrollIdle,
} from "../e2e/helpers";

// Blueprint §12 gate 7 / §8 frame-time budget, read from window.__perf (<PerfProbe /> from
// components/qa/PerfProbe, mounted in app/layout.tsx, in a NEXT_PUBLIC_QA=1 build).
// Chromium only, one worker, never alongside a workflow or a dev server. The "perf" project is
// registered only when PW_PERF=1, and then it is the only project (playwright.config.ts):
//   PW_PERF=1 pnpm exec playwright test --project=perf
// Evidence: test-results/perf/frame-time.json.
//
//   desktop:   rAF interval p95 ≤ 18 ms while scrolling, unthrottled
//   mobile 4×: rAF interval p90 ≤ 20 ms at 4× CPU throttle on a 390 px touch viewport (T1 tier)

// In order, in one worker; a desktop failure must not skip the mobile run (no "serial").
test.describe.configure({ mode: "default" });

type Run = {
  viewport: { width: number; height: number } | null;
  cpuThrottle: number;
  scroll: "wheel" | "touch";
  durationMs: number;
  frames: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
  longTasks: { count: number; totalMs: number; maxMs: number };
};

const atBottom = (page: Page) =>
  page.evaluate(() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4);

/** Load, let lazy chunks land, reset the probe, scroll top → bottom, summarise the intervals. */
async function measure(page: Page, opts: { scroll: "wheel" | "touch"; cdp: CDPSession; cpuThrottle: number }): Promise<Run> {
  await gotoAndSettle(page, "/");
  await settleApp(page);
  await expectProbe(page, "__perf");
  // Warm pass: mount every lazy island before measuring, then return to the top.
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await settleApp(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await waitForScrollIdle(page);
  await page.waitForTimeout(1200);

  const vp = page.viewportSize()!;
  if (opts.scroll === "wheel") await page.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2));
  if (opts.cpuThrottle > 1) await opts.cdp.send("Emulation.setCPUThrottlingRate", { rate: opts.cpuThrottle });
  await page.evaluate(() => window.__perf!.reset());
  const start = Date.now();

  for (let i = 0; i < 400 && !(await atBottom(page)) && Date.now() - start < 60_000; i++) {
    if (opts.scroll === "wheel") {
      // ~2000 px/s in 120 px notches, like a steady mouse wheel.
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(60);
    } else {
      await opts.cdp.send("Input.synthesizeScrollGesture", {
        x: Math.round(vp.width / 2),
        y: Math.round(vp.height * 0.75),
        yDistance: -Math.round(vp.height * 0.6),
        speed: 1500,
        gestureSourceType: "touch",
      });
    }
  }
  await waitForScrollIdle(page);
  const durationMs = Date.now() - start;

  const data = await page.evaluate(() => {
    const p = window.__perf as unknown as { frames: number[]; longTasks?: number[] };
    return { frames: p.frames.slice(), longTasks: (p.longTasks ?? []).slice() };
  });
  if (opts.cpuThrottle > 1) await opts.cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  const f = data.frames;
  expect(f.length, "window.__perf recorded no frames").toBeGreaterThan(30);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    viewport: page.viewportSize(),
    cpuThrottle: opts.cpuThrottle,
    scroll: opts.scroll,
    durationMs,
    frames: f.length,
    p50: round(percentile(f, 50)),
    p90: round(percentile(f, 90)),
    p95: round(percentile(f, 95)),
    p99: round(percentile(f, 99)),
    max: round(Math.max(...f)),
    mean: round(f.reduce((a, b) => a + b, 0) / f.length),
    longTasks: {
      count: data.longTasks.length,
      totalMs: data.longTasks.reduce((a, b) => a + b, 0),
      maxMs: data.longTasks.length ? Math.max(...data.longTasks) : 0,
    },
  };
}

test.describe("frame time @perf", () => {
  test.beforeEach(({ browserName, baseURL }) => {
    test.skip(browserName !== "chromium", "CDP CPU throttling and rAF pacing are measured in Chromium only");
    skipUnlessQaBuild(baseURL);
  });

  test("desktop: rAF interval p95 ≤ 18 ms while scrolling @perf", async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    const cdp = await page.context().newCDPSession(page);
    const run = await measure(page, { scroll: "wheel", cdp, cpuThrottle: 1 });
    mergeEvidence(info, "perf/frame-time.json", "desktop", run);
    expect(run.p95, `desktop p95 ${run.p95} ms (p90 ${run.p90}, max ${run.max})`).toBeLessThanOrEqual(18);
  });

  test.describe("mobile", () => {
    test.use({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: devices["Pixel 7"].userAgent,
    });

    test("mobile at 4× CPU: rAF interval p90 ≤ 20 ms @perf", async ({ page }, info) => {
      test.setTimeout(180_000);
      const cdp = await page.context().newCDPSession(page);
      const run = await measure(page, { scroll: "touch", cdp, cpuThrottle: 4 });
      mergeEvidence(info, "perf/frame-time.json", "mobile-4x", run);
      // unblock: Phase 5 (the T1 dots tier lands then). The run and its evidence happen now;
      // delete the next line to enforce the budget.
      expect(run.p90, `mobile 4× p90 ${run.p90} ms (p95 ${run.p95}, max ${run.max})`).toBeLessThanOrEqual(20);
    });
  });
});
