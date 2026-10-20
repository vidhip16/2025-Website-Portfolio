import { expect, test, type Page } from "@playwright/test";
import { chapters } from "../../content/site";
import type { DotsProbe, GazeProbe } from "../../lib/gaze";
import {
  SEL,
  angleDeg,
  angleDiff,
  chapterMidY,
  expectProbe,
  firstTime,
  gotoAndSettle,
  readProbe,
  readProbeSamples,
  scrollToY,
  settleApp,
  skipUnlessQaBuild,
  startProbeSampler,
  waitForScrollIdle,
} from "./helpers";

// Blueprint §12 gate 5 signature interactions, read through the QA probes
// (window.__gaze = {aim, cell, scaleY}, window.__dots = {shape, holeR, pupilDir}; NEXT_PUBLIC_QA=1).
// Desktop specs run on chromium; the @touch spec runs on mobile-chromium.

const inRange = (v: number | null | undefined, lo: number, hi: number) => typeof v === "number" && v >= lo && v <= hi;

/** Eye midpoint for pupil checks: `__dots.eyes` when the probe exposes it (sharedRequest), else the shape centre. */
async function dotEyes(page: Page, fallback: { x: number; y: number }) {
  const probe = await readProbe<DotsProbe & { eyes?: [number, number] }>(page, "__dots");
  return probe.eyes ? { x: probe.eyes[0], y: probe.eyes[1] } : fallback;
}

test.describe("signature interactions", () => {
  test.beforeEach(({ baseURL }) => skipUnlessQaBuild(baseURL));

  // unblock: Phase 4
  test.fixme("at the hero the wheel aims the gaze down then up, with a squash", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await settleApp(page);
    await expectProbe(page, "__gaze");
    const box = (await page.locator(SEL.pingFigure).boundingBox())!;
    // Wheel events land where the mouse is: over Ping, in the hero.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6);
    await page.waitForTimeout(300);

    await startProbeSampler(page, "__gaze", { startOn: "wheel", durationMs: 400 });
    await page.mouse.wheel(0, 240);
    let samples = await readProbeSamples<GazeProbe>(page);
    expect(firstTime(samples, (g) => inRange(g.aim, 80, 100)), "aim reached 80–100° (down)").toBeLessThanOrEqual(250);
    expect(firstTime(samples, (g) => g.scaleY < 0.99), "squash (scaleY < .99)").toBeLessThanOrEqual(250);

    // 400 ms after scrolling stops the gaze returns to the pointer.
    await waitForScrollIdle(page);
    await page.waitForTimeout(600);

    await startProbeSampler(page, "__gaze", { startOn: "wheel", durationMs: 400 });
    await page.mouse.wheel(0, -240);
    samples = await readProbeSamples<GazeProbe>(page);
    expect(firstTime(samples, (g) => inRange(g.aim, 260, 280)), "aim reached 260–280° (up)").toBeLessThanOrEqual(250);
  });

  // unblock: Phase 4
  test.fixme("a touch swipe aims the gaze the same way @touch", async ({ page, browserName }) => {
    // CDP synthesizeScrollGesture produces a real touch scroll; Chromium only (mobile-chromium project).
    test.skip(browserName !== "chromium", "touch scroll gestures need CDP");
    const cdp = await page.context().newCDPSession(page);
    await gotoAndSettle(page, "/");
    await settleApp(page);
    await expectProbe(page, "__gaze");
    const vp = page.viewportSize()!;
    const at = { x: Math.round(vp.width / 2), y: Math.round(vp.height * 0.7) };

    // Finger moves up the screen → the page scrolls down → Ping looks down.
    await startProbeSampler(page, "__gaze", { startOn: "scroll", durationMs: 600 });
    await cdp.send("Input.synthesizeScrollGesture", {
      ...at,
      yDistance: -240,
      speed: 1200,
      gestureSourceType: "touch",
    });
    let samples = await readProbeSamples<GazeProbe>(page);
    expect(firstTime(samples, (g) => inRange(g.aim, 80, 100)), "aim reached 80–100° (down)").toBeLessThanOrEqual(250);

    await waitForScrollIdle(page);
    await page.waitForTimeout(600);

    await startProbeSampler(page, "__gaze", { startOn: "scroll", durationMs: 600 });
    await cdp.send("Input.synthesizeScrollGesture", {
      ...at,
      yDistance: 240,
      speed: 1200,
      gestureSourceType: "touch",
    });
    samples = await readProbeSamples<GazeProbe>(page);
    expect(firstTime(samples, (g) => inRange(g.aim, 260, 280)), "aim reached 260–280° (up)").toBeLessThanOrEqual(250);
  });

  // unblock: Phase 5
  test.fixme("in every room chapter the cursor opens a hole and the dot pupils watch it", async ({ page }) => {
    test.slow();
    await gotoAndSettle(page, "/");
    await settleApp(page);
    await expectProbe(page, "__dots");
    const vp = page.viewportSize()!;
    // §3.2: shapes are centred at x = 72vw on desktop (vertically on the fixed full-viewport canvas).
    const centre = { x: Math.round(vp.width * 0.72), y: Math.round(vp.height / 2) };

    for (const ch of chapters) {
      await scrollToY(page, await chapterMidY(page, ch.title));
      await expect
        .poll(async () => Math.abs((await readProbe<DotsProbe>(page, "__dots")).shape - ch.shape), {
          timeout: 4000,
          message: `shape ${ch.shape} not reached in "${ch.title}"`,
        })
        .toBeLessThanOrEqual(0.05);

      // Start off the shape (right edge, clear of the text column and chips) and let the hole close.
      await page.mouse.move(vp.width - 8, centre.y);
      await page.waitForTimeout(600);

      await startProbeSampler(page, "__dots", { startOn: "pointermove", durationMs: 300 });
      await page.mouse.move(centre.x, centre.y);
      const samples = await readProbeSamples<DotsProbe>(page);
      expect(firstTime(samples, (d) => d.holeR > 60), `hole opened in "${ch.title}"`).toBeLessThanOrEqual(200);

      // Pupils point at the cursor. With the eye midpoint known the centre itself is checked;
      // vertical rays through the centre are checked either way (independent of the eye height).
      const eyes = await dotEyes(page, centre);
      const targets = [
        { x: centre.x, y: vp.height - 24 },
        { x: centre.x, y: 96 },
        ...(eyes !== centre ? [centre] : []),
      ];
      for (const target of targets) {
        await page.mouse.move(target.x, target.y);
        const expected = angleDeg(eyes, target);
        await expect
          .poll(async () => angleDiff((await readProbe<DotsProbe>(page, "__dots")).pupilDir, expected), {
            timeout: 500,
            message: `pupils in "${ch.title}" should point at ${Math.round(expected)}°`,
          })
          .toBeLessThanOrEqual(10);
      }
    }
  });

  // unblock: Phase 5
  test.fixme("the dots reach shapes 2, 3 and 4 at the chapter midpoints", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await settleApp(page);
    await expectProbe(page, "__dots");
    for (const ch of chapters.filter((c) => c.shape >= 2)) {
      await scrollToY(page, await chapterMidY(page, ch.title));
      await expect
        .poll(async () => (await readProbe<DotsProbe>(page, "__dots")).shape, {
          timeout: 4000, // scrub: 1
          message: `shape at the "${ch.title}" midpoint`,
        })
        .toBeCloseTo(ch.shape, 1);
    }
  });
});
